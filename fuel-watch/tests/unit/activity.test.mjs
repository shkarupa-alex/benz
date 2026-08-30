import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { deriveActivityEvidence } from "../../scripts/lib/activity.mjs";

test("grade-specific quiet gap followed by two events becomes resumed", async () => {
  const config = await loadConfig();
  const now = new Date("2026-08-30T10:00:00Z");
  const [value] = deriveActivityEvidence([{ gradeSpecific: true, eventTimes: ["2026-08-30T08:30:00Z", "2026-08-30T09:50:00Z", "2026-08-30T09:55:00Z"], kind: "RECENT_SIGNAL" }], config, now.toISOString());
  assert.equal(value.kind, "TRANSACTIONS_RESUMED");
});

test("aggregate activity never becomes grade-specific resumption", async () => {
  const config = await loadConfig();
  const [value] = deriveActivityEvidence([{ gradeSpecific: false, eventTimes: ["2026-08-30T08:30:00Z", "2026-08-30T09:50:00Z", "2026-08-30T09:55:00Z"], kind: "TRANSACTIONS_RESUMED" }], config, "2026-08-30T10:00:00Z");
  assert.equal(value.kind, "RECENT_SIGNAL");
});
