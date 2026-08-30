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
  const scopedTicks = history.ticks.filter(tick => tick.areaHash === snapshot.areaHash && tick.queryHash === snapshot.queryHash);
  const episodes = completedEpisodes(scopedTicks, config.monitoring.intervalMinutes * 3);
  const nowMs = new Date(snapshot.fetchedAt).getTime();
  const candidates = snapshot.assessments.filter(assessment => assessment.verdict === NEGATIVE).map(assessment => {
    const samples = stationSamples(scopedTicks, assessment.stationKey);
    const negativeStartedAt = currentNegativeStart(samples, config.monitoring.intervalMinutes * 3);
    if (!negativeStartedAt) return null;
    const brand = normalizeBrand(assessment.brand ?? assessment.title);
    const stationEpisodes = episodes.filter(episode => episode.stationKey === assessment.stationKey);
    const brandEpisodes = episodes.filter(episode => brand && episode.brand === brand);
    const selected = stationEpisodes.length >= 2 ? { values: stationEpisodes, basis: "STATION" }
      : brandEpisodes.length >= 2 ? { values: brandEpisodes, basis: "BRAND" }
      : episodes.length >= 2 ? { values: episodes, basis: "AREA" }
      : stationEpisodes.length ? { values: stationEpisodes, basis: "STATION" }
      : brandEpisodes.length ? { values: brandEpisodes, basis: "BRAND" }
      : episodes.length ? { values: episodes, basis: "AREA" } : null;
    if (!selected) return null;
    const durations = selected.values.map(episode => episode.durationMinutes).sort((a, b) => a - b);
    const expectedMinutes = quantile(durations, 0.5);
    const lowMinutes = quantile(durations, 0.25);
    const highMinutes = quantile(durations, 0.75);
    const startMs = new Date(negativeStartedAt).getTime();
    const expectedMs = startMs + expectedMinutes * 60000;
    const windowStartMs = startMs + lowMinutes * 60000;
    const windowEndMs = startMs + highMinutes * 60000;
    if (windowEndMs <= nowMs) return null;
    const confidence = selected.basis === "STATION" && durations.length >= 3 ? "MEDIUM" : "LOW";
    return { stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, brand: assessment.brand, negativeStartedAt, expectedAt: new Date(Math.max(expectedMs, nowMs)).toISOString(), windowStartAt: new Date(Math.max(windowStartMs, nowMs)).toISOString(), windowEndAt: new Date(windowEndMs).toISOString(), confidence, basis: selected.basis, sampleSize: durations.length };
  }).filter(Boolean).sort((a, b) => new Date(a.expectedAt) - new Date(b.expectedAt)).slice(0, config.history.forecastCount);
  return { generatedAt: snapshot.fetchedAt, retentionDays: config.history.retentionDays, requestedCount: config.history.forecastCount, tickCount: scopedTicks.length, completedEpisodeCount: episodes.length, items: candidates };
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
  return { fetchedAt: snapshot.fetchedAt, areaHash: snapshot.areaHash, queryHash: snapshot.queryHash, stations: snapshot.assessments.map(assessment => ({ stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, brand: assessment.brand, coordinate: assessment.coordinate, verdict: assessment.verdict, confidence: assessment.confidence, products: Object.fromEntries(Object.entries(assessment.productAssessments ?? {}).map(([key, value]) => [key, { verdict: value.verdict, confidence: value.confidence }])) })) };
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
