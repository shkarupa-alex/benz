import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { classifyFuelLabel, normalizeFuelLabel, petrolOctaneKey } from "../../scripts/lib/fuels.mjs";

test("normalizes Unicode, separators and selected homoglyphs", () => {
  assert.equal(normalizeFuelLabel("  АИ_95—G-Drive  "), "аи 95 g drиvе");
});

test("requires an AI-95 family token before a marketing alias", async () => {
  const config = await loadConfig();
  assert.equal(classifyFuelLabel("G-Drive", config.requestedProducts), null);
  assert.equal(classifyFuelLabel("АИ-95 G-Drive", config.requestedProducts).productKey, "AI95_GDRIVE");
  assert.equal(classifyFuelLabel("АИ-95 Turbo", config.requestedProducts).productKey, "AI95_UNKNOWN");
});

test("plus grade never collapses into base AI-95", async () => {
  const config = await loadConfig();
  assert.equal(classifyFuelLabel("АИ-95+", config.requestedProducts).productKey, "AI95_PREMIUM_GENERIC");
  assert.equal(classifyFuelLabel("95+", config.requestedProducts).productKey, "AI95_PREMIUM_GENERIC");
  assert.equal(classifyFuelLabel("АИ-95", config.requestedProducts).productKey, "AI95_BASE");
});

test("collapses branded variants into one octane grade for reports and history", () => {
  assert.equal(petrolOctaneKey({ productKey: "AI95_BASE" }), "95");
  assert.equal(petrolOctaneKey({ productKey: "AI95_GDRIVE" }), "95");
  assert.equal(petrolOctaneKey({ gradeLabel: "АИ-95 Экто" }), "95");
  assert.equal(petrolOctaneKey({ gradeLabel: "92 Премиум" }), "92");
  assert.equal(petrolOctaneKey({ gradeLabel: "АИ-100 G-Drive" }), "100");
  assert.equal(petrolOctaneKey({ gradeLabel: "ДТ" }), undefined);
});
