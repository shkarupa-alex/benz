import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const deploy = join(root, "deploy", "linux");

async function userHome(intervalMinutes, retentionDays) {
  const home = await mkdtemp(join(tmpdir(), "fuel-watch-deploy-"));
  const config = JSON.parse(await readFile(join(root, "config", "config.json"), "utf8"));
  config.monitoring.intervalMinutes = intervalMinutes;
  config.history.retentionDays = retentionDays;
  await mkdir(join(home, "config"), { recursive: true });
  await writeFile(join(home, "config", "config.json"), JSON.stringify(config));
  return home;
}
const print = home => spawnSync("sh", [join(deploy, "install-systemd-user.sh"), "--print"], { encoding: "utf8", env: { ...process.env, FUEL_WATCH_HOME: home } });

test("the systemd timer fires at the configured collection interval", async () => {
  const quarter = print(await userHome(15, 90));
  assert.equal(quarter.status, 0, quarter.stderr);
  assert.match(quarter.stdout, /^OnCalendar=\*:0\/15$/m);
  assert.match(quarter.stdout, /^Type=oneshot$/m);
  assert.ok(quarter.stdout.includes(`\nExecStart=/bin/sh "${root}/deploy/linux/fuel-watch-collect.sh"\n`));
  assert.doesNotMatch(quarter.stderr, /retentionDays/);
  assert.match(print(await userHome(120, 90)).stdout, /^OnCalendar=0\/2:00$/m);
  assert.match(print(await userHome(25, 90)).stdout, /^OnUnitActiveSec=25min$/m);
  assert.match(print(await userHome(15, 7)).stderr, /keeps history for 7 days/);
});

test("the collection wrapper keeps the snapshot out of the journal and returns the collector's exit code", async () => {
  const fake = await mkdtemp(join(tmpdir(), "fuel-watch-fake-root-"));
  await mkdir(join(fake, "dist", "scripts"), { recursive: true });
  const snapshot = { fetchedAt: "2026-10-13T08:00:00.000Z", assessments: [{ verdict: "AVAILABLE" }, { verdict: "NOT_AVAILABLE" }, { verdict: "AVAILABLE" }], sourceHealth: [{ source: "gdebenz", status: "OK" }, { source: "2gis", status: "CHALLENGE" }], warnings: [{ code: "SOURCE_CHALLENGE" }, { code: "SOURCE_CHALLENGE" }] };
  await writeFile(join(fake, "dist", "scripts", "collect.mjs"), `process.stdout.write(${JSON.stringify(JSON.stringify({ snapshot, exitCode: 0 }))}); process.exitCode = Number(process.env.FAKE_EXIT ?? 0);`);
  const run = exit => spawnSync("sh", [join(deploy, "fuel-watch-collect.sh")], { encoding: "utf8", env: { ...process.env, FUEL_WATCH_ROOT: fake, FAKE_EXIT: String(exit) } });
  const ok = run(0);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout, "fuel-watch: exit=0 at=2026-10-13T08:00:00.000Z stations=3 verdicts={\"AVAILABLE\":2,\"NOT_AVAILABLE\":1} sources=gdebenz:OK,2gis:CHALLENGE warnings=SOURCE_CHALLENGE\n");
  assert.equal(run(2).status, 2);
  await writeFile(join(fake, "dist", "scripts", "collect.mjs"), "process.stderr.write('boom\\n'); process.exit(2);");
  const failed = run(0);
  assert.equal(failed.status, 2);
  assert.match(failed.stdout, /exit=2, no snapshot/);
});

test("unit files quote a skill path with spaces and refuse characters systemd would reinterpret", async () => {
  const home = await userHome(15, 90);
  const install = async name => {
    const skill = join(await mkdtemp(join(tmpdir(), "fuel-watch-path-")), name);
    await cp(deploy, join(skill, "deploy", "linux"), { recursive: true });
    await mkdir(join(skill, "dist", "scripts"), { recursive: true });
    await writeFile(join(skill, "dist", "scripts", "collect.mjs"), "");
    return spawnSync("sh", [join(skill, "deploy", "linux", "install-systemd-user.sh"), "--print"], { encoding: "utf8", env: { ...process.env, FUEL_WATCH_HOME: home } });
  };
  const spaced = await install("my skills");
  assert.equal(spaced.status, 0, spaced.stderr);
  assert.match(spaced.stdout, /^ExecStart=\/bin\/sh ".*\/my skills\/deploy\/linux\/fuel-watch-collect\.sh"$/m);
  assert.match(spaced.stdout, /^Environment="FUEL_WATCH_ROOT=.*\/my skills"$/m);
  const percent = await install("100%");
  assert.equal(percent.status, 1);
  assert.match(percent.stderr, /unsupported character/);
});
