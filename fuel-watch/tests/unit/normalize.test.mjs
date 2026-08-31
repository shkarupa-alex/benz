import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { brandLabel, normalizeAddress, normalizeBrand, normalizeComparableBrand } from "../../scripts/lib/normalize.mjs";
import { normalizeCoordinate, normalizeStatus, okResult, validCoordinate } from "../../scripts/lib/sources/common.mjs";
import { assessRequestedUnion } from "../../scripts/lib/verdict.mjs";

test("negative and unknown phrases cannot become availability", () => {
  for (const value of ["unavailable", "not available", "нет в наличии", "не в наличии", "отсутствует в наличии"]) assert.equal(normalizeStatus(value), "OUT_OF_STOCK", value);
  assert.equal(normalizeStatus("нет данных"), "UNKNOWN");
  assert.equal(normalizeStatus("в наличии"), "IN_STOCK");
  assert.equal(normalizeStatus("IN_STOCK"), "IN_STOCK");
  assert.equal(normalizeStatus("OUT_OF_STOCK"), "OUT_OF_STOCK");
});

test("serialized missing coordinates never become the real point zero-zero", () => {
  for (const value of [[null,null],["",""]]) assert.equal(validCoordinate(normalizeCoordinate(value)),false);
  assert.deepEqual(normalizeCoordinate(["44.5","48.7"]),[44.5,48.7]);
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

test("normalizes named, aliased, array and opaque structured brands without erasing them", () => {
  assert.equal(brandLabel({ id: 1, name: "Роснефть" }), "Роснефть");
  assert.equal(normalizeBrand({ id: 2, alias: "Лукойл" }), "лукойл");
  assert.equal(normalizeBrand([{ name: "Роснефть" }, { alias: "Пульсар" }]), "роснефть пульсар");
  assert.equal(normalizeBrand({ id: 42 }), "brand id 42");
  assert.equal(normalizeComparableBrand({ id: 42 }), "");
  assert.equal(normalizeComparableBrand({ alias: "Лукойл" }), "лукойл");
});

test("normalizes city prefixes but retains a trailing house letter", () => {
  assert.equal(normalizeAddress("Волгоградская обл., г. Волгоград, ул. Рокоссовского, 175"), "рокоссовского 175");
  assert.equal(normalizeAddress("ул. Землячки, 27 г"), "землячки 27 г");
  assert.equal(normalizeAddress("ул. Землячки, 27 г, Волгоград"), "землячки 27 г");
  assert.equal(normalizeAddress("ул. Землячки, 27, г. Волгоград"), "землячки 27");
  assert.notEqual(normalizeAddress("ул. Землячки, 27 г"), normalizeAddress("ул. Землячки, 27"));
  assert.notEqual(normalizeAddress("ул. Землячки, 27 г, Волгоград"), normalizeAddress("ул. Землячки, 27, г. Волгоград"));
});
