import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { isInsideArea, resolveArea, samePlace } from "../../scripts/lib/geometry.mjs";

test("Volgograd hull includes all anchors and control stations", async () => {
  const config = await loadConfig();
  const area = resolveArea(config.area);
  for (const anchor of config.area.anchors) assert.equal(isInsideArea(anchor.point, area), true, anchor.label);
  assert.deepEqual(config.area.anchors.find(anchor => anchor.label === "ул. Рокоссовского, 80А")?.point, [44.530817, 48.733956]);
  assert.deepEqual(config.area.anchors.find(anchor => anchor.label === "ул. Рокоссовского, 175")?.point, [44.525837, 48.748086]);
  assert.equal(isInsideArea([44.4940448, 48.7150466], area), true);
  assert.equal(isInsideArea([44.4925455, 48.7101139], area), true);
});

test("anchor pinning uses exact normalized address, not substring", () => {
  assert.equal(samePlace("Ангарская ул., 162", "Ангарская ул., 16"), false);
  assert.equal(samePlace("г. Волгоград, Ангарская ул., 162", "Ангарская ул., 162"), true);
});

test("rejects collinear anchor geometry", () => {
  assert.throws(() => resolveArea({ kind: "station-anchors", label: "x", anchors: [{point:[1,1]}, {point:[2,2]}, {point:[3,3]}], bufferMeters: 0 }), /collinear/);
});

test("rejects a self-intersecting polygon", () => {
  assert.throws(() => resolveArea({ kind:"polygon", label:"x", coordinates:[[0,0],[1,1],[0,1],[1,0]] }), /self-intersects/);
});
