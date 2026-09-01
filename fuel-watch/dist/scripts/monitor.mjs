#!/usr/bin/env node
import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  prepareMonitoringSnapshot,
  renderReport
} from "./chunks/chunk-OTC7PXRN.mjs";
import "./chunks/chunk-WCGSC67K.mjs";
import {
  ensureUserConfig,
  monitorRoot
} from "./chunks/chunk-NO6Q45EE.mjs";
import {
  defaultBrowserConfigPath,
  defaultConfigPath,
  defaultSchemaPath,
  isMainModule,
  loadConfig,
  readJson,
  stableJson,
  writeJsonAtomic
} from "./chunks/chunk-GQHB3NSD.mjs";
import "./chunks/chunk-XKTP5TT3.mjs";

// scripts/monitor.mjs
import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
var OWNER_FILE = "owner.json";
async function monitorCommand(command, args = {}) {
  if (command === "init") return init(args);
  const stateDir = requireStateDir(args);
  if (command === "cleanup") {
    await assertOwnedStateDir(stateDir);
    await rm(stateDir, { recursive: true, force: false });
    return { cleaned: true, stateDir };
  }
  const state = await readJson(join(stateDir, "state.json"));
  if (command === "recover") return recover(stateDir, state);
  if (command === "status") return { stateDir, state, stopped: await exists(join(stateDir, "STOP")) };
  if (command === "refresh") return refresh(stateDir, state);
  if (command === "due") return { due: Date.now() >= new Date(state.dueAt).getTime(), dueAt: state.dueAt, stopped: await exists(join(stateDir, "STOP")) };
  if (command === "stop") {
    await writeFile(join(stateDir, "STOP"), "stop\n", { flag: "wx" }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    return { stopRequested: true, stateDir };
  }
  if (command === "prepare") return prepare(stateDir, state, args);
  if (command === "commit") return commit(stateDir, state, args);
  throw new Error(`Unknown command: ${command}`);
}
async function init(args) {
  const config = await loadConfig(args.config);
  const monitorId = args["monitor-id"] ?? randomUUID();
  const root = monitorRoot();
  const stateDir = requireSafeLocation(resolve(args["state-dir"] ?? join(root, monitorId)), root);
  await mkdir(root, { recursive: true, mode: 448 });
  await mkdir(stateDir, { mode: 448 });
  await assertRealLocation(stateDir);
  const leasePath = join(stateDir, "lease.json");
  const lease = { monitorId, refreshedAt: (/* @__PURE__ */ new Date()).toISOString(), expiresAt: new Date(Date.now() + 2 * config.monitoring.intervalMinutes * 6e4).toISOString() };
  await writeFile(leasePath, `${JSON.stringify(lease)}
`, { flag: "wx", mode: 384 });
  const state = { schemaVersion: 1, monitorId, generation: 0, dueAt: (/* @__PURE__ */ new Date()).toISOString(), availabilityRuns: [], consecutiveEmptyTicks: 0, configPath: args.config ? resolve(args.config) : void 0 };
  await writeJsonAtomic(join(stateDir, "state.json"), state);
  await writeFile(join(stateDir, OWNER_FILE), `${JSON.stringify({ kind: "fuel-watch-monitor", schemaVersion: 1, monitorId, stateDir })}
`, { flag: "wx", mode: 384 });
  return { monitorId, stateDir, dueAt: state.dueAt };
}
async function recover(stateDir, state) {
  if (await exists(join(stateDir, "STOP"))) return { stopped: true, stateDir };
  const lease = await readJson(join(stateDir, "lease.json"));
  if (lease.monitorId !== state.monitorId) throw new Error("Lease monitor ID mismatch");
  if (Date.now() < new Date(lease.expiresAt).getTime()) return { recovered: true, liveLease: true, pending: state.pending, stateDir };
  await refresh(stateDir, state);
  return { recovered: true, reclaimedExpiredLease: true, pending: state.pending, stateDir };
}
async function refresh(stateDir, state) {
  if (await exists(join(stateDir, "STOP"))) return { stopped: true, stateDir };
  const config = await loadConfig(state.configPath);
  const lease = { monitorId: state.monitorId, refreshedAt: (/* @__PURE__ */ new Date()).toISOString(), expiresAt: new Date(Date.now() + 2 * config.monitoring.intervalMinutes * 6e4).toISOString() };
  await writeJsonAtomic(join(stateDir, "lease.json"), lease);
  return { refreshed: true, expiresAt: lease.expiresAt };
}
async function prepare(stateDir, state, args) {
  if (!args["report-id"] || !args.snapshot) throw new Error("prepare requires --report-id and --snapshot");
  if (state.pending) {
    if (state.pending.reportId === args["report-id"]) return { idempotent: true, pending: state.pending };
    throw new Error("Another report is already pending");
  }
  const snapshot = await readJson(args.snapshot);
  const config = await loadConfig(args.config ?? state.configPath);
  const prepared = prepareMonitoringSnapshot(state, snapshot, config);
  const expectedReportId = renderReport(prepared.snapshot, { monitorId: state.monitorId, generation: state.generation }).reportId;
  if (expectedReportId !== args["report-id"]) throw new Error("Report ID does not match the immutable prepared snapshot");
  const preparedPath = join(stateDir, `prepared-${args["report-id"]}.json`);
  await writeJsonAtomic(preparedPath, prepared.snapshot);
  const freshCount = prepared.snapshot.assessments.filter((a) => a.observations.some((o) => Number.isFinite(o.ageMinutes) && o.ageMinutes <= config.freshness.recentMinutes)).length;
  const next = { ...state, generation: state.generation + 1, dueAt: new Date(new Date(prepared.snapshot.fetchedAt).getTime() + config.monitoring.intervalMinutes * 6e4).toISOString(), previous: prepared.snapshot, availabilityRuns: prepared.availabilityRuns, consecutiveEmptyTicks: freshCount ? 0 : state.consecutiveEmptyTicks + 1 };
  delete next.pending;
  const nextStatePath = join(stateDir, `next-${state.generation + 1}.json`);
  await writeJsonAtomic(nextStatePath, next);
  state.pending = { reportId: args["report-id"], snapshotPath: preparedPath, inputSnapshotPath: resolve(args.snapshot), nextStatePath };
  await writeJsonAtomic(join(stateDir, "state.json"), state);
  return { pending: state.pending, compact: next.consecutiveEmptyTicks >= config.monitoring.compactAfterEmptyTicks };
}
async function commit(stateDir, state, args) {
  if (!state.pending || state.pending.reportId !== args["report-id"]) throw new Error("Pending report ID mismatch");
  const next = await readJson(state.pending.nextStatePath);
  await writeJsonAtomic(join(stateDir, "state.json"), next);
  if (next.previous) await writeJsonAtomic(join(stateDir, "previous.json"), next.previous);
  await rm(state.pending.nextStatePath, { force: true });
  await rm(state.pending.snapshotPath, { force: true });
  await refresh(stateDir, next);
  return { committed: true, generation: next.generation, dueAt: next.dueAt };
}
function requireStateDir(args) {
  if (!args["state-dir"]) throw new Error("--state-dir is required");
  return requireSafeLocation(resolve(args["state-dir"]), monitorRoot());
}
function requireSafeLocation(stateDir, root) {
  const rel = relative(root, stateDir);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`State directory must be a child of ${root}`);
  return stateDir;
}
async function assertRealLocation(stateDir) {
  const root = monitorRoot();
  const info = await lstat(stateDir);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("State directory must be a real directory, not a symlink");
  const [rootPath, statePath] = await Promise.all([realpath(root), realpath(stateDir)]);
  const rel = relative(rootPath, statePath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("State directory resolves outside the Fuel Watch monitor root");
}
async function assertOwnedStateDir(stateDir) {
  await assertRealLocation(stateDir);
  const [owner, state, lease] = await Promise.all([readJson(join(stateDir, OWNER_FILE)), readJson(join(stateDir, "state.json")), readJson(join(stateDir, "lease.json"))]);
  if (owner.kind !== "fuel-watch-monitor" || owner.schemaVersion !== 1 || state.schemaVersion !== 1 || !owner.monitorId || owner.monitorId !== state.monitorId || owner.monitorId !== lease.monitorId || owner.stateDir !== stateDir) throw new Error("Refusing cleanup: Fuel Watch ownership validation failed");
}
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const args = parseArgs(argv);
  if (command === "init" && !args.config) args.config = await ensureUserConfig({ templateConfigPath: defaultConfigPath, templateBrowserConfigPath: defaultBrowserConfigPath, templateSchemaPath: defaultSchemaPath });
  process.stdout.write(`${stableJson(await monitorCommand(command, args))}
`);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--state-dir", "--monitor-id", "--report-id", "--snapshot", "--config"].includes(arg)) out[arg.slice(2)] = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}
if (isMainModule(import.meta.url)) main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}
`);
  process.exitCode = 2;
});
export {
  monitorCommand
};
