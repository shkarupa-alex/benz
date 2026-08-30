import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { monitorCommand } from "../../scripts/monitor.mjs";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { prepareMonitoringSnapshot } from "../../scripts/lib/prepare.mjs";
import { renderReport } from "../../scripts/report.mjs";

test("monitor prepare and commit are transactional and cleanup deletes state", async () => {
  const stateDir=await mkdtemp(join(tmpdir(),"fuel-watch-test-"));
  await rm(stateDir,{recursive:true,force:true});
  const init=await monitorCommand("init",{"state-dir":stateDir,"monitor-id":"m-test"});
  const snapshotPath=join(stateDir,"snapshot.json");
  const input={schemaVersion:1,fetchedAt:"2026-08-30T10:00:00Z",areaHash:"a",queryHash:"q",assessments:[],rankedStationKeys:[],sourceHealth:[]};
  await writeFile(snapshotPath,JSON.stringify(input));
  const initialState=JSON.parse(await readFile(join(stateDir,"state.json"),"utf8"));
  const config=await loadConfig();
  const prepared=prepareMonitoringSnapshot(initialState,input,config).snapshot;
  const reportId=renderReport(prepared,{monitorId:"m-test",generation:0}).reportId;
  await monitorCommand("prepare",{"state-dir":stateDir,"report-id":reportId,snapshot:snapshotPath});
  let state=JSON.parse(await readFile(join(stateDir,"state.json"),"utf8"));
  assert.equal(state.generation,0);
  assert.equal(state.pending.reportId,reportId);
  assert.deepEqual(JSON.parse(await readFile(snapshotPath,"utf8")),input);
  await monitorCommand("commit",{"state-dir":stateDir,"report-id":reportId});
  state=JSON.parse(await readFile(join(stateDir,"state.json"),"utf8"));
  assert.equal(state.generation,1);
  await monitorCommand("cleanup",{"state-dir":stateDir});
  await assert.rejects(readFile(join(stateDir,"state.json")));
});

test("stop is observed by due and cleanup removes temporary state", async () => {
  const stateDir=await mkdtemp(join(tmpdir(),"fuel-watch-stop-"));
  await rm(stateDir,{recursive:true,force:true});
  await monitorCommand("init",{"state-dir":stateDir,"monitor-id":"m-stop"});
  await monitorCommand("stop",{"state-dir":stateDir});
  const due=await monitorCommand("due",{"state-dir":stateDir});
  assert.equal(due.stopped,true);
  await monitorCommand("cleanup",{"state-dir":stateDir});
  await assert.rejects(readFile(join(stateDir,"state.json")));
});
