import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQueues } from "../../scripts/lib/queue.mjs";
import { rankAssessments, rankKey } from "../../scripts/lib/ranking.mjs";

test("presence-only queue is incomparable", () => {
  const queue = normalizeQueues([{ kind: "PRESENCE", rawValue: "есть", time: { kind: "UNKNOWN" } }]);
  assert.equal(queue.comparable, false);
  assert.match(queue.displayText, /размер неизвестен/);
});

test("transaction resumption outranks a shorter measured queue", () => {
  const base = { verdict: "AVAILABLE", confidence: "MEDIUM", observations: [], coordinate: [44,48] };
  const resumed = { ...base, stationKey: "b", activity: [{kind:"TRANSACTIONS_RESUMED",gradeLabel:"95",latestEventAt:"2026-08-30T09:55:00Z"}], queue: { comparable: true, vehicleCount: 10 } };
  const short = { ...base, stationKey: "a", activity: [], queue: { comparable: true, vehicleCount: 1 } };
  assert.equal(rankAssessments([short, resumed], [44,48],new Date("2026-08-30T10:00:00Z"))[0].stationKey, "b");
});

test("recent observed transition outranks an older run", () => {
  const base = { verdict: "AVAILABLE", confidence: "MEDIUM", observations: [], activity: [], coordinate: [44,48], queue: { comparable: false } };
  const old = { ...base, stationKey: "old", availabilityRun: { basis: "OBSERVED_TRANSITION", firstObservedAt: "2026-08-30T07:00:00Z" } };
  const recent = { ...base, stationKey: "recent", availabilityRun: { basis: "OBSERVED_TRANSITION", firstObservedAt: "2026-08-30T09:55:00Z" } };
  assert.equal(rankAssessments([old, recent], [44,48], new Date("2026-08-30T10:00:00Z"))[0].stationKey, "recent");
});

test("catalog and expired positives have zero ranking support", () => {
  const current={source:"yandex",status:"IN_STOCK",ageMinutes:5,expired:false,product:{specificity:"EXACT_VARIANT"}};
  const catalog={source:"2gis",status:"IN_STOCK",ageMinutes:1,expired:false,product:{specificity:"CATALOG_ONLY"}};
  const expired={source:"gdebenz",status:"IN_STOCK",ageMinutes:500,expired:true,product:{specificity:"FAMILY_ONLY"}};
  const base={verdict:"AVAILABLE",confidence:"MEDIUM",activity:[],coordinate:[44,48],queue:{comparable:false}};
  const honest={...base,stationKey:"a",observations:[current]};
  const inflated={...base,stationKey:"b",observations:[current,catalog,expired]};
  assert.equal(rankAssessments([inflated,honest],[44,48])[0].stationKey,"a");
});

test("AI-92 or stale activity cannot boost an AI-95 recommendation", () => {
  const now=new Date("2026-08-30T10:00:00Z");
  const base={stationKey:"s",verdict:"AVAILABLE",confidence:"MEDIUM",coordinate:[44.5,48.7],observations:[],queue:{kind:"UNKNOWN"}};
  const ai92={...base,activity:[{kind:"TRANSACTIONS_RESUMED",gradeLabel:"92",latestEventAt:"2026-08-30T09:55:00Z"}]};
  const stale95={...base,activity:[{kind:"TRANSACTIONS_RESUMED",gradeLabel:"95",latestEventAt:"2026-08-29T09:55:00Z"}]};
  assert.equal(rankKey(ai92,[44.5,48.7],now)[0],2);
  assert.equal(rankKey(stale95,[44.5,48.7],now)[0],2);
});
