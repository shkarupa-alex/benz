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
