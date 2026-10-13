import { constants } from "node:fs";
import { appendFile, copyFile, link, mkdir, open, readdir, readFile, stat, unlink, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import properLockfile from "proper-lockfile";
import { normalizeFuelLabel, petrolOctaneKey } from "./fuels.mjs";
import { compileBrandAliases, normalizeBrand, normalizeComparableBrand } from "./normalize.mjs";
import { readJson, writeJsonAtomic } from "./util.mjs";
import { historyPath } from "./paths.mjs";

const POSITIVE = new Set(["AVAILABLE", "LIKELY_AVAILABLE"]);
const NEGATIVE = "NOT_AVAILABLE";
// Retention is how long ticks are kept; the forecast that runs on every collection only reads a recent window, so a
// long retention costs disk, not per-tick memory or time. Statistics over the whole retention stream day files.
export const FORECAST_WINDOW_MAX_DAYS = 28;
const EVENT_KINDS = new Set(["SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"]);
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
// Activity rows repeat the same long field names in every tick; on disk they use these short aliases.
const ACTIVITY_KEYS = { source: "s", productKey: "p", gradeLabel: "g", kind: "k", status: "st", observedAt: "o", resumedAt: "r", latestEventAt: "l", windowMinutes: "w", count: "c", gradeSpecific: "gs", sourceTerminology: "t" };
const ACTIVITY_FIELDS = Object.fromEntries(Object.entries(ACTIVITY_KEYS).map(([field, alias]) => [alias, field]));
const packActivity = value => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([field, item]) => [ACTIVITY_KEYS[field] ?? field, item]));
const unpackActivity = value => Object.fromEntries(Object.entries(value).map(([alias, item]) => [ACTIVITY_FIELDS[alias] ?? alias, item]));

export function forecastWindowDays(config) { return Math.min(config.history.retentionDays, FORECAST_WINDOW_MAX_DAYS); }

// Storage v2: the history path is a small manifest; ticks are appended one JSON line each to a file per UTC day
// next to it, and station display metadata (title, address, brand, coordinate) lives once in a dictionary instead
// of in every tick. Writing is one appended line however long the retention is; reading is bounded by the forecast
// window, not by the retention.
export function historyLayout(path) {
  const base = path.endsWith(".json") ? path.slice(0, -5) : path;
  return { manifest: path, ticksDir: `${base}.ticks`, stations: `${base}.stations.json`, v1Backup: `${base}.v1-backup.json` };
}

export function defaultHistoryPath(env = process.env) {
  return historyPath(env);
}

export async function ensureDefaultHistoryPath(env = process.env) {
  const target = defaultHistoryPath(env);
  if (env.FUEL_WATCH_HISTORY_PATH) return target;
  const legacyRoot = env.XDG_STATE_HOME ? resolve(env.XDG_STATE_HOME) : join(env.HOME || homedir(), ".local", "state");
  const legacy = join(legacyRoot, "fuel-watch", "history.json");
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  try { await copyFile(legacy, target, constants.COPYFILE_EXCL); }
  catch (error) { if (!['ENOENT', 'EEXIST'].includes(error.code)) throw error; }
  return target;
}

export async function recordHistory(path, snapshot, config, { lock = properLockfile.lock } = {}) {
  return withHistoryLock(path, async assertLockHealthy => {
    const now = new Date(snapshot.fetchedAt);
    if (!Number.isFinite(now.getTime())) throw new Error("snapshot fetchedAt is invalid");
    const retentionDays = config.history.retentionDays;
    const windowDays = forecastWindowDays(config);
    const layout = historyLayout(path);
    const manifest = await loadManifest(layout, assertLockHealthy);
    const referenceMs = Math.max(now.getTime(), new Date(manifest.updatedAt ?? 0).getTime() || 0);
    const cutoff = referenceMs - retentionDays * 86400000;
    const windowCutoff = Math.max(cutoff, referenceMs - windowDays * 86400000);
    const dictionary = await loadStationDictionary(layout);
    const recent = (await readTickFiles(layout, { sinceMs: windowCutoff, dictionary })).ticks;
    const tick = compactTick(snapshot, cutoff);
    const duplicate = recent.some(value => value.fetchedAt === tick.fetchedAt && value.areaHash === tick.areaHash && value.queryHash === tick.queryHash);
    for (const [key, value] of Object.entries(dictionary.stations)) if (new Date(value.lastSeenAt).getTime() < cutoff) delete dictionary.stations[key];
    // The dictionary is written before the tick that refers to it, so a crash in between can leave an unused entry
    // but never a stored station without its title, address and brand.
    if (!duplicate) rememberStations(dictionary, tick);
    assertLockHealthy();
    await writeJsonAtomic(layout.stations, dictionary);
    if (!duplicate) {
      await appendLine(join(layout.ticksDir, `${dayKey(tick.fetchedAt)}.jsonl`), storedTick(tick, seenEvents(recent), dictionary));
      recent.push(tick);
    }
    await pruneDayFiles(layout, cutoff);
    const updatedAt = new Date(Math.max(referenceMs, now.getTime())).toISOString();
    assertLockHealthy();
    await writeJsonAtomic(layout.manifest, { schemaVersion: 2, layout: "daily-jsonl", retentionDays, updatedAt });
    assertLockHealthy();
    recent.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
    const history = { schemaVersion: 2, retentionDays, windowDays, updatedAt, ticks: recent.filter(value => new Date(value.fetchedAt).getTime() >= windowCutoff) };
    const forecast = buildForecast(history, snapshot, config, { windowDays });
    return { history, forecast };
  }, lock);
}

// Read-only access for statistics and tests: ticks since a moment, rehydrated with the station dictionary. A
// legacy v1 file is read as it is; it is converted by the next collection, which holds the history lock.
export async function readHistory(path, { sinceMs = -Infinity } = {}) {
  const layout = historyLayout(path);
  let manifest;
  try { manifest = await readJson(layout.manifest); }
  catch (error) { if (error.code === "ENOENT") return { schemaVersion: 2, ticks: [], corruptLines: 0, stations: {} }; throw error; }
  if (manifest.schemaVersion === 1 && Array.isArray(manifest.ticks)) return { ...manifest, ticks: manifest.ticks.filter(tick => new Date(tick.fetchedAt).getTime() >= sinceMs), corruptLines: 0, stations: {} };
  if (manifest.schemaVersion !== 2) throw new Error("unsupported history schema");
  const dictionary = await readerDictionary(layout);
  const { ticks, corruptLines } = await readTickFiles(layout, { sinceMs, dictionary });
  ticks.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
  return { ...manifest, ticks, corruptLines, stations: dictionary.stations };
}

// Streams the retained day files oldest first, one day in memory at a time, for statistics over a long retention.
// Expired ticks still sitting in the oldest, partly expired day file are skipped, as the forecast would skip them.
export async function forEachHistoryDay(path, { sinceMs: requestedSinceMs = -Infinity } = {}, visit) {
  const layout = historyLayout(path);
  const manifest = await readJson(layout.manifest).catch(error => { if (error.code === "ENOENT") return undefined; throw error; });
  if (!manifest) return { days: 0, corruptLines: 0, stations: {} };
  const retainedSinceMs = Date.parse(manifest.updatedAt) - manifest.retentionDays * 86400000;
  const sinceMs = Number.isFinite(retainedSinceMs) ? Math.max(requestedSinceMs, retainedSinceMs) : requestedSinceMs;
  if (manifest.schemaVersion === 1) { const value = await readHistory(path, { sinceMs }); await visit(value.ticks, "legacy"); return { days: 1, corruptLines: 0, stations: {} }; }
  const dictionary = await readerDictionary(layout);
  let corruptLines = 0, days = 0;
  for (const day of await dayFiles(layout)) {
    if (day.endMs < sinceMs) continue;
    const parsed = await readDayFile(join(layout.ticksDir, day.name), dictionary);
    corruptLines += parsed.corruptLines;
    days += 1;
    await visit(parsed.ticks.filter(tick => new Date(tick.fetchedAt).getTime() >= sinceMs).sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt)), day.key);
  }
  return { days, corruptLines, stations: dictionary.stations };
}

async function loadManifest(layout, assertLockHealthy) {
  let value;
  try { value = await readJson(layout.manifest); }
  catch (error) { if (error.code === "ENOENT") return { schemaVersion: 2 }; throw error; }
  if (value.schemaVersion === 2) return value;
  if (value.schemaVersion !== 1 || !Array.isArray(value.ticks)) throw new Error("unsupported history schema");
  return migrateV1(layout, value, assertLockHealthy);
}

// One-time conversion under the history lock. The v1 file is copied aside first and the manifest is replaced last,
// so a crash in between leaves a v1 manifest and the conversion simply runs again, rewriting the same day files.
async function migrateV1(layout, legacy, assertLockHealthy) {
  // The backup appears complete or not at all: a copy cut short by a crash must not be kept as "the backup".
  const temp = `${layout.v1Backup}.${process.pid}.${randomUUID()}.tmp`;
  await copyFile(layout.manifest, temp);
  try { await link(temp, layout.v1Backup); }
  catch (error) {
    if (error.code === "EEXIST") { /* an earlier, interrupted conversion already kept the original */ }
    // A filesystem without hard links: rename is atomic too, but would replace a backup that already exists.
    else if (["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EXDEV"].includes(error.code)) { if (!(await stat(layout.v1Backup).catch(() => undefined))) await rename(temp, layout.v1Backup); }
    else throw error;
  } finally { await unlink(temp).catch(() => {}); }
  const dictionary = { schemaVersion: 1, stations: {} };
  const byDay = new Map();
  const seen = new Map();
  for (const tick of [...legacy.ticks].sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt))) {
    if (!Number.isFinite(new Date(tick.fetchedAt).getTime())) continue;
    rememberStations(dictionary, tick);
    const stored = storedTick(tick, seen, dictionary);
    for (const station of tick.stations ?? []) for (const value of station.activity ?? []) if (EVENT_KINDS.has(value.kind)) eventSet(seen, eventScope(tick, station)).add(eventKey(value));
    const key = dayKey(tick.fetchedAt);
    byDay.set(key, `${byDay.get(key) ?? ""}${JSON.stringify(stored)}\n`);
  }
  await mkdir(layout.ticksDir, { recursive: true, mode: 0o700 });
  for (const [key, text] of byDay) await writeTextAtomic(join(layout.ticksDir, `${key}.jsonl`), text);
  assertLockHealthy();
  await writeJsonAtomic(layout.stations, dictionary);
  const manifest = { schemaVersion: 2, layout: "daily-jsonl", retentionDays: legacy.retentionDays, updatedAt: legacy.updatedAt, migratedFromV1At: new Date().toISOString() };
  await writeJsonAtomic(layout.manifest, manifest);
  return manifest;
}

// Readers do not hold the lock: a collection may write the dictionary and append its tick after the reader loaded
// the dictionary, so a station key it does not know yet triggers one reload (the dictionary is written first).
async function readerDictionary(layout) {
  const dictionary = await loadStationDictionary(layout);
  dictionary.refresh = async () => { dictionary.refresh = undefined; dictionary.stations = (await loadStationDictionary(layout)).stations; };
  return dictionary;
}

async function loadStationDictionary(layout) {
  try {
    const value = await readJson(layout.stations);
    return value && typeof value.stations === "object" && value.stations ? value : { schemaVersion: 1, stations: {} };
  } catch (error) { if (error.code === "ENOENT") return { schemaVersion: 1, stations: {} }; throw error; }
}

// Display fields follow the latest sighting, but title and brand also train the brand-level forecast, so every
// distinct (title, brand) pair a key was seen with is kept and each stored tick points at its own pair.
function rememberStations(dictionary, tick) {
  for (const station of tick.stations ?? []) {
    if (!station.stationKey) continue;
    const old = dictionary.stations[station.stationKey];
    const newer = !old || new Date(tick.fetchedAt) >= new Date(old.lastSeenAt);
    const labels = old?.labels ?? (old ? [[old.title ?? null, old.brand ?? null]] : []);
    if (labelIndex(labels, station) < 0) labels.push([station.title ?? null, station.brand ?? null]);
    dictionary.stations[station.stationKey] = {
      title: newer ? station.title ?? old?.title : old.title, address: newer ? station.address ?? old?.address : old.address,
      brand: newer ? station.brand ?? old?.brand : old.brand, coordinate: newer ? station.coordinate ?? old?.coordinate : old.coordinate,
      firstSeenAt: old && new Date(old.firstSeenAt) < new Date(tick.fetchedAt) ? old.firstSeenAt : tick.fetchedAt,
      lastSeenAt: newer ? tick.fetchedAt : old.lastSeenAt,
      labels
    };
  }
}
function labelIndex(labels, station) { return labels.findIndex(([title, brand]) => title === (station.title ?? null) && brand === (station.brand ?? null)); }

// Display metadata goes to the dictionary (the tick keeps only the index of its title/brand pair when it is not
// the first) and a source-reported event is stored in the first tick of the same area and query that saw it rather
// than in every tick the source repeats it: the forecast reads one area and the statistics one area and query, so
// an event first seen under another area must be stored again. Per-variant product verdicts are not kept: neither
// the forecast nor the statistics use them (variants are collapsed into one AI-95 for the user).
function storedTick(tick, seen, dictionary) {
  return {
    fetchedAt: tick.fetchedAt, areaHash: tick.areaHash, queryHash: tick.queryHash, ...(tick.sources ? { sources: tick.sources } : {}),
    stations: (tick.stations ?? []).map(station => {
      const known = seen.get(eventScope(tick, station));
      const activity = (station.activity ?? []).filter(value => !(EVENT_KINDS.has(value.kind) && known?.has(eventKey(value)))).map(packActivity);
      const label = labelIndex(dictionary.stations[station.stationKey]?.labels ?? [], station);
      return { stationKey: station.stationKey, memberKeys: station.memberKeys, verdict: station.verdict, confidence: station.confidence, ...(label > 0 ? { label } : {}), activity };
    })
  };
}

function seenEvents(ticks) {
  const seen = new Map();
  for (const tick of ticks) for (const station of tick.stations ?? []) for (const value of station.activity ?? []) if (EVENT_KINDS.has(value.kind)) eventSet(seen, eventScope(tick, station)).add(eventKey(value));
  return seen;
}
function eventScope(tick, station) { return JSON.stringify([tick.areaHash ?? null, tick.queryHash ?? null, station.stationKey ?? null]); }
function eventKey(value) { return JSON.stringify(Object.keys(ACTIVITY_KEYS).map(field => value[field] ?? null)); }
function eventSet(map, key) { if (!map.has(key)) map.set(key, new Set()); return map.get(key); }

function rehydrate(stored, dictionary) {
  return { ...stored, stations: (stored.stations ?? []).map(({ label, ...station }) => {
    const meta = dictionary.stations[station.stationKey] ?? {};
    const [title, brand] = meta.labels?.[label ?? 0] ?? [meta.title, meta.brand];
    return { ...station, title: title ?? undefined, address: meta.address, brand: brand ?? undefined, coordinate: meta.coordinate, activity: (station.activity ?? []).map(unpackActivity) };
  }) };
}

async function dayFiles(layout) {
  let names;
  try { names = await readdir(layout.ticksDir); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  return names.map(name => name.match(DAY_FILE)).filter(Boolean).map(match => ({ name: match[0], key: match[1], endMs: Date.parse(`${match[1]}T00:00:00Z`) + 86400000 })).sort((a, b) => a.key.localeCompare(b.key));
}

async function readTickFiles(layout, { sinceMs, dictionary }) {
  const ticks = [];
  let corruptLines = 0;
  for (const day of await dayFiles(layout)) {
    if (day.endMs < sinceMs) continue;
    const parsed = await readDayFile(join(layout.ticksDir, day.name), dictionary);
    corruptLines += parsed.corruptLines;
    for (const tick of parsed.ticks) if (new Date(tick.fetchedAt).getTime() >= sinceMs) ticks.push(tick);
  }
  return { ticks, corruptLines };
}

// A line torn by a crash is skipped instead of failing the whole history; appendLine never glues onto it.
async function readDayFile(path, dictionary) {
  const ticks = [];
  let corruptLines = 0;
  // Readers do not hold the lock, so a day pruned by a concurrent collection between listing and reading is empty.
  const text = await readFile(path, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; });
  const stored = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { const value = JSON.parse(line); if (Array.isArray(value?.stations) && value.fetchedAt) stored.push(value); else corruptLines += 1; }
    catch { corruptLines += 1; }
  }
  if (dictionary.refresh && stored.some(value => value.stations.some(station => station.stationKey && !dictionary.stations[station.stationKey]))) await dictionary.refresh();
  for (const value of stored) ticks.push(rehydrate(value, dictionary));
  return { ticks, corruptLines };
}

async function appendLine(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let separator = "";
  try {
    const handle = await open(path, "r");
    try { const { size } = await handle.stat(); if (size > 0) { const last = Buffer.alloc(1); await handle.read(last, 0, 1, size - 1); if (last[0] !== 0x0a) separator = "\n"; } }
    finally { await handle.close(); }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  await appendFile(path, `${separator}${JSON.stringify(value)}\n`, { mode: 0o600 });
}

async function pruneDayFiles(layout, cutoffMs) {
  for (const day of await dayFiles(layout)) if (day.endMs <= cutoffMs) await unlink(join(layout.ticksDir, day.name)).catch(error => { if (error.code !== "ENOENT") throw error; });
  // Temporary files of a conversion interrupted by a crash; anything this old is no longer being written.
  const own = `${basename(layout.ticksDir).slice(0, -"ticks".length)}`;
  for (const [directory, prefix] of [[layout.ticksDir, ""], [dirname(layout.manifest), own]]) {
    const names = await readdir(directory).catch(error => { if (error.code === "ENOENT") return []; throw error; });
    for (const name of names.filter(value => value.startsWith(prefix) && value.endsWith(".tmp"))) {
      const path = join(directory, name);
      const info = await stat(path).catch(() => undefined);
      if (info?.isFile() && Date.now() - info.mtimeMs > 3600000) await unlink(path).catch(() => {});
    }
  }
}

async function writeTextAtomic(path, text) {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, text, { mode: 0o600 });
  await rename(temp, path);
}

function dayKey(value) { return new Date(value).toISOString().slice(0, 10); }

async function withHistoryLock(path, operation, lock) {
  const lockPath = `${path}.lock`;
  const reclaimPath = `${lockPath}.reclaim`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await recoverLegacyFileLock(reclaimPath);
  await recoverLegacyFileLock(lockPath);
  let release;
  let compromised;
  const assertLockHealthy = () => { if (compromised) throw Object.assign(new Error(`History lock was compromised: ${compromised.message ?? compromised}`), { code: "HISTORY_LOCK_COMPROMISED", cause: compromised }); };
  try {
    release = await lock(path, { realpath: false, stale: 30000, update: 10000, retries: { retries: 250, factor: 1, minTimeout: 20, maxTimeout: 20, randomize: false }, onCompromised: error => { compromised ??= error; } });
  } catch (error) {
    if (error.code === "ELOCKED") throw Object.assign(new Error(`Timed out waiting for history lock: ${lockPath}`), { code: "HISTORY_LOCK_TIMEOUT", cause: error });
    throw error;
  }
  try { assertLockHealthy(); return await operation(assertLockHealthy); }
  finally {
    try { await release(); }
    catch (error) { if (!compromised || !["ERELEASED", "ENOTACQUIRED"].includes(error.code)) throw error; }
    finally { assertLockHealthy(); }
  }
}

async function recoverLegacyFileLock(path) {
  const [raw, info] = await Promise.all([readFile(path, "utf8"), stat(path)]).catch(error => error.code === "ENOENT" || error.code === "EISDIR" ? [] : Promise.reject(error));
  if (!raw || !info?.isFile()) return;
  let holder;
  try { holder = JSON.parse(raw); } catch { holder = undefined; }
  const recoverable = Number.isInteger(holder?.pid) ? !isProcessAlive(holder.pid) : Date.now() - info.mtimeMs > 30000;
  if (recoverable) await unlink(path).catch(error => { if (!['ENOENT','EISDIR','EPERM'].includes(error.code)) throw error; });
}

function isProcessAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

export function buildForecast(history, snapshot, config, { windowDays = config.history.retentionDays } = {}) {
  const brandAliases = compileBrandAliases(config.identity.brandAliases);
  const nowMs = new Date(snapshot.fetchedAt).getTime();
  const cutoffMs = nowMs - windowDays * 86400000;
  const retainedTicks = history.ticks.filter(tick => new Date(tick.fetchedAt).getTime() >= cutoffMs);
  const areaTicks = retainedTicks.filter(tick => tick.areaHash === snapshot.areaHash);
  const scopedTicks = retainedTicks.filter(tick => tick.areaHash === snapshot.areaHash && tick.queryHash === snapshot.queryHash);
  const identity = buildHistoryIdentity(areaTicks);
  const episodes = completedEpisodes(scopedTicks, config.monitoring.intervalMinutes * 3, identity, brandAliases);
  const rollingEvents = rollingActivityEvents(areaTicks, config, identity, brandAliases);
  const sourceEvents = sourceTimelineEvents(areaTicks, config, identity, brandAliases, cutoffMs, nowMs);
  const statusEvents = petrolStatusEvents(areaTicks, config, identity, brandAliases);
  // A station that does not sell the requested grade at all has no shortage to end, so the delivery-model
  // inference "a tanker arrived, therefore AI-95 is probably back" must not be applied to it.
  const candidates = snapshot.assessments.filter(assessment => assessment.verdict === NEGATIVE && assessment.sellsRequestedFamily !== false).map(assessment => {
    const samples = stationSamples(scopedTicks, assessment, identity);
    const negativeStartedAt = currentNegativeStart(samples, config.monitoring.intervalMinutes * 3);
    if (!negativeStartedAt) return null;
    const brand = stationBrand(assessment, brandAliases);
    const activity = selectTimePattern(rollingEvents, assessment, brand, identity) ?? selectTimePattern(sourceEvents, assessment, brand, identity) ?? selectTimePattern(statusEvents, assessment, brand, identity);
    if (activity) return forecastFromActivity(assessment, negativeStartedAt, activity, nowMs);
    const selected = selectDurationPattern(episodes, assessment, brand, identity);
    if (!selected) return null;
    return forecastFromStatus(assessment, negativeStartedAt, selected, nowMs);
  }).filter(Boolean).sort((a, b) => new Date(a.expectedAt) - new Date(b.expectedAt)).slice(0, config.history.forecastCount);
  return { generatedAt: snapshot.fetchedAt, retentionDays: config.history.retentionDays, windowDays, requestedCount: config.history.forecastCount, tickCount: areaTicks.length, completedEpisodeCount: episodes.length, activityEventCount: rollingEvents.length, sourceTimelineEventCount: sourceEvents.length, petrolStatusEventCount: statusEvents.length, items: candidates };
}

function compactTick(snapshot, cutoffMs = -Infinity) {
  const keepActivity = value => {
    if (!["ROLLING_SIGNAL_COUNT", "PETROL_STATUS_SNAPSHOT", "SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"].includes(value.kind)) return false;
    if (!["SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"].includes(value.kind)) return true;
    const eventMs = new Date(sourceEventAt(value)).getTime();
    return Number.isFinite(eventMs) && eventMs >= cutoffMs;
  };
  const sources = Array.isArray(snapshot.sourceHealth) ? Object.fromEntries(snapshot.sourceHealth.map(health => [health.source, health.status])) : undefined;
  return { fetchedAt: snapshot.fetchedAt, areaHash: snapshot.areaHash, queryHash: snapshot.queryHash, ...(sources ? { sources } : {}), stations: snapshot.assessments.map(assessment => ({ stationKey: assessment.stationKey, memberKeys: (assessment.members ?? []).map(member => `${member.source}:${member.sourceStationId}`).sort(), title: assessment.title, address: assessment.address, brand: assessment.brand, coordinate: assessment.coordinate, verdict: assessment.verdict, confidence: assessment.confidence, activity: (assessment.activity ?? []).filter(keepActivity).map(value => ({ source: value.source, productKey: value.product?.productKey, gradeLabel: value.gradeLabel, kind: value.kind, status: value.status, observedAt: value.observedAt, resumedAt: value.resumedAt, latestEventAt: value.latestEventAt, windowMinutes: value.windowMinutes, count: value.count, gradeSpecific: value.gradeSpecific, sourceTerminology: value.sourceTerminology })) })) };
}

function sourceTimelineEvents(ticks, config, identity, brandAliases, cutoffMs, nowMs) {
  const rawEvents = [];
  const seen = new Set();
  for (const tick of ticks) for (const station of identity.stations(tick)) for (const summary of station.activity ?? []) {
    if (!["SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"].includes(summary.kind) || !summary.gradeSpecific) continue;
    const grade = petrolOctaneKey(summary);
    const at = sourceEventAt(summary);
    const atMs = new Date(at).getTime();
    if (!grade || !Number.isFinite(atMs) || atMs < cutoffMs || atMs > nowMs + config.freshness.futureSkewSeconds * 1000) continue;
    const identityId = identity.id(station);
    const eventKey = `${identityId}|${summary.source}|${grade}|${new Date(atMs).toISOString()}`;
    if (seen.has(eventKey)) continue;
    seen.add(eventKey);
    rawEvents.push({ identityId, brand: stationBrand(station, brandAliases), atMs, grade, source: summary.source, kind: summary.kind });
  }
  const clusterGapMs = Math.max(config.activity.resumeWindowMinutes, config.activity.quietGapMinutes * 2) * 60000;
  const clusters = [];
  for (const event of rawEvents.sort((a, b) => a.identityId.localeCompare(b.identityId) || a.atMs - b.atMs)) {
    const current = clusters.at(-1);
    if (!current || current.identityId !== event.identityId || event.atMs - current.lastAtMs > clusterGapMs) clusters.push({ identityId: event.identityId, brand: event.brand, atMs: event.atMs, lastAtMs: event.atMs, grades: new Set([event.grade]), sources: new Set([event.source]), kinds: new Set([event.kind]) });
    else { current.lastAtMs = Math.max(current.lastAtMs, event.atMs); current.grades.add(event.grade); current.sources.add(event.source); current.kinds.add(event.kind); }
  }
  return clusters.map(value => ({ identityId: value.identityId, brand: value.brand, at: new Date(value.atMs).toISOString(), gradeCount: value.grades.size, confidence: value.grades.size >= 2 || value.sources.size >= 2 ? "MEDIUM" : "LOW", signalBasis: value.kinds.has("TRANSACTIONS_RESUMED") ? "SOURCE_ACTIVITY_TIMELINE" : "SOURCE_REPORTED_STATUS" }));
}

function rollingActivityEvents(ticks, config, identity, brandAliases) {
  const previous = new Map();
  const groups = new Map();
  for (const tick of ticks) for (const station of identity.stations(tick)) for (const summary of aggregateRollingByOctane(station.activity)) {
    const grade = summary.grade;
    const identityId = identity.id(station);
    const key = `${identityId}|${summary.source}|${grade}`;
    const before = previous.get(key);
    const tickMs = new Date(tick.fetchedAt).getTime();
    const latestMs = new Date(summary.latestEventAt).getTime();
    const closeTicks = before && tickMs - before.tickMs <= config.monitoring.intervalMinutes * 3 * 60000;
    const recentEvent = Number.isFinite(latestMs) && tickMs - latestMs >= -config.freshness.futureSkewSeconds * 1000 && tickMs - latestMs <= config.activity.resumeWindowMinutes * 60000;
    const witnessed = before && [...summary.variantCounts].some(([variant, count]) => count > 0 && before.summary.variantCounts.get(variant) === 0);
    if (closeTicks && witnessed && before.summary.windowMinutes >= config.activity.quietGapMinutes && before.summary.count === 0 && summary.count >= config.activity.minimumEvents && recentEvent) {
      const groupKey = `${identityId}|${tick.fetchedAt}`;
      const group = groups.get(groupKey) ?? { identityId, brand: stationBrand(station, brandAliases), at: summary.latestEventAt, grades: new Set(), totalCount: 0 };
      group.grades.add(grade);
      group.totalCount += summary.count;
      if (new Date(summary.latestEventAt) > new Date(group.at)) group.at = summary.latestEventAt;
      groups.set(groupKey, group);
    }
    previous.set(key, { tickMs, summary });
  }
  return [...groups.values()].map(value => ({ identityId: value.identityId, brand: value.brand, at: value.at, gradeCount: value.grades.size, totalCount: value.totalCount, confidence: value.grades.size >= 2 || value.totalCount >= config.activity.strongSignalCountPerHour ? "MEDIUM" : "LOW", signalBasis: "ROLLING_ACTIVITY" }));
}

function petrolStatusEvents(ticks, config, identity, brandAliases) {
  const previous = new Map();
  const groups = new Map();
  for (const tick of ticks) for (const station of identity.stations(tick)) for (const summary of aggregateStatusesByOctane(station.activity)) {
    const grade = summary.grade;
    const identityId = identity.id(station);
    const key = `${identityId}|${summary.source}|${grade}`;
    const before = previous.get(key);
    const tickMs = new Date(tick.fetchedAt).getTime();
    const closeTicks = before && tickMs - before.tickMs <= config.monitoring.intervalMinutes * 3 * 60000;
    const witnessed = before && [...summary.variantStatuses].some(([variant, status]) => ["IN_STOCK", "LIMITED"].includes(status) && before.summary.variantStatuses.get(variant) === "OUT_OF_STOCK");
    if (closeTicks && witnessed && before.summary.status === "OUT_OF_STOCK" && ["IN_STOCK", "LIMITED"].includes(summary.status)) {
      const groupKey = `${identityId}|${tick.fetchedAt}`;
      const group = groups.get(groupKey) ?? { identityId, brand: stationBrand(station, brandAliases), at: tick.fetchedAt, grades: new Set() };
      group.grades.add(grade);
      groups.set(groupKey, group);
    }
    previous.set(key, { tickMs, summary });
  }
  return [...groups.values()].map(value => ({ identityId: value.identityId, brand: value.brand, at: value.at, gradeCount: value.grades.size, confidence: value.grades.size >= 2 ? "MEDIUM" : "LOW", signalBasis: "PETROL_STATUS_PATTERN" }));
}

function aggregateRollingByOctane(activity = []) {
  const grouped = new Map();
  for (const summary of activity) {
    if (!summary.gradeSpecific || !Number.isFinite(summary.count) || !Number.isFinite(summary.windowMinutes)) continue;
    const grade = petrolOctaneKey(summary);
    if (!grade) continue;
    const key = `${summary.source}\u0000${grade}`;
    const aggregate = grouped.get(key) ?? { source: summary.source, grade, count: 0, windowMinutes: Infinity, latestEventAt: undefined, variantCounts: new Map() };
    aggregate.count += summary.count;
    aggregate.windowMinutes = Math.min(aggregate.windowMinutes, summary.windowMinutes);
    if (isLaterTimestamp(summary.latestEventAt, aggregate.latestEventAt)) aggregate.latestEventAt = summary.latestEventAt;
    const variant = activityVariantKey(summary);
    if (variant) aggregate.variantCounts.set(variant, (aggregate.variantCounts.get(variant) ?? 0) + summary.count);
    grouped.set(key, aggregate);
  }
  return [...grouped.values()];
}

function aggregateStatusesByOctane(activity = []) {
  const grouped = new Map();
  for (const summary of activity) {
    if (summary.kind !== "PETROL_STATUS_SNAPSHOT" || !summary.gradeSpecific) continue;
    const grade = petrolOctaneKey(summary);
    if (!grade) continue;
    const key = `${summary.source}\u0000${grade}`;
    const aggregate = grouped.get(key) ?? { source: summary.source, grade, statuses: [], variantStatuses: new Map() };
    aggregate.statuses.push(summary.status);
    const variant = activityVariantKey(summary);
    if (variant) aggregate.variantStatuses.set(variant, strongestStatus([aggregate.variantStatuses.get(variant), summary.status]));
    grouped.set(key, aggregate);
  }
  return [...grouped.values()].map(value => ({
    source: value.source,
    grade: value.grade,
    status: strongestStatus(value.statuses),
    variantStatuses: value.variantStatuses
  }));
}

function strongestStatus(statuses) {
  return statuses.includes("IN_STOCK") ? "IN_STOCK"
    : statuses.includes("LIMITED") ? "LIMITED"
      : statuses.includes("OUT_OF_STOCK") ? "OUT_OF_STOCK" : "UNKNOWN";
}

function activityVariantKey(summary) {
  const explicit = summary.productKey ?? summary.product?.productKey ?? summary.variantKey ?? summary.product?.variantKey;
  if (explicit && explicit !== "AI95_UNKNOWN") return String(explicit);
  const label = normalizeFuelLabel(summary.gradeLabel ?? summary.product?.displayLabel ?? "");
  return label || (explicit ? String(explicit) : undefined);
}

function isLaterTimestamp(candidate, current) {
  const candidateMs = new Date(candidate).getTime();
  if (!Number.isFinite(candidateMs)) return false;
  const currentMs = new Date(current).getTime();
  return !Number.isFinite(currentMs) || candidateMs > currentMs;
}
function sourceEventAt(value) { return value.kind === "SOURCE_REPORTED_TRANSITION" ? value.observedAt : value.resumedAt ?? value.latestEventAt; }

function scopedPatterns(values, station, brand, identity) {
  const stationIdentity = identity.id(station);
  return [
    { values: values.filter(value => value.identityId === stationIdentity), basis: "STATION" },
    { values: values.filter(value => brand && value.brand === brand), basis: "BRAND" },
    { values, basis: "AREA" }
  ];
}
function selectTimePattern(values, station, brand, identity) {
  const [stationValues, matchingBrand, areaValues] = scopedPatterns(values, station, brand, identity);
  if (spansTwoMoscowDays(stationValues.values)) return stationValues;
  if (spansTwoMoscowDays(matchingBrand.values)) return matchingBrand;
  if (spansTwoMoscowDays(areaValues.values)) return areaValues;
  return null;
}
function selectDurationPattern(values, station, brand, identity) { return scopedPatterns(values, station, brand, identity).find(value => value.values.length >= 2) ?? null; }

function spansTwoMoscowDays(values) { return values.length >= 2 && new Set(values.map(value => value.at ?? value.transitionAt).map(value => { const ms = new Date(value).getTime(); return Number.isFinite(ms) ? new Date(ms + 3 * 3600000).toISOString().slice(0, 10) : undefined; }).filter(Boolean)).size >= 2; }

function forecastFromActivity(assessment, negativeStartedAt, selected, nowMs) {
  const minutes = selected.values.map(value => moscowMinute(value.at));
  const center = minutes.reduce((best, candidate) => minutes.reduce((sum, value) => sum + Math.abs(circularDifference(value, candidate)), 0) < minutes.reduce((sum, value) => sum + Math.abs(circularDifference(value, best)), 0) ? candidate : best, minutes[0]);
  const offsets = minutes.map(value => circularDifference(value, center)).sort((a, b) => a - b);
  const middle = quantile(offsets, 0.5), low = quantile(offsets, 0.25), high = quantile(offsets, 0.75);
  let expectedMs = nextMoscowMinute(center + middle, nowMs);
  let windowStartMs = expectedMs + (low - middle) * 60000;
  let windowEndMs = expectedMs + (high - middle) * 60000;
  if (windowEndMs <= nowMs) { expectedMs += 86400000; windowStartMs += 86400000; windowEndMs += 86400000; }
  const strong = selected.values.filter(value => value.confidence === "MEDIUM").length;
  return { stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, coordinate: assessment.coordinate, brand: assessment.brand, negativeStartedAt, expectedAt: new Date(expectedMs).toISOString(), windowStartAt: new Date(Math.max(windowStartMs, nowMs)).toISOString(), windowEndAt: new Date(windowEndMs).toISOString(), confidence: selected.basis === "STATION" && selected.values.length >= 3 && strong >= 2 ? "MEDIUM" : "LOW", basis: selected.basis, signalBasis: selected.values[0].signalBasis, sampleSize: selected.values.length };
}

function forecastFromStatus(assessment, negativeStartedAt, selected, nowMs) {
  const durations = selected.values.map(episode => episode.durationMinutes).sort((a, b) => a - b);
  const expectedMinutes = quantile(durations, 0.5), lowMinutes = quantile(durations, 0.25), highMinutes = quantile(durations, 0.75);
  const startMs = new Date(negativeStartedAt).getTime();
  const expectedMs = startMs + expectedMinutes * 60000, windowStartMs = startMs + lowMinutes * 60000, windowEndMs = startMs + highMinutes * 60000;
  if (windowEndMs <= nowMs) return null;
  const confidence = selected.basis === "STATION" && durations.length >= 3 ? "MEDIUM" : "LOW";
  return { stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, coordinate: assessment.coordinate, brand: assessment.brand, negativeStartedAt, expectedAt: new Date(Math.max(expectedMs, nowMs)).toISOString(), windowStartAt: new Date(Math.max(windowStartMs, nowMs)).toISOString(), windowEndAt: new Date(windowEndMs).toISOString(), confidence, basis: selected.basis, signalBasis: "STATUS_TRANSITION", sampleSize: durations.length };
}

function completedEpisodes(ticks, maxGapMinutes, identity, brandAliases = {}) {
  const out = [];
  for (const [identityId, samples] of identity.groups(ticks)) {
    let negativeStart;
    let previousAt;
    for (const sample of samples) {
      const at = new Date(sample.fetchedAt).getTime();
      if (previousAt && at - previousAt > maxGapMinutes * 60000) negativeStart = undefined;
      if (sample.verdict === NEGATIVE) negativeStart ??= sample.fetchedAt;
      else if (isConfirmedPositive(sample) && negativeStart) {
        out.push({ identityId, brand: stationBrand(sample, brandAliases), startedAt: negativeStart, transitionAt: sample.fetchedAt, durationMinutes: (at - new Date(negativeStart).getTime()) / 60000 });
        negativeStart = undefined;
      } else if (!POSITIVE.has(sample.verdict)) negativeStart = undefined;
      previousAt = at;
    }
  }
  return out.filter(episode => episode.durationMinutes > 0);
}

function currentNegativeStart(samples, maxGapMinutes) {
  let start;
  let previousAt;
  for (const sample of samples) {
    const at = new Date(sample.fetchedAt).getTime();
    if (previousAt && at - previousAt > maxGapMinutes * 60000) start = undefined;
    if (sample.verdict === NEGATIVE) start ??= sample.fetchedAt;
    else start = undefined;
    previousAt = at;
  }
  return start;
}

function stationSamples(ticks, target, identity) { const id = identity.id(target); return ticks.flatMap(tick => { const station = identity.stations(tick).find(value => identity.id(value) === id); return station ? [{ ...station, fetchedAt: tick.fetchedAt }] : []; }); }
function buildHistoryIdentity(ticks) {
  const records = ticks.flatMap(tick => tick.stations.map(station => ({ station, fetchedAt: tick.fetchedAt })));
  const parent = records.map((_, index) => index);
  const find = index => { while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; } return index; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const tokenOwner = new Map();
  for (const [index, record] of records.entries()) for (const token of identityTokens(record.station)) {
    if (tokenOwner.has(token)) unite(index, tokenOwner.get(token));
    else tokenOwner.set(token, index);
  }
  const tokenToId = new Map();
  for (const [token, index] of tokenOwner) tokenToId.set(token, `history:${find(index)}`);
  const id = station => {
    const known = [...new Set(identityTokens(station).map(token => tokenToId.get(token)).filter(Boolean))];
    return known.length === 1 ? known[0] : known[0] ?? `unlinked:${station.stationKey}`;
  };
  const aggregated = new WeakMap();
  const stations = tick => {
    if (aggregated.has(tick)) return aggregated.get(tick);
    const grouped = new Map();
    for (const station of tick.stations) {
      const key = id(station);
      const values = grouped.get(key) ?? [];
      values.push(station);
      grouped.set(key, values);
    }
    const result = [...grouped.values()].map(aggregateIdentityStations);
    aggregated.set(tick, result);
    return result;
  };
  const groups = selectedTicks => {
    const out = new Map();
    for (const tick of selectedTicks) for (const station of stations(tick)) {
      const key = id(station);
      const values = out.get(key) ?? [];
      values.push({ ...station, fetchedAt: tick.fetchedAt });
      out.set(key, values);
    }
    for (const values of out.values()) values.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
    return out;
  };
  return { id, groups, stations };
}
function identityTokens(station) { return [...new Set([station.stationKey, ...(station.memberKeys ?? []), ...(station.members ?? []).map(member => `${member.source}:${member.sourceStationId}`)].filter(Boolean))]; }
export function aggregateIdentityStations(stations) {
  if (stations.length === 1) return stations[0];
  const verdicts = new Set(stations.map(station => station.verdict));
  const allConfirmedPositive = stations.every(isConfirmedPositive);
  const allNegative = stations.every(station => station.verdict === NEGATIVE);
  const confidenceOrder = ["NONE", "LOW", "MEDIUM", "HIGH"];
  const confidence = stations.map(station => station.confidence).sort((a, b) => confidenceOrder.indexOf(a) - confidenceOrder.indexOf(b))[0] ?? "NONE";
  const verdict = allNegative ? NEGATIVE : allConfirmedPositive ? (verdicts.size === 1 ? stations[0].verdict : "LIKELY_AVAILABLE") : "CONFLICTING";
  const representative = stations[0];
  return { ...representative, verdict, confidence, memberKeys: [...new Set(stations.flatMap(station => station.memberKeys ?? []))].sort(), activity: [...new Map(stations.flatMap(station => station.activity ?? []).map(value => [JSON.stringify(value), value])).values()] };
}
export function isConfirmedPositive(sample) { return sample.verdict === "AVAILABLE" || (sample.verdict === "LIKELY_AVAILABLE" && ["MEDIUM", "HIGH"].includes(sample.confidence)); }
function stationBrand(station, aliases = {}) { return normalizeComparableBrand(station.brand, aliases) || normalizeBrand(station.title); }
function quantile(values, q) { if (values.length === 1) return values[0]; const index = (values.length - 1) * q; const lower = Math.floor(index), upper = Math.ceil(index); return values[lower] + (values[upper] - values[lower]) * (index - lower); }
function moscowMinute(value) { const shifted = new Date(new Date(value).getTime() + 180 * 60000); return shifted.getUTCHours() * 60 + shifted.getUTCMinutes(); }
function circularDifference(value, center) { return ((value - center + 2160) % 1440) - 720; }
function nextMoscowMinute(value, nowMs) { const minute = ((Math.round(value) % 1440) + 1440) % 1440; const localNow = new Date(nowMs + 180 * 60000); let candidate = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, minute) - 180 * 60000; if (candidate <= nowMs) candidate += 86400000; return candidate; }
