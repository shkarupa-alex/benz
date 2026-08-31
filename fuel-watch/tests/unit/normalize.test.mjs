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

test("family-only current observations stay family-only while grade-specific history stays exact", async () => {
  const config = await loadConfig();
  const request = { requestedProducts: config.requestedProducts, fetchedAt: "2026-08-30T10:00:00Z" };
  const result = okResult("gdebenz", { stations: [{ id: "1", coordinate: [44.5, 48.7] }], observations: [{ stationId: "1", fuel: "АИ-95", status: "есть", minMinutes: 5, maxMinutes: 10 }] }, request, config, { capability: "CURRENT_FAMILY" });
  assert.equal(result.observations[0].product.specificity, "FAMILY_ONLY");
  assert.equal(result.observations[0].product.productKey, "AI95_FAMILY");
  const withActivity = okResult("gdebenz", { stations: [{ id: "1", coordinate: [44.5, 48.7] }], activity: [{ stationId: "1", fuel: "АИ-95", kind: "TRANSACTIONS_RESUMED", gradeSpecific: true }] }, request, config, { capability: "CURRENT_FAMILY" });
  assert.equal(withActivity.activity[0].product.specificity, "EXACT_VARIANT");
  assert.equal(withActivity.activity[0].gradeSpecific, true);
});

test("optional history coverage is diagnostic and does not degrade healthy current data", async () => {
  const config = await loadConfig();
  const request = { requestedProducts: config.requestedProducts, fetchedAt: "2026-08-30T10:00:00Z" };
  const result = okResult("benzonavt", { stations:[{id:"1",coordinate:[44.5,48.7]}], observations:[{stationId:"1",fuel:"АИ-95",status:"есть",observedAt:"2026-08-30T09:55:00Z"}], activityHistoryCoverage:0.5 }, request, config);
  assert.equal(result.health.status,"OK");
  assert.equal(result.health.code,undefined);
  assert.equal(result.observations[0].status,"IN_STOCK");
  assert.equal(result.coverage.activityHistoryCoverage,0.5);
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
  assert.equal(normalizeAddress("ул. Землячки, 27 г"), "землячки 27г");
  assert.equal(normalizeAddress("ул. Землячки, 27 г, Волгоград"), "землячки 27г");
  assert.equal(normalizeAddress("ул. Землячки, 27, г. Волгоград"), "землячки 27");
  assert.notEqual(normalizeAddress("ул. Землячки, 27 г"), normalizeAddress("ул. Землячки, 27"));
  assert.notEqual(normalizeAddress("ул. Землячки, 27 г, Волгоград"), normalizeAddress("ул. Землячки, 27, г. Волгоград"));
});

test("normalizes attached house letters and ignores an unseparated postal code before city", () => {
  assert.equal(normalizeAddress("ул. Землячки, 27Г"), normalizeAddress("ул. Землячки, 27 г"));
  assert.equal(normalizeAddress("400075 г. Волгоград, ул. Мира, 27"), "мира 27");
});

test("normalizes slash corpus notation and preserves a street initial", () => {
  assert.equal(normalizeAddress("ул. Мира, 10/1"), "мира 10 корпус 1");
  assert.equal(normalizeAddress("ул. им. К. Маркса, 5", { "карла маркса": ["к маркса"] }), "карла маркса 5");
});

test("normalizes full and abbreviated letter qualifiers", () => {
  assert.equal(normalizeAddress("ул. Мира, 10, литера А"), "мира 10 литера а");
  assert.equal(normalizeAddress("ул. Мира, 10, лит. А"), "мира 10 литера а");
  assert.equal(normalizeAddress("ул. Мира, 10, корпус А"), "мира 10 корпус а");
  assert.equal(normalizeAddress("ул. Мира, 10, корп. А"), "мира 10 корпус а");
  assert.equal(normalizeAddress("ул. Мира, 10, строение Б"), "мира 10 строение б");
  assert.equal(normalizeAddress("ул. Мира, 10, стр. Б"), "мира 10 строение б");
  assert.equal(normalizeAddress("ул. им. К. А. Тимирязева, 5"), "к а тимирязева 5");
});
