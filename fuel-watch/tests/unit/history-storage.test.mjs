import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { FORECAST_WINDOW_MAX_DAYS, forEachHistoryDay, forecastWindowDays, historyLayout, readHistory, recordHistory } from "../../scripts/lib/history.mjs";
import { writeJsonAtomic } from "../../scripts/lib/util.mjs";

const transition = { source: "gdebenz", product: { productKey: "AI95" }, gradeLabel: "95", kind: "SOURCE_REPORTED_TRANSITION", status: "IN_STOCK", observedAt: "2026-09-01T06:00:00Z", gradeSpecific: true, sourceTerminology: "STATUS" };
const snapshotStatus = { source: "gdebenz", product: { productKey: "AI95" }, gradeLabel: "95", kind: "PETROL_STATUS_SNAPSHOT", status: "IN_STOCK", observedAt: "2026-09-01T06:00:00Z", gradeSpecific: true, sourceTerminology: "STATUS" };
const assessment = (verdict, activity = []) => ({ stationKey: "s1", members: [{ source: "gdebenz", sourceStationId: "w1" }], title: "АЗС 1", address: "ул. Мира, 1", brand: "Лукойл", coordinate: [44.5, 48.7], verdict, confidence: verdict === "AVAILABLE" ? "MEDIUM" : "NONE", productAssessments: { AI95: { verdict, confidence: "LOW" } }, activity });
const snapshot = (fetchedAt, verdict = "NOT_AVAILABLE", activity = []) => ({ fetchedAt, areaHash: "area", queryHash: "query", sourceHealth: [{ source: "gdebenz", status: "OK" }, { source: "2gis", status: "CHALLENGE" }], assessments: [assessment(verdict, activity)] });
const tempHistory = async () => join(await mkdtemp(join(tmpdir(), "fuel-history-storage-")), "history.json");
const config90 = async () => { const config = await loadConfig(); config.history.retentionDays = 90; return config; };
const lines = async path => (await readFile(path, "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line));

test("ticks are appended to a file per UTC day next to a small manifest and a station dictionary", async () => {
  const config = await config90();
  const path = await tempHistory();
  await recordHistory(path, snapshot("2026-09-01T23:45:00Z"), config);
  await recordHistory(path, snapshot("2026-09-02T00:00:00Z", "AVAILABLE"), config);
  const layout = historyLayout(path);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { schemaVersion: 2, layout: "daily-jsonl", retentionDays: 90, updatedAt: "2026-09-02T00:00:00.000Z" });
  assert.deepEqual((await readdir(layout.ticksDir)).sort(), ["2026-09-01.jsonl", "2026-09-02.jsonl"]);
  const [stored] = await lines(join(layout.ticksDir, "2026-09-01.jsonl"));
  assert.deepEqual(stored.sources, { gdebenz: "OK", "2gis": "CHALLENGE" });
  assert.equal(stored.stations[0].title, undefined, "display metadata lives in the dictionary, not in every tick");
  assert.equal(stored.stations[0].products, undefined, "per-variant product verdicts are not stored");
  const dictionary = JSON.parse(await readFile(layout.stations, "utf8"));
  assert.equal(dictionary.stations.s1.title, "АЗС 1");
  assert.equal(dictionary.stations.s1.firstSeenAt, "2026-09-01T23:45:00Z");
  assert.equal(dictionary.stations.s1.lastSeenAt, "2026-09-02T00:00:00Z");
  const saved = await readHistory(path);
  assert.deepEqual(saved.ticks.map(value => [value.fetchedAt, value.stations[0].verdict, value.stations[0].title, value.stations[0].memberKeys[0]]), [
    ["2026-09-01T23:45:00Z", "NOT_AVAILABLE", "АЗС 1", "gdebenz:w1"],
    ["2026-09-02T00:00:00Z", "AVAILABLE", "АЗС 1", "gdebenz:w1"]
  ]);
});

test("a repeated collection of the same tick is not stored twice", async () => {
  const config = await config90();
  const path = await tempHistory();
  await recordHistory(path, snapshot("2026-09-01T10:00:00Z"), config);
  const result = await recordHistory(path, snapshot("2026-09-01T10:00:00Z"), config);
  assert.equal(result.history.ticks.length, 1);
  assert.equal((await lines(join(historyLayout(path).ticksDir, "2026-09-01.jsonl"))).length, 1);
});

test("a source-reported event is stored once and still rehydrates with its original fields", async () => {
  const config = await config90();
  const path = await tempHistory();
  for (const at of ["2026-09-01T10:00:00Z", "2026-09-01T10:15:00Z", "2026-09-01T10:30:00Z"]) await recordHistory(path, snapshot(at, "AVAILABLE", [transition, snapshotStatus]), config);
  const stored = await lines(join(historyLayout(path).ticksDir, "2026-09-01.jsonl"));
  assert.deepEqual(stored.map(value => value.stations[0].activity.map(item => item.k)), [["SOURCE_REPORTED_TRANSITION", "PETROL_STATUS_SNAPSHOT"], ["PETROL_STATUS_SNAPSHOT"], ["PETROL_STATUS_SNAPSHOT"]]);
  const saved = await readHistory(path);
  assert.deepEqual(saved.ticks[0].stations[0].activity[0], { source: "gdebenz", productKey: "AI95", gradeLabel: "95", kind: "SOURCE_REPORTED_TRANSITION", status: "IN_STOCK", observedAt: "2026-09-01T06:00:00Z", gradeSpecific: true, sourceTerminology: "STATUS" });
});

test("a line torn by a crash is skipped and the next tick is not glued onto it", async () => {
  const config = await config90();
  const path = await tempHistory();
  await recordHistory(path, snapshot("2026-09-01T10:00:00Z"), config);
  const day = join(historyLayout(path).ticksDir, "2026-09-01.jsonl");
  await appendFile(day, "{\"fetchedAt\":\"2026-09-01T10:15:00Z\",\"stati");
  await recordHistory(path, snapshot("2026-09-01T10:30:00Z", "AVAILABLE"), config);
  const saved = await readHistory(path);
  assert.equal(saved.corruptLines, 1);
  assert.deepEqual(saved.ticks.map(value => value.fetchedAt), ["2026-09-01T10:00:00Z", "2026-09-01T10:30:00Z"]);
});

test("retention removes whole expired day files and stations not seen since", async () => {
  const config = await config90();
  config.history.retentionDays = 7;
  const path = await tempHistory();
  await recordHistory(path, { ...snapshot("2026-09-01T10:00:00Z"), assessments: [{ ...assessment("NOT_AVAILABLE"), stationKey: "gone" }] }, config);
  await recordHistory(path, snapshot("2026-09-09T10:00:00Z"), config);
  const layout = historyLayout(path);
  assert.deepEqual(await readdir(layout.ticksDir), ["2026-09-09.jsonl"]);
  assert.deepEqual(Object.keys(JSON.parse(await readFile(layout.stations, "utf8")).stations), ["s1"]);
});

test("the per-collection forecast reads only a bounded window of a long retention", async () => {
  const config = await config90();
  assert.equal(forecastWindowDays(config), FORECAST_WINDOW_MAX_DAYS);
  const path = await tempHistory();
  await recordHistory(path, snapshot("2026-07-01T10:00:00Z"), config);
  const result = await recordHistory(path, snapshot("2026-09-01T10:00:00Z"), config);
  assert.deepEqual(result.history.ticks.map(value => value.fetchedAt), ["2026-09-01T10:00:00Z"]);
  assert.equal(result.forecast.windowDays, FORECAST_WINDOW_MAX_DAYS);
  assert.equal((await readHistory(path)).ticks.length, 2, "the older tick stays on disk for statistics");
});

test("a version 1 history file is backed up and converted under the lock", async () => {
  const config = await config90();
  const path = await tempHistory();
  const legacyStation = { stationKey: "s1", memberKeys: ["gdebenz:w1"], title: "АЗС 1", address: "ул. Мира, 1", brand: "Лукойл", coordinate: [44.5, 48.7], verdict: "NOT_AVAILABLE", confidence: "NONE", products: {}, activity: [{ source: "gdebenz", productKey: "AI95", gradeLabel: "95", kind: "SOURCE_REPORTED_TRANSITION", status: "IN_STOCK", observedAt: "2026-08-30T06:00:00Z", gradeSpecific: true, sourceTerminology: "STATUS" }] };
  const legacy = { schemaVersion: 1, retentionDays: 7, updatedAt: "2026-08-31T00:15:00Z", ticks: [
    { fetchedAt: "2026-08-30T23:45:00Z", areaHash: "area", queryHash: "query", stations: [legacyStation] },
    { fetchedAt: "2026-08-31T00:15:00Z", areaHash: "area", queryHash: "query", stations: [legacyStation] }
  ] };
  await writeJsonAtomic(path, legacy);
  const v1 = await readHistory(path);
  assert.equal(v1.ticks.length, 2, "a v1 file is readable before it is converted");
  await recordHistory(path, snapshot("2026-08-31T00:30:00Z"), config);
  const layout = historyLayout(path);
  assert.deepEqual(JSON.parse(await readFile(layout.v1Backup, "utf8")), legacy);
  assert.deepEqual((await readdir(join(path, ".."))).filter(name => name.endsWith(".tmp")), []);
  const manifest = JSON.parse(await readFile(path, "utf8"));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.retentionDays, 90);
  assert.deepEqual((await readdir(layout.ticksDir)).sort(), ["2026-08-30.jsonl", "2026-08-31.jsonl"]);
  const saved = await readHistory(path);
  assert.deepEqual(saved.ticks.map(value => value.fetchedAt), ["2026-08-30T23:45:00Z", "2026-08-31T00:15:00Z", "2026-08-31T00:30:00Z"]);
  assert.equal(saved.ticks[0].stations[0].activity.length, 1);
  assert.equal(saved.ticks[1].stations[0].activity.length, 0, "the repeated event is kept only in the first tick");
  assert.equal(saved.ticks[1].stations[0].title, "АЗС 1");
});

test("an unknown history schema is refused instead of being overwritten", async () => {
  const config = await config90();
  const path = await tempHistory();
  await writeFile(path, JSON.stringify({ schemaVersion: 3 }));
  await assert.rejects(recordHistory(path, snapshot("2026-09-01T10:00:00Z"), config), /unsupported history schema/);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { schemaVersion: 3 });
});

test("statistics stream the retained days oldest first, one day at a time", async () => {
  const config = await config90();
  const path = await tempHistory();
  for (const at of ["2026-09-02T10:00:00Z", "2026-09-01T10:15:00Z", "2026-09-01T10:00:00Z", "2026-09-03T10:00:00Z"]) await recordHistory(path, snapshot(at), config);
  const seen = [];
  const result = await forEachHistoryDay(path, { sinceMs: Date.parse("2026-09-01T10:10:00Z") }, (ticks, day) => { seen.push([day, ticks.map(value => value.fetchedAt)]); });
  assert.deepEqual(seen, [["2026-09-01", ["2026-09-01T10:15:00Z"]], ["2026-09-02", ["2026-09-02T10:00:00Z"]], ["2026-09-03", ["2026-09-03T10:00:00Z"]]]);
  assert.equal(result.days, 3);
  assert.equal(result.stations.s1.title, "АЗС 1");
  assert.deepEqual(await forEachHistoryDay(join(tmpdir(), "fuel-history-missing", "history.json"), {}, () => assert.fail("no days")), { days: 0, corruptLines: 0, stations: {} });
});

test("an event first seen under another area is stored again for the area the forecast reads", async () => {
  const config = await config90();
  const path = await tempHistory();
  await recordHistory(path, { ...snapshot("2026-09-01T10:00:00Z", "AVAILABLE", [transition]), areaHash: "old-area" }, config);
  await recordHistory(path, snapshot("2026-09-01T10:15:00Z", "AVAILABLE", [transition]), config);
  await recordHistory(path, snapshot("2026-09-01T10:30:00Z", "AVAILABLE", [transition]), config);
  const saved = await readHistory(path);
  assert.deepEqual(saved.ticks.map(value => [value.areaHash, value.stations[0].activity.length]), [["old-area", 1], ["area", 1], ["area", 0]]);
});

test("each stored tick keeps the title and brand it was seen with", async () => {
  const config = await config90();
  const path = await tempHistory();
  const renamed = (fetchedAt, brand) => ({ ...snapshot(fetchedAt), assessments: [{ ...assessment("NOT_AVAILABLE"), brand, title: `АЗС ${brand}` }] });
  await recordHistory(path, renamed("2026-09-01T10:00:00Z", "Лукойл"), config);
  await recordHistory(path, renamed("2026-09-01T10:15:00Z", "Роснефть"), config);
  await recordHistory(path, renamed("2026-09-01T10:30:00Z", "Лукойл"), config);
  const saved = await readHistory(path);
  assert.deepEqual(saved.ticks.map(value => [value.stations[0].brand, value.stations[0].title]), [["Лукойл", "АЗС Лукойл"], ["Роснефть", "АЗС Роснефть"], ["Лукойл", "АЗС Лукойл"]]);
  assert.equal(saved.stations.s1.brand, "Лукойл");
  assert.deepEqual(saved.stations.s1.labels, [["АЗС Лукойл", "Лукойл"], ["АЗС Роснефть", "Роснефть"]]);
});

test("statistics skip expired ticks left in a partly expired day and survive a day pruned while reading", async () => {
  const config = await config90();
  config.history.retentionDays = 7;
  const path = await tempHistory();
  await recordHistory(path, snapshot("2026-09-01T08:00:00Z"), config);
  await recordHistory(path, snapshot("2026-09-01T12:00:00Z"), config);
  await recordHistory(path, snapshot("2026-09-08T10:00:00Z"), config);
  const seen = [];
  await forEachHistoryDay(path, {}, ticks => { seen.push(...ticks.map(value => value.fetchedAt)); });
  assert.deepEqual(seen, ["2026-09-01T12:00:00Z", "2026-09-08T10:00:00Z"]);
  const layout = historyLayout(path);
  await writeFile(join(layout.ticksDir, "2026-09-02.jsonl"), "");
  const { unlink } = await import("node:fs/promises");
  const visited = [];
  await forEachHistoryDay(path, {}, async (ticks, day) => { visited.push(day); if (day === "2026-09-01") await unlink(join(layout.ticksDir, "2026-09-02.jsonl")); });
  assert.deepEqual(visited, ["2026-09-01", "2026-09-02", "2026-09-08"]);
});

test("a reader that loaded the dictionary before a new station was written still names it", async () => {
  const config = await config90();
  const path = await tempHistory();
  await recordHistory(path, snapshot("2026-09-01T10:00:00Z"), config);
  const layout = historyLayout(path);
  const stale = await readFile(layout.stations, "utf8");
  await recordHistory(path, { ...snapshot("2026-09-02T10:00:00Z"), assessments: [{ ...assessment("AVAILABLE"), stationKey: "new", title: "Новая АЗС" }] }, config);
  const fresh = await readFile(layout.stations, "utf8");
  await writeFile(layout.stations, stale);
  const seen = [];
  // The collection lands while the reader is between days: the dictionary it loaded does not know "new".
  await forEachHistoryDay(path, {}, async ticks => { for (const tick of ticks) for (const value of tick.stations) seen.push(value.title); await writeFile(layout.stations, fresh); });
  assert.deepEqual(seen, ["АЗС 1", "Новая АЗС"]);
});
