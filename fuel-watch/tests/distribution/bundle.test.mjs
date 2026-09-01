import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const skillRoot = resolve(import.meta.dirname, "../..");

test("bundle initializes and preserves external state without node_modules", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fuel-watch-dist-"));
  const installed = join(directory, "installed-skill");
  const userHome = join(directory, "user-state");
  try {
    await installArtifact(installed);
    for (const entry of ["collect.mjs", "report.mjs", "monitor.mjs", "resolve-area.mjs"]) {
      const loaded = await runImport(join(installed, "dist", "scripts", entry));
      assert.equal(loaded.code, 0, `${entry}: ${loaded.stderr}`);
    }
    const first = await runNode(join(installed, "dist", "scripts", "monitor.mjs"), ["init"], { FUEL_WATCH_HOME: userHome });
    assert.equal(first.code, 0, first.stderr);
    const firstState = JSON.parse(first.stdout);
    assert.match(firstState.stateDir, /user-state\/monitors\//);
    const configPath = join(userHome, "config", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.monitoring.intervalMinutes = 30;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    await rm(installed, { recursive: true, force: true });
    await installArtifact(installed);
    const second = await runNode(join(installed, "dist", "scripts", "monitor.mjs"), ["init"], { FUEL_WATCH_HOME: userHome });
    assert.equal(second.code, 0, second.stderr);
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).monitoring.intervalMinutes, 30);
    assert.equal(await exists(join(installed, "node_modules")), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function installArtifact(installed) {
  await cp(join(skillRoot, "dist"), join(installed, "dist"), { recursive: true });
}

function runNode(script, args, extraEnv) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...extraEnv } });
    let stdout = "", stderr = "";
    child.stdout.on("data", value => { stdout += value; });
    child.stderr.on("data", value => { stderr += value; });
    child.on("error", reject);
    child.on("close", code => resolvePromise({ code, stdout, stderr }));
  });
}

function runImport(modulePath) {
  return runNode("--input-type=module", ["--eval", "await import(process.argv[2])", "bundle-smoke", modulePath], {});
}

async function exists(path) { try { await stat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
