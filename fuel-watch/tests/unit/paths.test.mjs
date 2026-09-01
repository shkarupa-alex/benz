import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureDefaultHistoryPath } from "../../scripts/lib/history.mjs";
import { fuelWatchHome, historyPath, latestSnapshotPath, monitorRoot, userConfigPath } from "../../scripts/lib/paths.mjs";

test("all mutable defaults share the external Fuel Watch home", () => {
  const env = { FUEL_WATCH_HOME: "/tmp/fuel-watch-user" };
  assert.equal(fuelWatchHome(env), "/tmp/fuel-watch-user");
  assert.equal(userConfigPath(env), join(env.FUEL_WATCH_HOME, "config", "config.json"));
  assert.equal(historyPath(env), join(env.FUEL_WATCH_HOME, "history", "history.json"));
  assert.equal(latestSnapshotPath(env), join(env.FUEL_WATCH_HOME, "state", "latest.json"));
  assert.equal(monitorRoot(env), join(env.FUEL_WATCH_HOME, "monitors"));
});

test("history keeps its explicit path override", () => {
  assert.equal(historyPath({ FUEL_WATCH_HOME: "/tmp/fuel-watch-user", FUEL_WATCH_HISTORY_PATH: "/tmp/custom-history.json" }), "/tmp/custom-history.json");
});

test("legacy history is copied once without overwriting the new location", async () => {
  const root = await mkdtemp(join(tmpdir(), "fuel-watch-paths-"));
  const env = { HOME: join(root, "legacy-home"), FUEL_WATCH_HOME: join(root, "new-home") };
  const legacy = join(env.HOME, ".local", "state", "fuel-watch", "history.json");
  try {
    await mkdir(join(legacy, ".."), { recursive: true });
    await writeFile(legacy, "legacy");
    const target = await ensureDefaultHistoryPath(env);
    assert.equal(await readFile(target, "utf8"), "legacy");
    await writeFile(target, "new");
    await ensureDefaultHistoryPath(env);
    assert.equal(await readFile(target, "utf8"), "new");
  } finally { await rm(root, { recursive: true, force: true }); }
});
