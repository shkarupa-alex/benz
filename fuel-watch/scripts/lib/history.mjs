import { homedir } from "node:os";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import properLockfile from "proper-lockfile";
import { normalizeFuelLabel, petrolOctaneKey } from "./fuels.mjs";
import { compileBrandAliases, normalizeBrand, normalizeComparableBrand } from "./normalize.mjs";
import { readJson, writeJsonAtomic } from "./util.mjs";

const POSITIVE = new Set(["AVAILABLE", "LIKELY_AVAILABLE"]);
const NEGATIVE = "NOT_AVAILABLE";

export function defaultHistoryPath(env = process.env) {
  if (env.FUEL_WATCH_HISTORY_PATH) return resolve(env.FUEL_WATCH_HISTORY_PATH);
  const stateRoot = env.XDG_STATE_HOME ? resolve(env.XDG_STATE_HOME) : join(homedir(), ".local", "state");
  return join(stateRoot, "fuel-watch", "history.json");
}

export async function recordHistory(path, snapshot, config, { lock = properLockfile.lock } = {}) {
  return withHistoryLock(path, async assertLockHealthy => {
    const now = new Date(snapshot.fetchedAt);
    if (!Number.isFinite(now.getTime())) throw new Error("snapshot fetchedAt is invalid");
    const retentionDays = config.history.retentionDays;
    const previous = await loadHistory(path);
    const referenceMs = Math.max(now.getTime(), new Date(previous.updatedAt ?? 0).getTime() || 0);
    const cutoff = referenceMs - retentionDays * 86400000;
    const ticks = previous.ticks
      .filter(tick => new Date(tick.fetchedAt).getTime() >= cutoff)
      .filter(tick => !(tick.fetchedAt === snapshot.fetchedAt && tick.areaHash === snapshot.areaHash && tick.queryHash === snapshot.queryHash));
    ticks.push(compactTick(snapshot));
    ticks.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
    const history = { schemaVersion: 1, retentionDays, updatedAt: ticks.at(-1)?.fetchedAt ?? snapshot.fetchedAt, ticks };
    const forecast = buildForecast(history, snapshot, config);
    assertLockHealthy();
    await writeJsonAtomic(path, history);
    assertLockHealthy();
    return { history, forecast };
  }, lock);
}

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

export function buildForecast(history, snapshot, config) {
  const brandAliases = compileBrandAliases(config.identity.brandAliases);
  const areaTicks = history.ticks.filter(tick => tick.areaHash === snapshot.areaHash);
  const scopedTicks = history.ticks.filter(tick => tick.areaHash === snapshot.areaHash && tick.queryHash === snapshot.queryHash);
  const identity = buildHistoryIdentity(areaTicks);
  const episodes = completedEpisodes(scopedTicks, config.monitoring.intervalMinutes * 3, identity, brandAliases);
  const rollingEvents = rollingActivityEvents(areaTicks, config, identity, brandAliases);
  const statusEvents = petrolStatusEvents(areaTicks, config, identity, brandAliases);
  const nowMs = new Date(snapshot.fetchedAt).getTime();
  const candidates = snapshot.assessments.filter(assessment => assessment.verdict === NEGATIVE).map(assessment => {
    const samples = stationSamples(scopedTicks, assessment, identity);
    const negativeStartedAt = currentNegativeStart(samples, config.monitoring.intervalMinutes * 3);
    if (!negativeStartedAt) return null;
    const brand = stationBrand(assessment, brandAliases);
    const activity = selectPattern(rollingEvents, assessment, brand, identity) ?? selectPattern(statusEvents, assessment, brand, identity);
    if (activity) return forecastFromActivity(assessment, negativeStartedAt, activity, nowMs);
    const selected = selectPattern(episodes, assessment, brand, identity);
    if (!selected) return null;
    return forecastFromStatus(assessment, negativeStartedAt, selected, nowMs);
  }).filter(Boolean).sort((a, b) => new Date(a.expectedAt) - new Date(b.expectedAt)).slice(0, config.history.forecastCount);
  return { generatedAt: snapshot.fetchedAt, retentionDays: config.history.retentionDays, requestedCount: config.history.forecastCount, tickCount: areaTicks.length, completedEpisodeCount: episodes.length, activityEventCount: rollingEvents.length, petrolStatusEventCount: statusEvents.length, items: candidates };
}

async function loadHistory(path) {
  try {
    const value = await readJson(path);
    if (value.schemaVersion !== 1 || !Array.isArray(value.ticks)) throw new Error("unsupported history schema");
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 1, ticks: [] };
    throw error;
  }
}

function compactTick(snapshot) {
  return { fetchedAt: snapshot.fetchedAt, areaHash: snapshot.areaHash, queryHash: snapshot.queryHash, stations: snapshot.assessments.map(assessment => ({ stationKey: assessment.stationKey, memberKeys: (assessment.members ?? []).map(member => `${member.source}:${member.sourceStationId}`).sort(), title: assessment.title, address: assessment.address, brand: assessment.brand, coordinate: assessment.coordinate, verdict: assessment.verdict, confidence: assessment.confidence, products: Object.fromEntries(Object.entries(assessment.productAssessments ?? {}).map(([key, value]) => [key, { verdict: value.verdict, confidence: value.confidence }])), activity: (assessment.activity ?? []).filter(value => ["ROLLING_SIGNAL_COUNT", "PETROL_STATUS_SNAPSHOT"].includes(value.kind)).map(value => ({ source: value.source, productKey: value.product?.productKey, gradeLabel: value.gradeLabel, kind: value.kind, status: value.status, observedAt: value.observedAt, latestEventAt: value.latestEventAt, windowMinutes: value.windowMinutes, count: value.count, gradeSpecific: value.gradeSpecific, sourceTerminology: value.sourceTerminology })) })) };
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

function selectPattern(values, station, brand, identity) {
  const stationIdentity = identity.id(station);
  const stationValues = values.filter(value => value.identityId === stationIdentity);
  const matchingBrand = values.filter(value => brand && value.brand === brand);
  if (stationValues.length >= 2) return { values: stationValues, basis: "STATION" };
  if (matchingBrand.length >= 2) return { values: matchingBrand, basis: "BRAND" };
  if (values.length >= 2) return { values, basis: "AREA" };
  return null;
}

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
function aggregateIdentityStations(stations) {
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
function isConfirmedPositive(sample) { return sample.verdict === "AVAILABLE" || (sample.verdict === "LIKELY_AVAILABLE" && ["MEDIUM", "HIGH"].includes(sample.confidence)); }
function stationBrand(station, aliases = {}) { return normalizeComparableBrand(station.brand, aliases) || normalizeBrand(station.title); }
function quantile(values, q) { if (values.length === 1) return values[0]; const index = (values.length - 1) * q; const lower = Math.floor(index), upper = Math.ceil(index); return values[lower] + (values[upper] - values[lower]) * (index - lower); }
function moscowMinute(value) { const shifted = new Date(new Date(value).getTime() + 180 * 60000); return shifted.getUTCHours() * 60 + shifted.getUTCMinutes(); }
function circularDifference(value, center) { return ((value - center + 2160) % 1440) - 720; }
function nextMoscowMinute(value, nowMs) { const minute = ((Math.round(value) % 1440) + 1440) % 1440; const localNow = new Date(nowMs + 180 * 60000); let candidate = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, minute) - 180 * 60000; if (candidate <= nowMs) candidate += 86400000; return candidate; }
