import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { recordHistory } from "../../scripts/lib/history.mjs";
import { computeHistoryStats, renderHistoryStats } from "../../scripts/lib/history-stats.mjs";

const root = resolve(import.meta.dirname, "../..");
// The shape adapters actually emit: a transition is always OUT_OF_STOCK → IN_STOCK and carries no status.
const arrival = observedAt => ({ source: "gdebenz", gradeLabel: "95", kind: "SOURCE_REPORTED_TRANSITION", observedAt, gradeSpecific: true, sourceTerminology: "USER_REPORT" });
const station = (stationKey, members, verdict, extra = {}) => ({ stationKey, members: members.map(id => ({ source: "gdebenz", sourceStationId: id })), title: "Лукойл", address: `ул. ${stationKey}`, brand: "Лукойл", coordinate: [44.5, 48.7], verdict, confidence: verdict === "AVAILABLE" ? "MEDIUM" : "NONE", activity: [], ...extra });
const at = (day, hour, minute = 0) => new Date(Date.UTC(2026, 8, day, hour - 3, minute)).toISOString();

async function seeded() {
  const config = await loadConfig();
  config.history.retentionDays = 90;
  const path = join(await mkdtemp(join(tmpdir(), "fuel-history-stats-")), "history.json");
  const record = (fetchedAt, assessments, sources = { gdebenz: "OK" }) => recordHistory(path, { fetchedAt, areaHash: "area", queryHash: "query", sourceHealth: Object.entries(sources).map(([source, status]) => ({ source, status })), assessments }, config);
  // Station A runs out every night and is back at 07:00–07:30 Moscow time; on day 3 it is seen under a new key that
  // shares a member with the old one, which must stay one physical station.
  for (const [day, restoreMinute, key] of [[1, 0, "a"], [2, 30, "a"], [3, 15, "a2"]]) {
    for (let minute = 0; minute < 60; minute += 15) await record(at(day, 6, minute), [station(key, ["w1", key === "a2" ? "w9" : "w1"], "NOT_AVAILABLE"), station("b", ["w2"], "AVAILABLE")]);
    await record(at(day, 7, restoreMinute), [station(key, ["w1"], "AVAILABLE", { activity: [arrival(at(day, 6, 50))] }), station("b", ["w2"], "AVAILABLE")], { gdebenz: "OK", "2gis": "CHALLENGE" });
  }
  // A collector outage in the middle of an outage must not be counted as an episode.
  await record(at(4, 6), [station("a", ["w1"], "NOT_AVAILABLE")]);
  await record(at(4, 9), [station("a", ["w1"], "AVAILABLE")]);
  await record(at(4, 9, 15), [station("a", ["w1"], "NOT_AVAILABLE"), station("other-area-check", ["w3"], "AVAILABLE")]);
  await recordHistory(path, { fetchedAt: at(2, 12), areaHash: "old-area", queryHash: "query", assessments: [station("a", ["w1"], "AVAILABLE")] }, config);
  return { path, config };
}

test("statistics merge one physical station, count only observed outages and find the restore window", async () => {
  const { path, config } = await seeded();
  const stats = await computeHistoryStats(path, { intervalMinutes: config.monitoring.intervalMinutes, nowMs: Date.parse(at(4, 10)) });
  assert.equal(stats.coverage.otherScopeTicks, 1);
  assert.equal(stats.coverage.gapCount, 4);
  assert.deepEqual(stats.sources.statuses.gdebenz, { OK: stats.sources.ticksWithHealth });
  const a = stats.stations.find(value => value.keys.includes("a"));
  assert.ok(a.keys.includes("a2") && a.keys.includes("gdebenz:w9"), "a re-keyed station stays one identity");
  assert.equal(a.outages.count, 3);
  assert.deepEqual(a.outages.recent.map(value => value.durationMinutes), [60, 90, 75]);
  assert.deepEqual({ ...a.outages.typicalRestoreWindow }, { median: 435, start: 428, end: 443, sampleSize: 3 });
  assert.equal(a.outages.restoredByMoscowHour[7], 3);
  assert.equal(a.sourceReportedArrivals.count, 3);
  assert.deepEqual(a.current, { visible: true, lastSeenAt: at(4, 9, 15), verdict: "NOT_AVAILABLE", state: "negative", since: at(4, 9, 15) });
  const b = stats.stations.find(value => value.keys.includes("b"));
  assert.equal(b.outages.count, 0);
  assert.equal(b.shares.available, 100);
  assert.equal(b.current.visible, false);
});

test("statistics can be narrowed to one station and rendered in Russian", async () => {
  const { path, config } = await seeded();
  const stats = await computeHistoryStats(path, { intervalMinutes: config.monitoring.intervalMinutes, station: "A2", nowMs: Date.parse(at(4, 10)) });
  assert.equal(stats.matchedStationCount, 1);
  const markdown = renderHistoryStats(stats);
  assert.match(markdown, /Завершённых перебоев: 3; длительность: медиана 1 ч 15 мин/);
  assert.match(markdown, /обычно 07:08–07:23 МСК \(медиана 07:15\)/);
  assert.match(markdown, /Сейчас: АИ-95 нет с 04\.09 09:15 МСК/);
  assert.match(markdown, /Источники сообщали о поступлении АИ-95: 3 раза/);
  assert.match(renderHistoryStats(await computeHistoryStats(join(tmpdir(), "fuel-history-stats-missing", "history.json"), { intervalMinutes: 15 })), /История наблюдений пока пуста/);
});

test("the statistics command reads a given history without creating user config", async () => {
  const { path } = await seeded();
  const home = await mkdtemp(join(tmpdir(), "fuel-history-stats-home-"));
  const run = spawnSync(process.execPath, [join(root, "scripts", "history-stats.mjs"), "--history", path, "--json", "--days", "60"], { encoding: "utf8", env: { ...process.env, FUEL_WATCH_HOME: home } });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).stationCount, 3);
  assert.equal(spawnSync("ls", [home], { encoding: "utf8" }).stdout, "");
  const bad = spawnSync(process.execPath, [join(root, "scripts", "history-stats.mjs"), "--days", "0"], { encoding: "utf8", env: { ...process.env, FUEL_WATCH_HOME: home } });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--days must be a positive integer/);
});

test("statistics combine one station's records in a tick as conservatively as the forecast", async () => {
  const config = await loadConfig();
  const path = join(await mkdtemp(join(tmpdir(), "fuel-history-stats-weak-")), "history.json");
  const record = (fetchedAt, assessments) => recordHistory(path, { fetchedAt, areaHash: "area", queryHash: "query", assessments }, config);
  await record(at(1, 6), [station("a", ["w1"], "NOT_AVAILABLE")]);
  // One weak direct positive next to a medium "likely" is a low-confidence likely, which does not end the outage.
  await record(at(1, 6, 15), [station("a", ["w1"], "AVAILABLE", { confidence: "LOW" }), station("a-other", ["w1"], "LIKELY_AVAILABLE", { confidence: "MEDIUM" })]);
  await record(at(1, 6, 30), [station("a", ["w1"], "AVAILABLE")]);
  const stats = await computeHistoryStats(path, { intervalMinutes: 15, nowMs: Date.parse(at(1, 7)) });
  assert.equal(stats.stations[0].outages.count, 1);
  assert.equal(stats.stations[0].outages.recent[0].restoredAt, at(1, 6, 30));
});

test("one delivery reported by several sources is one arrival, and inferred activity resumption is not an arrival", async () => {
  const config = await loadConfig();
  const path = join(await mkdtemp(join(tmpdir(), "fuel-history-stats-arrivals-")), "history.json");
  const resumed = { source: "gdebenz", gradeLabel: "95", kind: "TRANSACTIONS_RESUMED", resumedAt: at(1, 7, 5), latestEventAt: at(1, 7, 10), gradeSpecific: true };
  const activity = [arrival(at(1, 6, 50)), { ...arrival(at(1, 7, 40)), source: "2gis" }, resumed, { ...arrival(at(1, 6, 50)), status: "OUT_OF_STOCK", observedAt: at(1, 5) }];
  // The period starts at the first poll; a report older than that is history the period never saw.
  await recordHistory(path, { fetchedAt: at(1, 6), areaHash: "area", queryHash: "query", assessments: [station("a", ["w1"], "AVAILABLE", { activity: [{ ...arrival(at(1, 5, 30)), source: "benzonavt" }] })] }, config);
  await recordHistory(path, { fetchedAt: at(1, 8), areaHash: "area", queryHash: "query", assessments: [station("a", ["w1"], "AVAILABLE", { activity })] }, config);
  await recordHistory(path, { fetchedAt: at(2, 8), areaHash: "area", queryHash: "query", assessments: [station("a", ["w1"], "AVAILABLE", { activity: [resumed, arrival(at(2, 7))] })] }, config);
  const stats = await computeHistoryStats(path, { intervalMinutes: 15, nowMs: Date.parse(at(2, 9)) });
  assert.deepEqual(stats.stations[0].sourceReportedArrivals.recent, [{ at: at(1, 6, 50), sources: ["2gis", "gdebenz"], reports: 2 }, { at: at(2, 7), sources: ["gdebenz"], reports: 1 }]);
  assert.equal(stats.coverage.otherScopeTicks, 0);
});
