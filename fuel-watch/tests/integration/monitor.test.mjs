import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { monitorCommand } from "../../scripts/monitor.mjs";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { prepareMonitoringSnapshot } from "../../scripts/lib/prepare.mjs";
import { renderReport } from "../../scripts/report.mjs";

test("monitor prepare and commit are transactional and cleanup deletes state", async () => {
  const init=await monitorCommand("init",{});
  const stateDir=init.stateDir;
  const snapshotPath=join(stateDir,"snapshot.json");
  const input={schemaVersion:1,fetchedAt:"2026-08-30T10:00:00Z",areaHash:"a",queryHash:"q",assessments:[],rankedStationKeys:[],sourceHealth:[]};
  await writeFile(snapshotPath,JSON.stringify(input));
  const initialState=JSON.parse(await readFile(join(stateDir,"state.json"),"utf8"));
  const config=await loadConfig();
  const prepared=prepareMonitoringSnapshot(initialState,input,config).snapshot;
  const reportId=renderReport(prepared,{monitorId:init.monitorId,generation:0}).reportId;
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
  const {stateDir}=await monitorCommand("init",{});
  await monitorCommand("stop",{"state-dir":stateDir});
  const due=await monitorCommand("due",{"state-dir":stateDir});
  assert.equal(due.stopped,true);
  await monitorCommand("cleanup",{"state-dir":stateDir});
  await assert.rejects(readFile(join(stateDir,"state.json")));
});

test("cleanup refuses arbitrary and unowned directories", async () => {
  const arbitrary=await mkdtemp(join(tmpdir(),"not-fuel-watch-"));
  const bait=join(arbitrary,"keep.txt");
  await writeFile(bait,"keep");
  await assert.rejects(monitorCommand("cleanup",{"state-dir":arbitrary}),/must be a child/);
  assert.equal(await readFile(bait,"utf8"),"keep");
  const root=join(tmpdir(),"fuel-watch");
  await mkdir(root,{recursive:true});
  const unowned=await mkdtemp(join(root,"unowned-"));
  await writeFile(join(unowned,"keep.txt"),"keep");
  await assert.rejects(monitorCommand("cleanup",{"state-dir":unowned}));
  assert.equal(await readFile(join(unowned,"keep.txt"),"utf8"),"keep");
});
