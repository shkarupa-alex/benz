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

// A one-off zone exists for a single run: its width and its ceilings are explicit, never inferred.
test("route corridor builds an explicit-width zone and fails closed above its own area ceiling", () => {
  const corridor = resolveArea({ kind: "route-corridor", label: "Волгоград → Камышин", waypoints: [[44.49, 48.72], [45.40, 50.10]], corridorWidthMeters: 6000 });
  assert.ok(corridor.squareKm > 900 && corridor.squareKm < 1200, `unexpected corridor area ${corridor.squareKm}`);
  assert.equal(isInsideArea([44.49, 48.72], corridor), true);
  assert.equal(isInsideArea([43.00, 48.72], corridor), false);
  assert.throws(() => resolveArea({ kind: "route-corridor", label: "too wide", waypoints: [[44.49, 48.72], [45.40, 50.10]], corridorWidthMeters: 6000, maxAreaSquareKm: 100 }), /above the configured limit of 100/);
  assert.throws(() => resolveArea({ kind: "route-corridor", label: "degenerate", waypoints: [[44.49, 48.72], [44.49, 48.72]], corridorWidthMeters: 6000 }), /at least two distinct waypoints/);
});

test("an unknown area kind is rejected instead of being treated as station anchors", () => {
  assert.throws(() => resolveArea({ kind: "whatever", label: "x" }), /Unsupported area kind: whatever/);
  assert.throws(() => resolveArea(undefined), /Unsupported area kind: missing/);
});

test("a one-off area carries its station ceiling through to the resolved zone", () => {
  assert.equal(resolveArea({ kind: "rectangle", label: "z", south: 48.7, west: 44.4, north: 48.8, east: 44.5, maxStationCount: 40 }).maxStationCount, 40);
  assert.equal(resolveArea({ kind: "rectangle", label: "z", south: 48.7, west: 44.4, north: 48.8, east: 44.5 }).maxStationCount, undefined);
  assert.equal(resolveArea({ kind: "route-corridor", label: "z", waypoints: [[44.49, 48.72], [44.60, 48.80]], corridorWidthMeters: 2000, maxStationCount: 40 }).maxStationCount, 40);
});

// A corridor that loops back on itself buffers into a polygon with a hole; the ranking reference point must not
// land in that hole, and it must stay bit-identical to the plain centroid for ordinary convex zones.
test("the zone's reference point is always inside the zone", () => {
  const hull = resolveArea({ kind: "rectangle", label: "z", south: 48.70, west: 44.40, north: 48.80, east: 44.60 });
  assert.deepEqual(hull.interiorPoint, [44.5, 48.75]);
  assert.equal(isInsideArea(hull.interiorPoint, hull), true);
  const loop = resolveArea({ kind: "route-corridor", label: "кольцо", waypoints: [[44.45, 48.70], [44.60, 48.70], [44.60, 48.82], [44.45, 48.82], [44.46, 48.705]], corridorWidthMeters: 1500 });
  assert.equal(isInsideArea(loop.interiorPoint, loop), true, "a ring-shaped corridor must not place the reference point in its hole");
});
