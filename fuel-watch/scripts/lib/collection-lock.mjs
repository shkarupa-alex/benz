import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import properLockfile from "proper-lockfile";

export const COLLECTION_PAUSE_MS = 60000;
const DEFAULT_WAIT_MS = 10 * 60000;
const DEFAULT_POLL_MS = 5000;

// One collection at a time per Fuel Watch home: the background timer, one-off checks and an urgent monitoring tick
// must not open browsers against the same sources from one IP at once (benzonavt has banned the IP for less), and
// the later run must be the one that writes latest.json last. A run waits for the one in progress (a collection
// takes a few minutes) and then keeps at least COLLECTION_PAUSE_MS after it finished before touching the sources.
// The lock is coordination, not a guard of data: if it is lost to a stalled event loop the collection goes on.
export async function withCollectionLock(path, operation, { waitMs = DEFAULT_WAIT_MS, pollMs = DEFAULT_POLL_MS, pauseMs = COLLECTION_PAUSE_MS, lock = properLockfile.lock, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let release;
  try {
    release = await lock(path, { realpath: false, stale: 60000, update: 15000, retries: { retries: Math.ceil(waitMs / pollMs), factor: 1, minTimeout: pollMs, maxTimeout: pollMs, randomize: false }, onCompromised: () => {} });
  } catch (error) {
    if (error.code === "ELOCKED") throw Object.assign(new Error(`COLLECTION_BUSY: another Fuel Watch collection is still running after ${Math.round(waitMs / 60000)} min of waiting (${path}.lock)`), { code: "COLLECTION_BUSY", cause: error });
    throw error;
  }
  const finishedPath = `${path}.finished`;
  try {
    const finishedMs = Date.parse((await readFile(finishedPath, "utf8").catch(error => { if (error.code === "ENOENT") return ""; throw error; })).trim());
    const pause = Number.isFinite(finishedMs) ? finishedMs + pauseMs - now() : 0;
    if (pause > 0) await sleep(Math.min(pause, pauseMs));
    return await operation();
  } finally {
    try { await writeFile(finishedPath, `${new Date(now()).toISOString()}\n`, { mode: 0o600 }); }
    finally { await release().catch(() => {}); }
  }
}
