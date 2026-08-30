#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BrowserRunner } from "./lib/browser-runner.mjs";
import { deriveActivityEvidence } from "./lib/activity.mjs";
import { loadConfig } from "./lib/config.mjs";
import { diffSnapshots } from "./lib/diff.mjs";
import { resolveArea, isInsideArea } from "./lib/geometry.mjs";
import { reconcileStations } from "./lib/identity.mjs";
import { normalizeQueues } from "./lib/queue.mjs";
import { rankAssessments } from "./lib/ranking.mjs";
import { readJson, sha256, stableJson, writeJsonAtomic } from "./lib/util.mjs";
import { assessRequestedUnion } from "./lib/verdict.mjs";

const adapters = {
  yandex: () => import("./lib/sources/yandex.mjs"),
  gdebenz: () => import("./lib/sources/gdebenz.mjs"),
  "2gis": () => import("./lib/sources/twogis.mjs")
};

export async function collectSnapshot({ configPath, outputPath, previousPath, browserFactory = config => new BrowserRunner(config), now = new Date() } = {}) {
  const config = await loadConfig(configPath);
  const area = resolveArea(config.area);
  const previous = previousPath ? await readJson(previousPath) : undefined;
  const fetchedAt = now.toISOString();
  const request = { area, requestedProducts: config.requestedProducts, fetchedAt, deadlineAt: new Date(now.getTime() + config.browser.adapterTimeoutMs * config.sources.filter(s => s.enabled).length).toISOString() };
  const results = [];
  const warnings = [];
  let runtimeHealth = { status: "OK" };
  const cleanups = [];
  const browserNamespaces = [];
  const orderedSources = [...config.sources].sort((a, b) => a.order - b.order);
  const firstEnabled = orderedSources.find(source => source.enabled);
  let firstRunner;
  try {
    if (firstEnabled) {
      firstRunner = browserFactory(config, firstEnabled.id);
      browserNamespaces.push(firstRunner.namespace);
      await firstRunner.probe();
    }
  } catch (error) {
    runtimeHealth = { status: "BROWSER_UNAVAILABLE", code: error.code ?? "BROWSER_UNAVAILABLE", message: error.message };
    warnings.push({ code: "BROWSER_RUNTIME_FAILED", message: `Common browser runtime failure: ${error.message}` });
    for (const source of config.sources) results.push({ source: source.id, health: { source: source.id, status: source.enabled ? "PARTIAL" : "DISABLED", code: source.enabled ? "NOT_ATTEMPTED" : undefined, message: source.enabled ? "Not attempted because the shared browser runtime failed" : undefined }, stations: [], observations: [], queues: [], activity: [] });
  }
  if (runtimeHealth.status === "OK") {
    let usedFirstRunner = false;
    for (const source of orderedSources) {
      if (!source.enabled) { results.push({ source: source.id, health: { source: source.id, status: "DISABLED" }, stations: [], observations: [], queues: [], activity: [] }); continue; }
      let runner = !usedFirstRunner && source.id === firstEnabled.id ? firstRunner : browserFactory(config, source.id);
      usedFirstRunner = true;
      if (!browserNamespaces.includes(runner.namespace)) browserNamespaces.push(runner.namespace);
      let sourceResult;
      for (let browserAttempt = 0; browserAttempt < 2; browserAttempt++) {
        try {
          const adapter = await adapters[source.id]();
          sourceResult = await adapter.collect(request, { browser: runner, previous, config });
        } catch (error) {
          sourceResult = { source: source.id, health: { source: source.id, status: "PARTIAL", code: "INTERNAL_ADAPTER_ERROR", message: error.message }, stations: [], observations: [], queues: [], activity: [] };
        } finally {
          const sourceCleanup = await runner.close().catch(error => ({ sessionsRemaining: 1, warnings: [error.message] }));
          for (const namespace of runner.namespaceHistory ?? [runner.namespace]) if (!browserNamespaces.includes(namespace)) browserNamespaces.push(namespace);
          cleanups.push({ source: source.id, browserNamespaces: runner.namespaceHistory ?? [runner.namespace], networkControls: runner.networkControlsStatus, ...sourceCleanup });
          for (const message of runner.runtimeWarnings ?? []) warnings.push({ code: "BROWSER_NETWORK_CONTROLS_DEGRADED", message: `${source.id}: ${message}` });
        }
        if (browserAttempt === 0 && isNetworkControlsHealth(sourceResult.health)) {
          runner = browserFactory(config, source.id);
          runner.networkControlsStatus = "DEGRADED";
          runner.runtimeWarnings ??= [];
          runner.runtimeWarnings.push("agent-browser network controls failed during adapter execution; retried once with exact-URL navigation and fail-closed final-host/page-drift checks");
          if (!browserNamespaces.includes(runner.namespace)) browserNamespaces.push(runner.namespace);
          continue;
        }
        break;
      }
      results.push(sourceResult);
    }
  } else if (firstRunner) {
    const sourceCleanup = await firstRunner.close().catch(error => ({ sessionsRemaining: 1, warnings: [error.message] }));
    cleanups.push({ source: firstEnabled.id, networkControls: firstRunner.networkControlsStatus, ...sourceCleanup });
  }
  const cleanup = { sessionsRemaining: cleanups.reduce((sum, value) => sum + value.sessionsRemaining, 0), warnings: cleanups.flatMap(value => value.warnings.map(message => `${value.source}: ${message}`)), sources: cleanups };
  if (cleanup.sessionsRemaining || cleanup.warnings.length) warnings.push({ code: "CLEANUP_FAILED", message: cleanup.warnings.join("; ") || `${cleanup.sessionsRemaining} browser session(s) remain` });
  if (results.some(r => ["PARTIAL", "SCHEMA_CHANGED", "CHALLENGE", "TIMEOUT", "HTTP_ERROR", "RESOURCE_BLOCKED"].includes(r.health.status))) warnings.push({ code: "PARTIAL_COVERAGE", message: "At least one source did not provide complete evidence." });

  const stations = results.flatMap(r => r.stations);
  const merged = reconcileStations(stations, config, previous);
  const sourceGroups = Object.fromEntries(config.sources.map(s => [s.id, s.provenanceGroup]));
  const assessments = [];
  for (const station of merged) {
    const memberKeys = new Set(station.members.map(m => `${m.source}:${m.sourceStationId}`));
    const observations = results.flatMap(r => r.observations).filter(o => memberKeys.has(`${o.source}:${o.sourceStationId}`));
    const queueObservations = results.flatMap(r => r.queues).filter(o => memberKeys.has(`${o.source}:${o.sourceStationId}`));
    const activity = deriveActivityEvidence(results.flatMap(r => r.activity).filter(o => memberKeys.has(`${o.source}:${o.sourceStationId}`)), config, fetchedAt);
    const assessment = assessRequestedUnion({ observations, activity, config, sourceGroups, now });
    const anchorLabels = config.area.kind === "station-anchors" ? config.area.anchors.map(a => a.label) : [];
    if (!isInsideArea(station.coordinate, area, { anchorLabels, stationLabel: station.address })) continue;
    assessments.push({ ...station, ...assessment, queue: normalizeQueues(queueObservations, now) });
  }
  const referencePoint = config.ranking.referencePoint ?? centroid(area.polygon);
  const adapterContractHash = await computeAdapterContractHash();
  enforceCompleteness(results, previous, area.areaHash, adapterContractHash, fetchedAt, warnings);
  const snapshot = {
    schemaVersion: 1,
    fetchedAt,
    areaLabel: area.label,
    areaHash: area.areaHash,
    queryHash: sha256(config.requestedProducts),
    adapterContractHash,
    requestedProducts: config.requestedProducts.products.map(p => ({ productKey: p.productKey, variantKey: p.variantKey })),
    assessments,
    rankingReferencePoint: referencePoint,
    rankedStationKeys: rankAssessments(assessments, referencePoint).map(a => a.stationKey),
    sourceHealth: results.map(r => r.health),
    sourceCoverage: Object.fromEntries(results.filter(r => r.coverage).map(r => [r.source, r.coverage])),
    coverageBaselines: nextCoverageBaselines(results, previous, area.areaHash, adapterContractHash, fetchedAt),
    warnings,
    runtime: { browserNamespace: browserNamespaces[0], browserNamespaces, browserMode: config.browser.headed ? "HEADED" : "HEADLESS", health: runtimeHealth, cleanup },
    changes: diffSnapshots(previous, { areaHash: area.areaHash, queryHash: sha256(config.requestedProducts), adapterContractHash, assessments })
  };
  if (outputPath) await writeJsonAtomic(outputPath, snapshot);
  return { snapshot, exitCode: warnings.some(w => w.code === "CLEANUP_FAILED") ? 75 : assessments.length || results.some(r => r.health.status === "OK") ? 0 : 2 };
}

function centroid(points) { const ring = points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1] ? points.slice(0, -1) : points; return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]; }
function isNetworkControlsHealth(health) { return health?.code === "BROWSER_UNAVAILABLE" && /failed to install browser network controls:[\s\S]*CDP error \((?:Runtime\.evaluate|Page\.enable)\)/i.test(String(health.message)); }
const moduleDir = dirname(fileURLToPath(import.meta.url));
async function computeAdapterContractHash() { const names = ["common.mjs", "yandex.mjs", "gdebenz.mjs", "twogis.mjs"]; return sha256((await Promise.all(names.map(name => readFile(resolve(moduleDir, "lib/sources", name), "utf8")))).join("\n---adapter---\n")); }
function baselineKey(source, areaHash, contractHash) { return `${source}:${areaHash}:${contractHash}`; }
export function enforceCompleteness(results, previous, areaHash, contractHash, fetchedAt, warnings) {
  const cutoff = new Date(fetchedAt).getTime() - 90 * 86400000;
  for (const result of results) {
    if (!result.coverage) continue;
    const baseline = previous?.coverageBaselines?.[baselineKey(result.source, areaHash, contractHash)];
    const failures = [];
    if (baseline && new Date(baseline.updatedAt).getTime() >= cutoff && baseline.stationCount >= 4 && result.coverage.stationCount < baseline.stationCount * 0.5) failures.push(`station count ${result.coverage.stationCount} is below 50% of baseline ${baseline.stationCount}`);
    if (result.coverage.duplicateRatio > 0.15) failures.push("duplicate ratio exceeds 15%");
    if (result.coverage.coordinateCoverage < 0.9) failures.push("coordinate coverage is below 90%");
    if (result.coverage.fuelBlockCoverage < 0.2) failures.push("fuel-block coverage is below 20%");
    if (result.coverage.freshnessExpected !== false && result.coverage.timestampCoverage < 0.2) failures.push("timestamp coverage is below 20%");
    if (!failures.length) continue;
    if (result.health.status === "OK") result.health = { ...result.health, status: "PARTIAL", code: "COMPLETENESS_INVARIANT", message: failures.join("; ") };
    warnings.push({ code: failures.some(value => value.startsWith("station count")) ? "STATION_COUNT_REGRESSION" : "COMPLETENESS_INVARIANT", message: `${result.source}: ${failures.join("; ")}` });
  }
}
export function nextCoverageBaselines(results, previous, areaHash, contractHash, fetchedAt) {
  const cutoff = new Date(fetchedAt).getTime() - 90 * 86400000;
  const out = Object.fromEntries(Object.entries(previous?.coverageBaselines ?? {}).filter(([, value]) => new Date(value.updatedAt).getTime() >= cutoff));
  for (const result of results) if (result.health.status === "OK" && result.coverage) { const key = baselineKey(result.source, areaHash, contractHash); const old = out[key]; out[key] = { stationCount: Math.max(old?.stationCount ?? 0, result.coverage.stationCount), updatedAt: fetchedAt }; }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let interrupted;
  const onSigint = () => { interrupted = "SIGINT"; };
  const onSigterm = () => { interrupted = "SIGTERM"; };
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  const result = await collectSnapshot({ configPath: args.config, outputPath: args.output, previousPath: args.previous });
  process.removeListener("SIGINT", onSigint);
  process.removeListener("SIGTERM", onSigterm);
  process.stdout.write(`${stableJson({ snapshot: result.snapshot, exitCode: result.exitCode })}\n`);
  process.exitCode = interrupted === "SIGINT" ? 130 : interrupted === "SIGTERM" ? 143 : result.exitCode;
}
function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i++) { const arg = argv[i]; if (["--config", "--output", "--previous"].includes(arg)) out[arg.slice(2)] = resolve(argv[++i]); else throw new Error(`Unknown argument: ${arg}`); } return out; }
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 2; });
