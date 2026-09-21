import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfigPath, loadConfig, validateAreaSpec } from "../../scripts/lib/config.mjs";

test("config loading rejects two manual members from the same source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fuel-watch-config-"));
  try {
    const config = JSON.parse(await readFile(defaultConfigPath, "utf8"));
    config.identity.manualOverrides = [{ stationKey: "bad", members: [{ source: "2gis", sourceStationId: "a" }, { source: "2gis", sourceStationId: "b" }] }];
    const path = join(directory, "config.json");
    await writeFile(path, JSON.stringify(config));
    await assert.rejects(loadConfig(path), error => error.name === "ConfigError" && /sources contains duplicate "2gis"/u.test(error.message));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// A one-off area file is not the config, so it gets the same schema treatment instead of crashing inside turf.
test("a one-off area spec is validated against the same schema as the configured zone", async () => {
  const corridor = { kind: "route-corridor", label: "Коридор", waypoints: [[44.49, 48.72], [44.60, 48.80]], corridorWidthMeters: 4000 };
  assert.deepEqual(await validateAreaSpec(corridor), corridor);
  await assert.rejects(() => validateAreaSpec({ kind: "route-corridor", label: "Коридор", waypoints: [[44.49, 48.72], [44.60, 48.80]] }), error => error.name === "ConfigError" && error.errors.join(" ").includes("corridorWidthMeters"));
  await assert.rejects(() => validateAreaSpec({ kind: "не-такой", label: "x" }), error => error.name === "ConfigError");
  await assert.rejects(() => validateAreaSpec({ kind: "route-corridor", label: "Коридор", waypoints: [[44.49, 48.72]], corridorWidthMeters: 4000 }), error => error.name === "ConfigError");
});

// A truncated coordinate used to satisfy the schema and only fail deep inside turf, which is the internal geometry
// error the validation exists to prevent. The message must also name the offending field, not every branch tried.
test("a malformed one-off area is rejected by field name instead of dying inside turf", async () => {
  // Only the branch the kind selects may speak: errors from the three kinds the file is not are noise that hides
  // the real one, which is what a bare oneOf produced.
  const rejects = (area, pattern, foreign) => assert.rejects(() => validateAreaSpec(area), error => {
    const text = error.errors.join(" ");
    assert.equal(error.name, "ConfigError");
    assert.match(text, pattern);
    assert.doesNotMatch(text, foreign, `only the ${area.kind} branch may report errors, got: ${text}`);
    assert.doesNotMatch(text, /"then" schema/u, `dispatch bookkeeping must not reach the user, got: ${text}`);
    return true;
  });
  await rejects({ kind: "route-corridor", label: "Коридор", waypoints: [[44.49], [44.60, 48.80]], corridorWidthMeters: 1000 }, /waypoints\/0.*fewer than 2 items/u, /south|coordinates|anchors/u);
  await rejects({ kind: "route-corridor", label: "Коридор", waypoints: [[44.49, 48.72], [44.60, 48.80]], corridorWidthMeters: "1000" }, /corridorWidthMeters must be number/u, /south|coordinates|anchors/u);
  await rejects({ kind: "rectangle", label: "Прямоугольник", south: 48.6, west: 44.3, north: 48.9 }, /required property 'east'/u, /waypoints|coordinates|anchors/u);
  await rejects({ kind: "polygon", label: "Полигон", coordinates: [[44.4, 48.7], [44.5, 48.8], [44.6]] }, /coordinates\/2.*fewer than 2 items/u, /waypoints|south|anchors/u);
});
