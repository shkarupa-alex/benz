import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { classifyFuelLabel, normalizeFuelLabel } from "../../scripts/lib/fuels.mjs";

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
