import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfigPath, loadConfig } from "../../scripts/lib/config.mjs";

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
