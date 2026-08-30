import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { buildForecast, recordHistory } from "../../scripts/lib/history.mjs";
import { writeJsonAtomic } from "../../scripts/lib/util.mjs";

const station = (stationKey, verdict, confidence = verdict === "AVAILABLE" ? "MEDIUM" : "NONE") => ({ stationKey, title: `АЗС ${stationKey}`, address: `Адрес ${stationKey}`, brand: "Лукойл", coordinate: [44.5,48.7], verdict, confidence, productAssessments: {} });
const tick = (fetchedAt, verdict) => ({ fetchedAt, areaHash:"area", queryHash:"query", stations:["s1","s2","s3"].map(key=>station(key,verdict)) });
const negativeTicks = (from, through) => { const out=[]; for(let at=new Date(from).getTime();at<=new Date(through).getTime();at+=15*60000) out.push(tick(new Date(at).toISOString(),"NOT_AVAILABLE")); return out; };

test("seven-day history is pruned and produces three station forecasts from completed outages", async () => {
  const config=await loadConfig();
  const dir=await mkdtemp(join(tmpdir(),"fuel-history-test-"));
  const path=join(dir,"history.json");
  await writeJsonAtomic(path,{schemaVersion:1,retentionDays:7,updatedAt:"2026-08-29T10:30:00Z",ticks:[
    tick("2026-08-20T08:00:00Z","NOT_AVAILABLE"),
    ...negativeTicks("2026-08-28T08:00:00Z","2026-08-28T09:45:00Z"),tick("2026-08-28T10:00:00Z","AVAILABLE"),
    ...negativeTicks("2026-08-29T08:00:00Z","2026-08-29T10:15:00Z"),tick("2026-08-29T10:30:00Z","AVAILABLE"),
    ...negativeTicks("2026-08-30T10:00:00Z","2026-08-30T11:45:00Z")
  ]});
  const snapshot={fetchedAt:"2026-08-30T12:00:00Z",areaHash:"area",queryHash:"query",assessments:["s1","s2","s3"].map(key=>station(key,"NOT_AVAILABLE"))};
  const result=await recordHistory(path,snapshot,config);
  assert.equal(result.history.ticks.some(value=>value.fetchedAt.startsWith("2026-08-20")),false);
  assert.equal(result.forecast.items.length,3);
  assert.ok(result.forecast.items.every(value=>value.basis==="STATION" && value.sampleSize===2));
  assert.equal(result.forecast.items[0].expectedAt,"2026-08-30T12:15:00.000Z");
  assert.equal(JSON.parse(await readFile(path,"utf8")).retentionDays,7);
});

test("low-confidence likely tick cannot become a completed delivery episode", async () => {
  const config=await loadConfig();
  const history={schemaVersion:1,ticks:[
    {fetchedAt:"2026-08-29T08:00:00Z",areaHash:"area",queryHash:"query",stations:[station("s","NOT_AVAILABLE")]},
    {fetchedAt:"2026-08-29T08:15:00Z",areaHash:"area",queryHash:"query",stations:[station("s","LIKELY_AVAILABLE","LOW")]},
    {fetchedAt:"2026-08-29T08:30:00Z",areaHash:"area",queryHash:"query",stations:[station("s","NOT_AVAILABLE")]},
    {fetchedAt:"2026-08-29T09:00:00Z",areaHash:"area",queryHash:"query",stations:[station("s","LIKELY_AVAILABLE","MEDIUM")]},
    {fetchedAt:"2026-08-30T08:00:00Z",areaHash:"area",queryHash:"query",stations:[station("s","NOT_AVAILABLE")]},
    {fetchedAt:"2026-08-30T08:30:00Z",areaHash:"area",queryHash:"query",stations:[station("s","NOT_AVAILABLE")]}
  ]};
  const snapshot={fetchedAt:"2026-08-30T08:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.completedEpisodeCount,1);
  assert.equal(forecast.items.length,0);
});

test("per-grade gasoline rolling activity predicts the station's typical tanker time", async () => {
  const config=await loadConfig();
  const rolling=(count,latestEventAt)=>({source:"yandex",gradeLabel:"АИ-92",observedAt:latestEventAt,latestEventAt,windowMinutes:60,count,gradeSpecific:true,sourceTerminology:"SIGNAL"});
  const activityTick=(fetchedAt,count,latestEventAt)=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling(count,latestEventAt)]}]});
  const history={schemaVersion:1,ticks:[
    activityTick("2026-08-28T06:45:00Z",0,"2026-08-28T05:30:00Z"),
    activityTick("2026-08-28T07:00:00Z",3,"2026-08-28T06:58:00Z"),
    activityTick("2026-08-29T06:45:00Z",0,"2026-08-29T05:30:00Z"),
    activityTick("2026-08-29T07:00:00Z",4,"2026-08-29T06:58:00Z"),
    activityTick("2026-08-30T06:30:00Z",0,"2026-08-30T05:00:00Z")
  ]};
  const snapshot={fetchedAt:"2026-08-30T06:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.activityEventCount,2);
  assert.equal(forecast.items[0].signalBasis,"ROLLING_ACTIVITY");
  assert.equal(forecast.items[0].basis,"STATION");
  assert.equal(forecast.items[0].expectedAt,"2026-08-30T06:58:00.000Z");
});

test("synchronized petrol status transitions predict delivery while diesel is absent", async () => {
  const config=await loadConfig();
  const status=(gradeLabel,value)=>({source:"yandex",gradeLabel,kind:"PETROL_STATUS_SNAPSHOT",status:value,gradeSpecific:true,sourceTerminology:"STATUS"});
  const statusTick=(fetchedAt,value)=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("92",value),status("95",value)]}]});
  const history={schemaVersion:1,ticks:[
    statusTick("2026-08-28T05:45:00Z","OUT_OF_STOCK"),statusTick("2026-08-28T06:00:00Z","IN_STOCK"),
    statusTick("2026-08-29T05:45:00Z","OUT_OF_STOCK"),statusTick("2026-08-29T06:00:00Z","IN_STOCK"),
    statusTick("2026-08-30T05:30:00Z","OUT_OF_STOCK")
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.petrolStatusEventCount,2);
  assert.equal(forecast.items[0].signalBasis,"PETROL_STATUS_PATTERN");
  assert.equal(forecast.items[0].expectedAt,"2026-08-30T06:00:00.000Z");
});
