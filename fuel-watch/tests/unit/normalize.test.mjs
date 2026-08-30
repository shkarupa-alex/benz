import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { normalizeStatus, okResult } from "../../scripts/lib/sources/common.mjs";
import { assessRequestedUnion } from "../../scripts/lib/verdict.mjs";

test("negative and unknown phrases cannot become availability", () => {
  for (const value of ["unavailable", "not available", "нет в наличии", "не в наличии", "отсутствует в наличии"]) assert.equal(normalizeStatus(value), "OUT_OF_STOCK", value);
  assert.equal(normalizeStatus("нет данных"), "UNKNOWN");
  assert.equal(normalizeStatus("в наличии"), "IN_STOCK");
});

test("negative source phrase cannot enter the destination list end to end", async () => {
  const config = await loadConfig();
  const request = { requestedProducts: config.requestedProducts, fetchedAt: "2026-08-30T10:00:00Z" };
  const normalized = okResult("yandex", { stations: [{ id: "1", coordinate: [44.5, 48.7] }], observations: [{ stationId: "1", fuel: "АИ-95 Экто", status: "нет в наличии", observedAt: "2026-08-30T09:48:00Z" }] }, request, config);
  const result = assessRequestedUnion({ observations: normalized.observations, config, now: new Date(request.fetchedAt) });
  assert.notEqual(result.verdict, "AVAILABLE");
  assert.notEqual(result.verdict, "LIKELY_AVAILABLE");
});

test("family-only adapter cannot create exact variant evidence", async () => {
  const config = await loadConfig();
  const request = { requestedProducts: config.requestedProducts, fetchedAt: "2026-08-30T10:00:00Z" };
  const result = okResult("gdebenz", { stations: [{ id: "1", coordinate: [44.5, 48.7] }], observations: [{ stationId: "1", fuel: "АИ-95", status: "есть", minMinutes: 5, maxMinutes: 10 }] }, request, config, { capability: "CURRENT_FAMILY" });
  assert.equal(result.observations[0].product.specificity, "FAMILY_ONLY");
  assert.equal(result.observations[0].product.productKey, "AI95_FAMILY");
});
