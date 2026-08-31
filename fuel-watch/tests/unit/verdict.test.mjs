import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { assessRequestedUnion, assessStation } from "../../scripts/lib/verdict.mjs";

const product = { family: "AI_95", variant: "BASE", variantKey: "BASE", specificity: "EXACT_VARIANT", productKey: "AI95_BASE" };
const observation = (source, status, minutes) => ({ source, product, status, time: { kind: "EXACT", observedAt: new Date(Date.now() - minutes * 60000).toISOString() } });

test("fresh opposing direct evidence is conflicting", async () => {
  const config = await loadConfig();
  const result = assessStation({ observations: [observation("yandex", "IN_STOCK", 5), observation("2gis", "OUT_OF_STOCK", 10)], config, sourceGroups: { yandex: "a", "2gis": "b" } });
  assert.equal(result.verdict, "CONFLICTING");
});

test("same provenance group does not upgrade confidence", async () => {
  const config = await loadConfig();
  config.activity.minimumEvents = 99;
  const result = assessStation({ observations: [observation("yandex", "IN_STOCK", 5), observation("gdebenz", "IN_STOCK", 7)], config, sourceGroups: { yandex: "shared", gdebenz: "shared" } });
  assert.equal(result.confidence, "MEDIUM");
});

test("unknown-time evidence cannot qualify current availability", async () => {
  const config = await loadConfig();
  const result = assessStation({ observations: [{ source: "yandex", product, status: "IN_STOCK", time: { kind: "UNKNOWN" } }], config });
  assert.equal(result.verdict, "NO_FRESH_DATA");
});

test("negative for one variant does not negate another positive variant", async () => {
  const config = await loadConfig();
  const base = { ...product, productKey: "AI95_BASE", variantKey: "BASE" };
  const premium = { ...product, productKey: "AI95_GDRIVE", variant: "BRANDED", variantKey: "GDRIVE" };
  const observations = [
    { ...observation("yandex", "OUT_OF_STOCK", 5), product: base },
    { ...observation("yandex", "IN_STOCK", 5), product: premium }
  ];
  const result = assessRequestedUnion({ observations, config, sourceGroups: { yandex: "shared" } });
  assert.equal(result.verdict, "AVAILABLE");
});

test("union is not negative until every configured member is covered", async () => {
  const config = await loadConfig();
  const result = assessRequestedUnion({ observations: [{ ...observation("yandex", "OUT_OF_STOCK", 5), product }], config, sourceGroups: { yandex: "shared" } });
  assert.equal(result.verdict, "NO_FRESH_DATA");
});

test("fresh bounded age uses conservative maximum and remains usable", async () => {
  const config = await loadConfig();
  const result = assessStation({ observations: [{ source: "gdebenz", product, status: "IN_STOCK", time: { kind: "BOUNDED_AGE", minMinutes: 5, maxMinutes: 10 } }], config, now: new Date("2026-08-30T10:00:00Z") });
  assert.equal(result.verdict, "AVAILABLE");
  assert.equal(result.observations[0].ageMinutes, 10);
  assert.equal(result.observations[0].approximate, true);
});

test("only explicit family-all negative can negate configured union", async () => {
  const config = await loadConfig();
  const family = { family: "AI_95", variant: "UNKNOWN", specificity: "FAMILY_ONLY", productKey: "AI95_FAMILY" };
  const base = { source: "gdebenz", product: family, status: "OUT_OF_STOCK", time: { kind: "BOUNDED_AGE", minMinutes: 5, maxMinutes: 10 } };
  assert.notEqual(assessRequestedUnion({ observations: [base], config }).verdict, "NOT_AVAILABLE");
  assert.equal(assessRequestedUnion({ observations: [{ ...base, familyAllUnavailable: true }], config }).verdict, "NOT_AVAILABLE");
});

test("resumed AI-92 activity cannot imply current AI-95 availability", async () => {
  const config = await loadConfig();
  const activity = [{ source: "2gis", gradeLabel: "92", kind: "TRANSACTIONS_RESUMED", gradeSpecific: true }];
  const result = assessRequestedUnion({ observations: [], activity, config });
  assert.equal(result.verdict, "NO_FRESH_DATA");
});

test("newer direct negative outranks older resumed AI-95 activity", async () => {
  const config = await loadConfig();
  const now = new Date("2026-08-30T10:00:00Z");
  const negative = { source:"2gis", product, status:"OUT_OF_STOCK", time:{kind:"EXACT",observedAt:"2026-08-30T09:55:00Z"} };
  const activity = [{ source:"benzonavt", product, kind:"TRANSACTIONS_RESUMED", gradeSpecific:true, resumedAt:"2026-08-30T09:00:00Z", latestEventAt:"2026-08-30T09:05:00Z" }];
  assert.equal(assessStation({observations:[negative],activity,config,now}).verdict,"NOT_AVAILABLE");
});

test("near-simultaneous negative and resumed AI-95 activity are conflicting", async () => {
  const config = await loadConfig();
  const now = new Date("2026-08-30T10:00:00Z");
  const negative = { source:"2gis", product, status:"OUT_OF_STOCK", time:{kind:"EXACT",observedAt:"2026-08-30T09:55:00Z"} };
  const activity = [{ source:"benzonavt", product, kind:"TRANSACTIONS_RESUMED", gradeSpecific:true, latestEventAt:"2026-08-30T09:50:00Z" }];
  assert.equal(assessStation({observations:[negative],activity,config,now}).verdict,"CONFLICTING");
});

test("family-wide negative participates in activity timestamp arbitration", async () => {
  const config = await loadConfig();
  const now = new Date("2026-08-30T10:00:00Z");
  const family = { family:"AI_95", variant:"UNKNOWN", specificity:"FAMILY_ONLY", productKey:"AI95_FAMILY" };
  const negative = { source:"gdebenz", product:family, status:"OUT_OF_STOCK", familyAllUnavailable:true, time:{kind:"EXACT",observedAt:"2026-08-30T09:55:00Z"} };
  const activity = [{ source:"gdebenz", product, kind:"TRANSACTIONS_RESUMED", gradeSpecific:true, latestEventAt:"2026-08-30T09:50:00Z" }];
  const close = assessRequestedUnion({observations:[negative],activity,config,now});
  assert.equal(close.verdict,"CONFLICTING");
  const olderActivity = [{...activity[0],latestEventAt:"2026-08-30T09:00:00Z"}];
  assert.equal(assessRequestedUnion({observations:[negative],activity:olderActivity,config,now}).verdict,"NOT_AVAILABLE");
});
