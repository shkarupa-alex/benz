import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const deploy = join(root, "deploy", "linux");

async function userHome(intervalMinutes, retentionDays, sampleIntervalMinutes) {
  const home = await mkdtemp(join(tmpdir(), "fuel-watch-deploy-"));
  const config = JSON.parse(await readFile(join(root, "config", "config.json"), "utf8"));
  config.monitoring.intervalMinutes = intervalMinutes;
  config.history.retentionDays = retentionDays;
  if (sampleIntervalMinutes) config.history.sampleIntervalMinutes = sampleIntervalMinutes;
  await mkdir(join(home, "config"), { recursive: true });
  await writeFile(join(home, "config", "config.json"), JSON.stringify(config));
  return home;
}
const print = (home, args = [], env = {}) => spawnSync("sh", [join(deploy, "install-systemd-user.sh"), "--print", ...args], { encoding: "utf8", env: { ...process.env, FUEL_WATCH_HOME: home, ...env } });

test("the systemd timer fires at the configured background interval", async () => {
  const quarter = print(await userHome(10, 90, 15));
  assert.equal(quarter.status, 0, quarter.stderr);
  assert.match(quarter.stdout, /^OnCalendar=\*:0\/15$/m);
  assert.match(quarter.stdout, /^Type=oneshot$/m);
  assert.ok(quarter.stdout.includes(`\nExecStart=/bin/sh "${root}/deploy/linux/fuel-watch-collect.sh"\n`));
  assert.doesNotMatch(quarter.stderr, /retentionDays/);
  assert.match(quarter.stderr, /about 96 full collections a day/);
  assert.match(print(await userHome(10, 90, 120)).stdout, /^OnCalendar=0\/2:00$/m);
  const odd = print(await userHome(10, 90, 25)).stdout;
  assert.match(odd, /^OnActiveSec=25min\nOnUnitActiveSec=25min$/m);
  assert.doesNotMatch(odd, /OnBootSec/, "a boot-relative timer fires at once on a machine that has been up for a while");
  assert.match(print(await userHome(10, 7, 15)).stderr, /keeps history for 7 days/);
});

test("before the first collection the installer points at the user config, never at the skill's template", async () => {
  const home = await mkdtemp(join(tmpdir(), "fuel-watch-deploy-empty-"));
  const run = print(home);
  assert.equal(run.status, 1);
  assert.ok(run.stderr.includes(`set history.sampleIntervalMinutes in ${join(home, "config", "config.json")}`), run.stderr);
  assert.ok(!run.stderr.includes(`in ${root}`), "the skill directory is never named as the place to edit");
  assert.match(run.stderr, /Never edit the config inside the skill directory/);
});

test("an out-of-range background interval is refused instead of installing a timer that cannot run", async () => {
  for (const value of [3, 2.5, "abc"]) {
    const run = print(await userHome(10, 90, value));
    assert.equal(run.status, 1, String(value));
    assert.match(run.stderr, /must be an integer from 5 to 1440/);
  }
  assert.match(print(await userHome(10, 90, 10)).stderr, /benzonavt has banned the IP/);
});

test("the timer needs an explicit background interval rather than the urgent monitoring cadence", async () => {
  // Without it a 10-minute monitoring template became a 144-runs-a-day timer, and a fixed schedule was measured
  // against 30-minute gaps, so every 3-hour step counted as missing data and no outage was ever completed.
  for (const args of [[], ["--on-calendar", "*-*-* 07,10,13,16,19,22:30:00"]]) {
    const run = print(await userHome(10, 90), args);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /set history\.sampleIntervalMinutes/);
    assert.equal(run.stdout, "");
  }
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
  const home = await userHome(10, 90, 15);
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

test("background sampling has its own interval and can run at fixed times of day", async () => {
  assert.match(print(await userHome(10, 90, 30)).stdout, /^OnCalendar=\*:0\/30$/m, "the timer follows history.sampleIntervalMinutes, not the urgent cadence");
  const fixed = print(await userHome(10, 90, 175), ["--on-calendar", "*-*-* 07,10,13,16,19,22:30:00"]);
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.match(fixed.stdout, /^OnCalendar=\*-\*-\* 07,10,13,16,19,22:30:00$/m);
  assert.doesNotMatch(fixed.stdout, /OnActiveSec|OnUnitActiveSec/);
  for (const args of [["--on-calendar"], ["--on-calendar", ""]]) {
    const bad = print(await userHome(10, 90, 175), args);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /--on-calendar requires a value/);
  }
  assert.match(print(await userHome(10, 90, 175), ["--bogus"]).stderr, /unknown argument: --bogus/);
  assert.match(print(await userHome(10, 90, 175), ["--uninstall"]).stderr, /exclude each other/);
});

// systemd-analyze as on Ubuntu: the next runs of six collections a day, or an error for a spec it rejects. Outside
// UTC each run line carries the local zone and a separate "(in UTC):" line follows; on a UTC host there is only the
// run line, already in UTC.
async function fakeSystemdAnalyze({ utcHost = false, hours = [4, 7, 10, 13, 16, 19], minutes = [30] } = {}) {
  const bin = await mkdtemp(join(tmpdir(), "fuel-watch-systemd-"));
  const runs = [];
  let index = 0;
  for (let day = 16; day <= 20; day++) for (const hour of hours) for (const minute of minutes) {
    const label = index++ ? `   Iteration #${index}` : "    Next elapse";
    const utc = `2026-10-${day} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00 UTC`;
    runs.push(utcHost ? `${label}: Fri ${utc}\n       From now: 1h left\n` : `${label}: Fri 2026-10-${day} 00:00:00 MSK\n       (in UTC): Fri ${utc}\n       From now: 1h left\n`);
  }
  await writeFile(join(bin, "systemd-analyze"), `#!/bin/sh\n[ "$3" = bogus ] && { echo "Failed to parse calendar specification 'bogus'" >&2; exit 1; }\ncat <<'EOF'\nNormalized form: x\n${runs.join("")}EOF\n`, { mode: 0o755 });
  return { PATH: `${bin}:${process.env.PATH}` };
}

test("a fixed schedule must match the background interval the forecast measures gaps against", async () => {
  const env = await fakeSystemdAnalyze();
  const calendar = ["--on-calendar", "*-*-* 07,10,13,16,19,22:30:00"];
  const ok = print(await userHome(10, 90, 175), calendar, env);
  assert.equal(ok.status, 0, ok.stderr);
  assert.doesNotMatch(ok.stderr, /usually runs|could not read|systemd-analyze is missing/);
  // A 3-hour step against a 30-minute interval would turn every step into missing data.
  for (const utcHost of [false, true]) {
    const stale = print(await userHome(10, 90, 30), calendar, await fakeSystemdAnalyze({ utcHost }));
    assert.equal(stale.status, 1, `utcHost=${utcHost}: ${stale.stderr}`);
    assert.match(stale.stderr, /usually runs every 180 min, more than 2\.5 × history\.sampleIntervalMinutes \(30 min\)/);
  }
  // Exactly three intervals is not enough: the random delay alone pushes about half the steps over the gap rule.
  assert.equal(print(await userHome(10, 90, 60), calendar, env).status, 1);
  assert.match(print(await userHome(10, 90, 1440), calendar, env).stderr, /far more often than history\.sampleIntervalMinutes/);
  const bogus = print(await userHome(10, 90, 175), ["--on-calendar", "bogus"], env);
  assert.equal(bogus.status, 1);
  assert.match(bogus.stderr, /systemd does not understand.*Failed to parse calendar specification/);
  const frequent = print(await userHome(10, 90, 10), ["--on-calendar", "*:0/10"], await fakeSystemdAnalyze({ hours: [...Array(24).keys()], minutes: [0, 10, 20, 30, 40, 50] }));
  assert.equal(frequent.status, 0, frequent.stderr);
  assert.match(frequent.stderr, /runs every 10 min and hits every source.*benzonavt/);
});

// A fake nvm: versions/<v>/bin holds node and an agent-browser installed with npm -g, and nvm.sh puts the default
// version on PATH the way the real one does.
async function fakeNvm({ defaultVersion } = {}) {
  const nvm = await mkdtemp(join(tmpdir(), "fuel-watch-nvm-"));
  const bin = join(nvm, "versions", "node", "v99.0.0", "bin");
  await mkdir(bin, { recursive: true });
  await symlink(process.execPath, join(bin, "node"));
  await writeFile(join(bin, "agent-browser"), "#!/bin/sh\necho 0.0.0\n", { mode: 0o755 });
  let defaultBin = bin;
  if (defaultVersion) {
    // An old default Node: what the timer would run, whatever `nvm use` the installing shell had.
    defaultBin = join(nvm, "versions", "node", defaultVersion, "bin");
    await mkdir(defaultBin, { recursive: true });
    await writeFile(join(defaultBin, "node"), `#!/bin/sh\nprintf ${defaultVersion}\n`, { mode: 0o755 });
  }
  await writeFile(join(nvm, "nvm.sh"), `export PATH="${defaultBin}:$PATH"\n`);
  return { nvm, bin };
}

test("a node from nvm is resolved through nvm's default alias on every run", async () => {
  const { nvm, bin } = await fakeNvm();
  const run = print(await userHome(10, 90, 175), [], { NVM_DIR: `${nvm}/`, PATH: `${bin}:/usr/bin:/bin` });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes(`\nExecStart=/bin/bash -c ". '${nvm}/nvm.sh' >/dev/null 2>&1; exec /bin/sh '${root}/deploy/linux/fuel-watch-collect.sh'"\n`), run.stdout);
  assert.doesNotMatch(run.stdout, /v99\.0\.0/, "no version-specific path, not even agent-browser's, may end up in the unit");
  assert.match(run.stderr, /resolves nvm's default alias/);
  const plain = print(await userHome(10, 90, 175), [], { NVM_DIR: join(nvm, "elsewhere"), PATH: `${bin}:/usr/bin:/bin` });
  assert.match(plain.stdout, /^ExecStart=\/bin\/sh "/m);
});

test("the installer checks the Node that nvm's default alias gives the timer, not the current shell's", async () => {
  const { nvm, bin } = await fakeNvm({ defaultVersion: "v20.0.0" });
  const home = await userHome(10, 90, 175);
  const env = { NVM_DIR: nvm, PATH: `${bin}:/usr/bin:/bin` };
  assert.match(print(home, [], env).stderr, /warning: nvm's default Node is not 22\+ \(found: v20\.0\.0\)/);
  const xdg = await mkdtemp(join(tmpdir(), "fuel-watch-xdg-"));
  const install = spawnSync("sh", [join(deploy, "install-systemd-user.sh")], { encoding: "utf8", env: { ...process.env, ...env, FUEL_WATCH_HOME: home, XDG_CONFIG_HOME: xdg, DISPLAY: ":0" } });
  assert.equal(install.status, 1);
  assert.match(install.stderr, /set it with: nvm alias default 22/);
  assert.equal(spawnSync("ls", ["-A", xdg], { encoding: "utf8" }).stdout, "", "nothing is installed");
});

test("a Node under some other nvm directory is reported instead of silently pinned", async () => {
  const { bin } = await fakeNvm();
  const run = print(await userHome(10, 90, 175), [], { NVM_DIR: join(tmpdir(), "no-such-nvm"), PATH: `${bin}:/usr/bin:/bin` });
  assert.match(run.stderr, /looks like nvm, but not under NVM_DIR/);
});
