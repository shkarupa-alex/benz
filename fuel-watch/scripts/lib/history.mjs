import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { readJson, writeJsonAtomic } from "./util.mjs";

const POSITIVE = new Set(["AVAILABLE", "LIKELY_AVAILABLE"]);
const NEGATIVE = "NOT_AVAILABLE";

export function defaultHistoryPath(env = process.env) {
  if (env.FUEL_WATCH_HISTORY_PATH) return resolve(env.FUEL_WATCH_HISTORY_PATH);
  const stateRoot = env.XDG_STATE_HOME ? resolve(env.XDG_STATE_HOME) : join(homedir(), ".local", "state");
  return join(stateRoot, "fuel-watch", "history.json");
}

export async function recordHistory(path, snapshot, config) {
  const now = new Date(snapshot.fetchedAt);
  if (!Number.isFinite(now.getTime())) throw new Error("snapshot fetchedAt is invalid");
  const retentionDays = config.history.retentionDays;
  const cutoff = now.getTime() - retentionDays * 86400000;
  const previous = await loadHistory(path);
  const ticks = previous.ticks
    .filter(tick => new Date(tick.fetchedAt).getTime() >= cutoff)
    .filter(tick => !(tick.fetchedAt === snapshot.fetchedAt && tick.areaHash === snapshot.areaHash && tick.queryHash === snapshot.queryHash));
  ticks.push(compactTick(snapshot));
  ticks.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
  const history = { schemaVersion: 1, retentionDays, updatedAt: snapshot.fetchedAt, ticks };
  const forecast = buildForecast(history, snapshot, config);
  await writeJsonAtomic(path, history);
  return { history, forecast };
}

export function buildForecast(history, snapshot, config) {
  const areaTicks = history.ticks.filter(tick => tick.areaHash === snapshot.areaHash);
  const scopedTicks = history.ticks.filter(tick => tick.areaHash === snapshot.areaHash && tick.queryHash === snapshot.queryHash);
  const episodes = completedEpisodes(scopedTicks, config.monitoring.intervalMinutes * 3);
  const rollingEvents = rollingActivityEvents(areaTicks, config);
  const statusEvents = petrolStatusEvents(areaTicks, config);
  const nowMs = new Date(snapshot.fetchedAt).getTime();
  const candidates = snapshot.assessments.filter(assessment => assessment.verdict === NEGATIVE).map(assessment => {
    const samples = stationSamples(scopedTicks, assessment.stationKey);
    const negativeStartedAt = currentNegativeStart(samples, config.monitoring.intervalMinutes * 3);
    if (!negativeStartedAt) return null;
    const brand = normalizeBrand(assessment.brand ?? assessment.title);
    const activity = selectPattern(rollingEvents, assessment.stationKey, brand) ?? selectPattern(statusEvents, assessment.stationKey, brand);
    if (activity) return forecastFromActivity(assessment, negativeStartedAt, activity, nowMs);
    const selected = selectPattern(episodes, assessment.stationKey, brand);
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
  return { fetchedAt: snapshot.fetchedAt, areaHash: snapshot.areaHash, queryHash: snapshot.queryHash, stations: snapshot.assessments.map(assessment => ({ stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, brand: assessment.brand, coordinate: assessment.coordinate, verdict: assessment.verdict, confidence: assessment.confidence, products: Object.fromEntries(Object.entries(assessment.productAssessments ?? {}).map(([key, value]) => [key, { verdict: value.verdict, confidence: value.confidence }])), activity: (assessment.activity ?? []).filter(value => ["ROLLING_SIGNAL_COUNT", "PETROL_STATUS_SNAPSHOT"].includes(value.kind)).map(value => ({ source: value.source, productKey: value.product?.productKey, gradeLabel: value.gradeLabel, kind: value.kind, status: value.status, observedAt: value.observedAt, latestEventAt: value.latestEventAt, windowMinutes: value.windowMinutes, count: value.count, gradeSpecific: value.gradeSpecific, sourceTerminology: value.sourceTerminology })) })) };
}

function rollingActivityEvents(ticks, config) {
  const previous = new Map();
  const groups = new Map();
  for (const tick of ticks) for (const station of tick.stations) for (const summary of station.activity ?? []) {
    if (!summary.gradeSpecific || !Number.isFinite(summary.count) || !Number.isFinite(summary.windowMinutes)) continue;
    const grade = summary.productKey ?? normalizeBrand(summary.gradeLabel);
    if (!grade) continue;
    const key = `${station.stationKey}|${summary.source}|${grade}`;
    const before = previous.get(key);
    const tickMs = new Date(tick.fetchedAt).getTime();
    const latestMs = new Date(summary.latestEventAt).getTime();
    const closeTicks = before && tickMs - before.tickMs <= config.monitoring.intervalMinutes * 3 * 60000;
    const recentEvent = Number.isFinite(latestMs) && tickMs - latestMs >= -config.freshness.futureSkewSeconds * 1000 && tickMs - latestMs <= config.activity.resumeWindowMinutes * 60000;
    if (closeTicks && before.summary.windowMinutes >= config.activity.quietGapMinutes && before.summary.count === 0 && summary.count >= config.activity.minimumEvents && recentEvent) {
      const groupKey = `${station.stationKey}|${tick.fetchedAt}`;
      const group = groups.get(groupKey) ?? { stationKey: station.stationKey, brand: normalizeBrand(station.brand ?? station.title), at: summary.latestEventAt, grades: new Set(), totalCount: 0 };
      group.grades.add(grade);
      group.totalCount += summary.count;
      if (new Date(summary.latestEventAt) > new Date(group.at)) group.at = summary.latestEventAt;
      groups.set(groupKey, group);
    }
    previous.set(key, { tickMs, summary });
  }
  return [...groups.values()].map(value => ({ stationKey: value.stationKey, brand: value.brand, at: value.at, gradeCount: value.grades.size, totalCount: value.totalCount, confidence: value.grades.size >= 2 || value.totalCount >= config.activity.strongSignalCountPerHour ? "MEDIUM" : "LOW", signalBasis: "ROLLING_ACTIVITY" }));
}

function petrolStatusEvents(ticks, config) {
  const previous = new Map();
  const groups = new Map();
  for (const tick of ticks) for (const station of tick.stations) for (const summary of station.activity ?? []) {
    if (summary.kind !== "PETROL_STATUS_SNAPSHOT" || !summary.gradeSpecific) continue;
    const grade = summary.productKey ?? normalizeBrand(summary.gradeLabel);
    if (!grade) continue;
    const key = `${station.stationKey}|${summary.source}|${grade}`;
    const before = previous.get(key);
    const tickMs = new Date(tick.fetchedAt).getTime();
    const closeTicks = before && tickMs - before.tickMs <= config.monitoring.intervalMinutes * 3 * 60000;
    if (closeTicks && before.status === "OUT_OF_STOCK" && ["IN_STOCK", "LIMITED"].includes(summary.status)) {
      const groupKey = `${station.stationKey}|${tick.fetchedAt}`;
      const group = groups.get(groupKey) ?? { stationKey: station.stationKey, brand: normalizeBrand(station.brand ?? station.title), at: tick.fetchedAt, grades: new Set() };
      group.grades.add(grade);
      groups.set(groupKey, group);
    }
    previous.set(key, { tickMs, status: summary.status });
  }
  return [...groups.values()].map(value => ({ stationKey: value.stationKey, brand: value.brand, at: value.at, gradeCount: value.grades.size, confidence: value.grades.size >= 2 ? "MEDIUM" : "LOW", signalBasis: "PETROL_STATUS_PATTERN" }));
}

function selectPattern(values, stationKey, brand) {
  const station = values.filter(value => value.stationKey === stationKey);
  const matchingBrand = values.filter(value => brand && value.brand === brand);
  if (station.length >= 2) return { values: station, basis: "STATION" };
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
  return { stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, brand: assessment.brand, negativeStartedAt, expectedAt: new Date(expectedMs).toISOString(), windowStartAt: new Date(Math.max(windowStartMs, nowMs)).toISOString(), windowEndAt: new Date(windowEndMs).toISOString(), confidence: selected.basis === "STATION" && selected.values.length >= 3 && strong >= 2 ? "MEDIUM" : "LOW", basis: selected.basis, signalBasis: selected.values[0].signalBasis, sampleSize: selected.values.length };
}

function forecastFromStatus(assessment, negativeStartedAt, selected, nowMs) {
  const durations = selected.values.map(episode => episode.durationMinutes).sort((a, b) => a - b);
  const expectedMinutes = quantile(durations, 0.5), lowMinutes = quantile(durations, 0.25), highMinutes = quantile(durations, 0.75);
  const startMs = new Date(negativeStartedAt).getTime();
  const expectedMs = startMs + expectedMinutes * 60000, windowStartMs = startMs + lowMinutes * 60000, windowEndMs = startMs + highMinutes * 60000;
  if (windowEndMs <= nowMs) return null;
  const confidence = selected.basis === "STATION" && durations.length >= 3 ? "MEDIUM" : "LOW";
  return { stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, brand: assessment.brand, negativeStartedAt, expectedAt: new Date(Math.max(expectedMs, nowMs)).toISOString(), windowStartAt: new Date(Math.max(windowStartMs, nowMs)).toISOString(), windowEndAt: new Date(windowEndMs).toISOString(), confidence, basis: selected.basis, signalBasis: "STATUS_TRANSITION", sampleSize: durations.length };
}

function completedEpisodes(ticks, maxGapMinutes) {
  const keys = new Set(ticks.flatMap(tick => tick.stations.map(station => station.stationKey)));
  const out = [];
  for (const stationKey of keys) {
    const samples = stationSamples(ticks, stationKey);
    let negativeStart;
    let previousAt;
    for (const sample of samples) {
      const at = new Date(sample.fetchedAt).getTime();
      if (previousAt && at - previousAt > maxGapMinutes * 60000) negativeStart = undefined;
      if (sample.verdict === NEGATIVE) negativeStart ??= sample.fetchedAt;
      else if (isConfirmedPositive(sample) && negativeStart) {
        out.push({ stationKey, brand: normalizeBrand(sample.brand ?? sample.title), startedAt: negativeStart, transitionAt: sample.fetchedAt, durationMinutes: (at - new Date(negativeStart).getTime()) / 60000 });
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

function stationSamples(ticks, stationKey) { return ticks.flatMap(tick => { const station = tick.stations.find(value => value.stationKey === stationKey); return station ? [{ ...station, fetchedAt: tick.fetchedAt }] : []; }); }
function isConfirmedPositive(sample) { return sample.verdict === "AVAILABLE" || (sample.verdict === "LIKELY_AVAILABLE" && ["MEDIUM", "HIGH"].includes(sample.confidence)); }
function normalizeBrand(value) { return String(value ?? "").normalize("NFKC").toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function quantile(values, q) { if (values.length === 1) return values[0]; const index = (values.length - 1) * q; const lower = Math.floor(index), upper = Math.ceil(index); return values[lower] + (values[upper] - values[lower]) * (index - lower); }
function moscowMinute(value) { const shifted = new Date(new Date(value).getTime() + 180 * 60000); return shifted.getUTCHours() * 60 + shifted.getUTCMinutes(); }
function circularDifference(value, center) { return ((value - center + 2160) % 1440) - 720; }
function nextMoscowMinute(value, nowMs) { const minute = ((Math.round(value) % 1440) + 1440) % 1440; const localNow = new Date(nowMs + 180 * 60000); let candidate = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, minute) - 180 * 60000; if (candidate <= nowMs) candidate += 86400000; return candidate; }
