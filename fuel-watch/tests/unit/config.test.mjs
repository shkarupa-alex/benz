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
