import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withCollectionLock } from "../../scripts/lib/collection-lock.mjs";

const lockPath = async () => join(await mkdtemp(join(tmpdir(), "fuel-collection-lock-")), "state", "collection");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test("collections never overlap and the next one keeps a pause after the previous finished", async () => {
  const path = await lockPath();
  const events = [];
  const run = name => withCollectionLock(path, async () => { events.push([name, "start", Date.now()]); await delay(150); events.push([name, "end", Date.now()]); return name; }, { pollMs: 20, pauseMs: 300 });
  assert.deepEqual(await Promise.all([run("timer"), run("tick")]), ["timer", "tick"]);
  const [first, second] = [events.filter(([, kind]) => kind === "end")[0], events.filter(([, kind]) => kind === "start")[1]];
  assert.deepEqual(events.map(([name, kind]) => `${name}:${kind}`).slice(1, 3), [`${first[0]}:end`, `${second[0]}:start`], "the second starts only after the first ended");
  assert.ok(second[2] - first[2] >= 280, `pause was ${second[2] - first[2]} ms`);
  assert.ok(Date.parse((await readFile(`${path}.finished`, "utf8")).trim()) >= events.at(-1)[2] - 5);
});

test("a run gives up with COLLECTION_BUSY instead of queueing forever, and a failed run still releases the lock", async () => {
  const path = await lockPath();
  let finish, held;
  const holding = new Promise(resolve => { held = resolve; });
  const holder = withCollectionLock(path, () => new Promise(resolve => { finish = resolve; held(); }), { pollMs: 20 });
  await holding;
  await assert.rejects(withCollectionLock(path, async () => "never", { waitMs: 100, pollMs: 20 }), { code: "COLLECTION_BUSY" });
  finish();
  await holder;
  await assert.rejects(withCollectionLock(path, async () => { throw new Error("collector failed"); }, { pollMs: 20, pauseMs: 0 }), /collector failed/);
  assert.equal(await withCollectionLock(path, async () => "next", { pollMs: 20, pauseMs: 0 }), "next");
});
