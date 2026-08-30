import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQueues } from "../../scripts/lib/queue.mjs";
import { rankAssessments } from "../../scripts/lib/ranking.mjs";

test("presence-only queue is incomparable", () => {
  const queue = normalizeQueues([{ kind: "PRESENCE", rawValue: "есть", time: { kind: "UNKNOWN" } }]);
  assert.equal(queue.comparable, false);
  assert.match(queue.displayText, /размер неизвестен/);
});

test("transaction resumption outranks a shorter measured queue", () => {
  const base = { verdict: "AVAILABLE", confidence: "MEDIUM", observations: [], coordinate: [44,48] };
  const resumed = { ...base, stationKey: "b", activity: [{kind:"TRANSACTIONS_RESUMED"}], queue: { comparable: true, vehicleCount: 10 } };
  const short = { ...base, stationKey: "a", activity: [], queue: { comparable: true, vehicleCount: 1 } };
  assert.equal(rankAssessments([short, resumed], [44,48])[0].stationKey, "b");
});
