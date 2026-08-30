import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { monitorCommand } from "../../scripts/monitor.mjs";

test("monitor prepare and commit are transactional and cleanup deletes state", async () => {
  const stateDir=await mkdtemp(join(tmpdir(),"fuel-watch-test-"));
  await rm(stateDir,{recursive:true,force:true});
  const init=await monitorCommand("init",{"state-dir":stateDir,"monitor-id":"m-test"});
  const snapshotPath=join(stateDir,"snapshot.json");
  await writeFile(snapshotPath,JSON.stringify({schemaVersion:1,fetchedAt:"2026-08-30T10:00:00Z",areaHash:"a",queryHash:"q",assessments:[],sourceHealth:[]}));
  await monitorCommand("prepare",{"state-dir":stateDir,"report-id":"r1",snapshot:snapshotPath});
  let state=JSON.parse(await readFile(join(stateDir,"state.json"),"utf8"));
  assert.equal(state.generation,0);
  assert.equal(state.pending.reportId,"r1");
  await monitorCommand("commit",{"state-dir":stateDir,"report-id":"r1"});
  state=JSON.parse(await readFile(join(stateDir,"state.json"),"utf8"));
  assert.equal(state.generation,1);
  await monitorCommand("cleanup",{"state-dir":stateDir});
  await assert.rejects(readFile(join(stateDir,"state.json")));
});
