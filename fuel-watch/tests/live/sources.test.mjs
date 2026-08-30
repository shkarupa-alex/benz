import test from "node:test";
import assert from "node:assert/strict";
import { collectSnapshot } from "../../scripts/collect.mjs";

test("opt-in live source smoke test", { skip: process.env.FUEL_WATCH_LIVE !== "1", timeout: 240000 }, async () => {
  const result = await collectSnapshot();
  assert.ok(result.snapshot.sourceHealth.length === 3);
  assert.ok(result.snapshot.sourceHealth.some(h => h.status !== "DISABLED"));
});
