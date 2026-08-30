#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserRunner } from "./lib/browser-runner.mjs";
import { deriveActivityEvidence } from "./lib/activity.mjs";
import { loadConfig } from "./lib/config.mjs";
import { diffSnapshots } from "./lib/diff.mjs";
import { resolveArea, isInsideArea } from "./lib/geometry.mjs";
import { reconcileStations } from "./lib/identity.mjs";
import { normalizeQueues } from "./lib/queue.mjs";
import { rankAssessments } from "./lib/ranking.mjs";
import { readJson, sha256, stableJson } from "./lib/util.mjs";
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
  const runner = browserFactory(config);
  const results = [];
  const warnings = [];
  let cleanup;
  try {
    await runner.probe();
    for (const source of [...config.sources].sort((a, b) => a.order - b.order)) {
      if (!source.enabled) { results.push({ source: source.id, health: { source: source.id, status: "DISABLED" }, stations: [], observations: [], queues: [], activity: [] }); continue; }
      try {
        const adapter = await adapters[source.id]();
        results.push(await adapter.collect(request, { browser: runner, previous, config }));
      } catch (error) {
        results.push({ source: source.id, health: { source: source.id, status: "PARTIAL", code: "INTERNAL_ADAPTER_ERROR", message: error.message }, stations: [], observations: [], queues: [], activity: [] });
      }
    }
  } catch (error) {
    for (const source of config.sources) results.push({ source: source.id, health: { source: source.id, status: source.enabled ? "TIMEOUT" : "DISABLED", code: source.enabled ? (error.code ?? "BROWSER_UNAVAILABLE") : undefined, message: source.enabled ? error.message : undefined }, stations: [], observations: [], queues: [], activity: [] });
  } finally {
    cleanup = await runner.close().catch(error => ({ sessionsRemaining: 1, warnings: [error.message] }));
  }
  if (cleanup.sessionsRemaining || cleanup.warnings.length) warnings.push({ code: "CLEANUP_FAILED", message: cleanup.warnings.join("; ") || `${cleanup.sessionsRemaining} browser session(s) remain` });
  if (results.some(r => ["PARTIAL", "SCHEMA_CHANGED", "CHALLENGE", "TIMEOUT", "HTTP_ERROR", "RESOURCE_BLOCKED"].includes(r.health.status))) warnings.push({ code: "PARTIAL_COVERAGE", message: "At least one source did not provide complete evidence." });

  const stations = results.flatMap(r => r.stations);
  const merged = reconcileStations(stations, config);
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
  const snapshot = {
    schemaVersion: 1,
    fetchedAt,
    areaLabel: area.label,
    areaHash: area.areaHash,
    queryHash: sha256(config.requestedProducts),
    adapterContractHash: sha256("fuel-watch-adapters-v1"),
    requestedProducts: config.requestedProducts.products.map(p => ({ productKey: p.productKey, variantKey: p.variantKey })),
    assessments,
    rankedStationKeys: rankAssessments(assessments, referencePoint).map(a => a.stationKey),
    sourceHealth: results.map(r => r.health),
    warnings,
    runtime: { browserNamespace: runner.namespace, cleanup },
    changes: diffSnapshots(previous, { areaHash: area.areaHash, queryHash: sha256(config.requestedProducts), assessments })
  };
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  return { snapshot, exitCode: warnings.some(w => w.code === "CLEANUP_FAILED") ? 75 : assessments.length || results.some(r => r.health.status === "OK") ? 0 : 2 };
}

function centroid(points) { const ring = points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1] ? points.slice(0, -1) : points; return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]; }

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
