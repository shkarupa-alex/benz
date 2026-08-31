import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

test("source-provided petrol transition history can train an on-demand forecast", async () => {
  const config=await loadConfig();
  const sourceTick=(fetchedAt,observedAt)=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","AVAILABLE"),activity:[
    {source:"gdebenz",gradeLabel:"92",kind:"SOURCE_REPORTED_TRANSITION",observedAt,gradeSpecific:true,sourceTerminology:"USER_REPORT"},
    {source:"gdebenz",gradeLabel:"95",kind:"SOURCE_REPORTED_TRANSITION",observedAt,gradeSpecific:true,sourceTerminology:"USER_REPORT"}
  ]}]});
  const history={schemaVersion:1,ticks:[
    sourceTick("2026-08-28T06:15:00Z","2026-08-28T06:00:00Z"),
    sourceTick("2026-08-29T06:15:00Z","2026-08-29T06:05:00Z"),
    {fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",stations:[station("s","NOT_AVAILABLE")]}
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.sourceTimelineEventCount,2);
  assert.equal(forecast.items[0].signalBasis,"SOURCE_REPORTED_STATUS");
  assert.equal(forecast.items[0].basis,"STATION");
});

test("several sources observing one delivery window count as one episode", async () => {
  const config=await loadConfig();
  const activity=[
    {source:"gdebenz",gradeLabel:"95",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-30T09:40:00Z",gradeSpecific:true},
    {source:"benzonavt",gradeLabel:"95",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-30T10:01:00Z",gradeSpecific:true},
    {source:"2gis",gradeLabel:"95",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-30T10:36:00Z",gradeSpecific:true}
  ];
  const history={schemaVersion:1,ticks:[{fetchedAt:"2026-08-30T11:00:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","AVAILABLE"),activity}]},{fetchedAt:"2026-08-31T08:00:00Z",areaHash:"area",queryHash:"query",stations:[station("s","NOT_AVAILABLE")]}]};
  const snapshot={fetchedAt:"2026-08-31T08:00:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.sourceTimelineEventCount,1);
  assert.equal(forecast.items.length,0);
});

test("two source transitions on one day are not a typical-time pattern", async () => {
  const config=await loadConfig();
  const activity=[
    {source:"gdebenz",gradeLabel:"95",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-30T06:00:00Z",gradeSpecific:true},
    {source:"gdebenz",gradeLabel:"95",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-30T10:00:00Z",gradeSpecific:true}
  ];
  const history={schemaVersion:1,ticks:[{fetchedAt:"2026-08-30T11:00:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","AVAILABLE"),activity}]},{fetchedAt:"2026-08-31T08:00:00Z",areaHash:"area",queryHash:"query",stations:[station("s","NOT_AVAILABLE")]}]};
  const snapshot={fetchedAt:"2026-08-31T08:00:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  assert.equal(buildForecast(history,snapshot,config).items.length,0);
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

test("branded variants of one octane produce one aggregate transition per tick", async () => {
  const config=await loadConfig();
  const status=(productKey,value)=>({source:"source",productKey,kind:"PETROL_STATUS_SNAPSHOT",status:value,gradeSpecific:true,sourceTerminology:"STATUS"});
  const statusTick=(fetchedAt,value)=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE",value),status("AI95_GDRIVE",value)]}]});
  const history={schemaVersion:1,ticks:[
    statusTick("2026-08-27T05:45:00Z","OUT_OF_STOCK"),statusTick("2026-08-27T06:00:00Z","IN_STOCK"),
    statusTick("2026-08-28T05:45:00Z","OUT_OF_STOCK"),statusTick("2026-08-28T06:00:00Z","IN_STOCK"),
    statusTick("2026-08-29T05:45:00Z","OUT_OF_STOCK"),statusTick("2026-08-29T06:00:00Z","IN_STOCK"),
    statusTick("2026-08-30T05:30:00Z","OUT_OF_STOCK")
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.petrolStatusEventCount,3);
  assert.equal(forecast.items[0].confidence,"LOW");
});

test("mixed variant statuses that never change do not create octane transitions", async () => {
  const config=await loadConfig();
  const status=(productKey,value)=>({source:"source",productKey,kind:"PETROL_STATUS_SNAPSHOT",status:value,gradeSpecific:true,sourceTerminology:"STATUS"});
  const mixedTick=(fetchedAt,reverse=false)=>{
    const activity=[status("AI95_BASE","OUT_OF_STOCK"),status("AI95_GDRIVE","IN_STOCK")];
    if (reverse) activity.reverse();
    return {fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity}]};
  };
  const history={schemaVersion:1,ticks:[
    mixedTick("2026-08-28T05:45:00Z"),mixedTick("2026-08-28T06:00:00Z",true),
    mixedTick("2026-08-29T05:45:00Z",true),mixedTick("2026-08-29T06:00:00Z"),
    mixedTick("2026-08-30T05:30:00Z")
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.petrolStatusEventCount,0);
  assert.equal(forecast.items.length,0);
});

test("rolling counts aggregate variants before detecting a quiet-to-active transition", async () => {
  const config=await loadConfig();
  const rolling=(productKey,count,latestEventAt)=>({source:"source",productKey,kind:"ROLLING_SIGNAL_COUNT",count,windowMinutes:60,latestEventAt,gradeSpecific:true,sourceTerminology:"SIGNAL"});
  const rollingTick=(fetchedAt,base,gdrive,reverse=false)=>{
    const activity=[rolling("AI95_BASE",base,fetchedAt),rolling("AI95_GDRIVE",gdrive,fetchedAt)];
    if (reverse) activity.reverse();
    return {fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity}]};
  };
  const history={schemaVersion:1,ticks:[
    rollingTick("2026-08-28T05:45:00Z",5,0),rollingTick("2026-08-28T06:00:00Z",5,2,true),
    rollingTick("2026-08-29T05:45:00Z",5,0,true),rollingTick("2026-08-29T06:00:00Z",5,2),
    rollingTick("2026-08-30T05:30:00Z",5,0)
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.activityEventCount,0);
  assert.equal(forecast.items.length,0);
});

test("rolling variant counts are summed into one real octane transition", async () => {
  const config=await loadConfig();
  const rolling=(productKey,count,latestEventAt)=>({source:"source",productKey,kind:"ROLLING_SIGNAL_COUNT",count,windowMinutes:60,latestEventAt,gradeSpecific:true,sourceTerminology:"SIGNAL"});
  const rollingTick=(fetchedAt,base,gdrive)=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling("AI95_BASE",base,fetchedAt),rolling("AI95_GDRIVE",gdrive,fetchedAt)]}]});
  const history={schemaVersion:1,ticks:[
    rollingTick("2026-08-28T05:45:00Z",0,0),rollingTick("2026-08-28T06:00:00Z",1,1),
    rollingTick("2026-08-29T05:45:00Z",0,0),rollingTick("2026-08-29T06:00:00Z",1,1),
    rollingTick("2026-08-30T05:30:00Z",0,0)
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.activityEventCount,2);
  assert.equal(forecast.items[0].signalBasis,"ROLLING_ACTIVITY");
});

test("shortest variant window conservatively controls rolling quiet-gap eligibility", async () => {
  const config=await loadConfig();
  const rolling=(productKey,count,windowMinutes,latestEventAt)=>({source:"source",productKey,kind:"ROLLING_SIGNAL_COUNT",count,windowMinutes,latestEventAt,gradeSpecific:true,sourceTerminology:"SIGNAL"});
  const history={schemaVersion:1,ticks:[
    {fetchedAt:"2026-08-28T05:45:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling("AI95_BASE",0,60,"2026-08-28T05:00:00Z"),rolling("AI95_GDRIVE",0,30,"2026-08-28T05:00:00Z")]}]},
    {fetchedAt:"2026-08-28T06:00:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling("AI95_BASE",1,60,"2026-08-28T05:58:00Z"),rolling("AI95_GDRIVE",1,60,"2026-08-28T05:58:00Z")]}]}
  ]};
  const snapshot={fetchedAt:"2026-08-28T06:00:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  assert.equal(buildForecast(history,snapshot,config).activityEventCount,0);
});

test("unreadable variant does not suppress readable octane transitions", async () => {
  const config=await loadConfig();
  const status=(productKey,value)=>({source:"source",productKey,kind:"PETROL_STATUS_SNAPSHOT",status:value,gradeSpecific:true,sourceTerminology:"STATUS"});
  const history={schemaVersion:1,ticks:[
    {fetchedAt:"2026-08-28T05:45:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE","OUT_OF_STOCK"),status("AI95_GDRIVE","UNKNOWN")]}]},
    {fetchedAt:"2026-08-28T06:00:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE","IN_STOCK"),status("AI95_GDRIVE","UNKNOWN")]}]},
    {fetchedAt:"2026-08-29T05:45:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE","OUT_OF_STOCK"),status("AI95_GDRIVE","UNKNOWN")]}]},
    {fetchedAt:"2026-08-29T06:00:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE","LIMITED"),status("AI95_GDRIVE","UNKNOWN")]}]},
    {fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE","OUT_OF_STOCK"),status("AI95_GDRIVE","UNKNOWN")]}]}
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.petrolStatusEventCount,2);
  assert.equal(forecast.items.length,1);
});

test("variant becoming readable cannot fabricate status transitions", async () => {
  const config=await loadConfig();
  const status=(productKey,value)=>({source:"source",productKey,kind:"PETROL_STATUS_SNAPSHOT",status:value,gradeSpecific:true,sourceTerminology:"STATUS"});
  const hiddenTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE","OUT_OF_STOCK"),status("AI95_GDRIVE",undefined)]}]});
  const visibleTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("AI95_BASE","OUT_OF_STOCK"),status("AI95_GDRIVE","IN_STOCK")]}]});
  const history={schemaVersion:1,ticks:[
    hiddenTick("2026-08-28T05:45:00Z"),visibleTick("2026-08-28T06:00:00Z"),
    hiddenTick("2026-08-29T05:45:00Z"),visibleTick("2026-08-29T06:00:00Z"),
    hiddenTick("2026-08-30T05:30:00Z")
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.petrolStatusEventCount,0);
  assert.equal(forecast.items.length,0);
});

test("rolling variant appearing cannot fabricate activity resumption", async () => {
  const config=await loadConfig();
  const rolling=(productKey,count,latestEventAt)=>({source:"source",productKey,kind:"ROLLING_SIGNAL_COUNT",count,windowMinutes:60,latestEventAt,gradeSpecific:true,sourceTerminology:"SIGNAL"});
  const hiddenTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling("AI95_BASE",0,fetchedAt)]}]});
  const visibleTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling("AI95_BASE",0,fetchedAt),rolling("AI95_GDRIVE",3,fetchedAt)]}]});
  const history={schemaVersion:1,ticks:[
    hiddenTick("2026-08-28T05:45:00Z"),visibleTick("2026-08-28T06:00:00Z"),
    hiddenTick("2026-08-29T05:45:00Z"),visibleTick("2026-08-29T06:00:00Z"),
    hiddenTick("2026-08-30T05:30:00Z")
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.activityEventCount,0);
  assert.equal(forecast.items.length,0);
});

test("different AI95_UNKNOWN labels cannot fabricate status witnesses", async () => {
  const config=await loadConfig();
  const status=(gradeLabel,value)=>({source:"source",productKey:"AI95_UNKNOWN",gradeLabel,kind:"PETROL_STATUS_SNAPSHOT",status:value,gradeSpecific:true,sourceTerminology:"STATUS"});
  const hiddenTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("АИ-95 Фора","OUT_OF_STOCK"),status("АИ-95 Ультра",undefined)]}]});
  const visibleTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[status("АИ-95 Фора","OUT_OF_STOCK"),status("АИ-95 Ультра","IN_STOCK")]}]});
  const history={schemaVersion:1,ticks:[
    hiddenTick("2026-08-28T05:45:00Z"),visibleTick("2026-08-28T06:00:00Z"),
    hiddenTick("2026-08-29T05:45:00Z"),visibleTick("2026-08-29T06:00:00Z"),
    hiddenTick("2026-08-30T05:30:00Z")
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.petrolStatusEventCount,0);
  assert.equal(forecast.items.length,0);
});

test("different AI95_UNKNOWN labels cannot fabricate rolling witnesses", async () => {
  const config=await loadConfig();
  const rolling=(gradeLabel,count,latestEventAt)=>({source:"source",productKey:"AI95_UNKNOWN",gradeLabel,kind:"ROLLING_SIGNAL_COUNT",count,windowMinutes:60,latestEventAt,gradeSpecific:true,sourceTerminology:"SIGNAL"});
  const hiddenTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling("АИ-95 Фора",0,fetchedAt)]}]});
  const visibleTick=fetchedAt=>({fetchedAt,areaHash:"area",queryHash:"query",stations:[{...station("s","NOT_AVAILABLE"),activity:[rolling("АИ-95 Фора",0,fetchedAt),rolling("АИ-95 Ультра",3,fetchedAt)]}]});
  const history={schemaVersion:1,ticks:[
    hiddenTick("2026-08-28T05:45:00Z"),visibleTick("2026-08-28T06:00:00Z"),
    hiddenTick("2026-08-29T05:45:00Z"),visibleTick("2026-08-29T06:00:00Z"),
    hiddenTick("2026-08-30T05:30:00Z")
  ]};
  const snapshot={fetchedAt:"2026-08-30T05:30:00Z",areaHash:"area",queryHash:"query",assessments:[station("s","NOT_AVAILABLE")]};
  const forecast=buildForecast(history,snapshot,config);
  assert.equal(forecast.activityEventCount,0);
  assert.equal(forecast.items.length,0);
});

test("history keeps station continuity when a merged member source disappears", async () => {
  const config=await loadConfig();
  const physical=(stationKey,verdict,memberKeys)=>({...station(stationKey,verdict),memberKeys});
  const history={schemaVersion:1,ticks:[
    {fetchedAt:"2026-08-28T08:00:00Z",areaHash:"area",queryHash:"query",stations:[physical("merged:old","NOT_AVAILABLE",["gdebenz:a","benzonavt:b"])]},
    {fetchedAt:"2026-08-28T08:30:00Z",areaHash:"area",queryHash:"query",stations:[physical("source:benzonavt:b","AVAILABLE",["benzonavt:b"])]},
    {fetchedAt:"2026-08-29T08:00:00Z",areaHash:"area",queryHash:"query",stations:[physical("source:gdebenz:a","NOT_AVAILABLE",["gdebenz:a"])]},
    {fetchedAt:"2026-08-29T08:30:00Z",areaHash:"area",queryHash:"query",stations:[physical("merged:new","AVAILABLE",["gdebenz:a","benzonavt:b"])]},
    {fetchedAt:"2026-08-30T08:00:00Z",areaHash:"area",queryHash:"query",stations:[physical("source:benzonavt:b","NOT_AVAILABLE",["benzonavt:b"])]},
    {fetchedAt:"2026-08-30T08:15:00Z",areaHash:"area",queryHash:"query",stations:[physical("source:benzonavt:b","NOT_AVAILABLE",["benzonavt:b"])]}
  ]};
  const current={...station("source:benzonavt:b","NOT_AVAILABLE"),members:[{source:"benzonavt",sourceStationId:"b"}]};
  const forecast=buildForecast(history,{fetchedAt:"2026-08-30T08:15:00Z",areaHash:"area",queryHash:"query",assessments:[current]},config);
  assert.equal(forecast.completedEpisodeCount,2);
  assert.equal(forecast.items[0].basis,"STATION");
  assert.equal(forecast.items[0].sampleSize,2);
});

test("same physical station is conservatively collapsed once per historical tick", async () => {
  const config=await loadConfig();
  const physical=(stationKey,verdict,memberKeys,confidence)=>({...station(stationKey,verdict,confidence),memberKeys});
  const history={schemaVersion:1,ticks:[
    {fetchedAt:"2026-08-28T08:00:00Z",areaHash:"area",queryHash:"query",stations:[physical("source:gdebenz:a","NOT_AVAILABLE",["gdebenz:a"]),physical("source:benzonavt:b","AVAILABLE",["benzonavt:b"],"HIGH")]},
    {fetchedAt:"2026-08-28T08:15:00Z",areaHash:"area",queryHash:"query",stations:[physical("merged:ab","NOT_AVAILABLE",["gdebenz:a","benzonavt:b"])]},
    {fetchedAt:"2026-08-28T08:30:00Z",areaHash:"area",queryHash:"query",stations:[physical("merged:ab","AVAILABLE",["gdebenz:a","benzonavt:b"],"HIGH")]},
    {fetchedAt:"2026-08-30T08:00:00Z",areaHash:"area",queryHash:"query",stations:[physical("merged:ab","NOT_AVAILABLE",["gdebenz:a","benzonavt:b"])]},
    {fetchedAt:"2026-08-30T08:15:00Z",areaHash:"area",queryHash:"query",stations:[physical("merged:ab","NOT_AVAILABLE",["gdebenz:a","benzonavt:b"])]}
  ]};
  const current={...station("merged:ab","NOT_AVAILABLE"),members:[{source:"gdebenz",sourceStationId:"a"},{source:"benzonavt",sourceStationId:"b"}]};
  const forecast=buildForecast(history,{fetchedAt:"2026-08-30T08:15:00Z",areaHash:"area",queryHash:"query",assessments:[current]},config);
  assert.equal(forecast.completedEpisodeCount,1);
  assert.equal(forecast.items.length,0);
});

test("parallel history updates retain every tick", async () => {
  const config=await loadConfig();
  const dir=await mkdtemp(join(tmpdir(),"fuel-history-lock-test-"));
  const path=join(dir,"history.json");
  const snapshots=Array.from({length:8},(_,index)=>({fetchedAt:new Date(Date.parse("2026-08-30T10:00:00Z")+index*60000).toISOString(),areaHash:"area",queryHash:"query",assessments:[]}));
  await Promise.all(snapshots.map(snapshot=>recordHistory(path,snapshot,config)));
  const saved=JSON.parse(await readFile(path,"utf8"));
  assert.equal(saved.ticks.length,8);
  assert.deepEqual(saved.ticks.map(value=>value.fetchedAt).sort(),snapshots.map(value=>value.fetchedAt).sort());
  await assert.rejects(readFile(`${path}.lock`,"utf8"),error=>error.code==="ENOENT");
});

test("history recovers legacy locks left by a crashed reclaimer process", async () => {
  const config=await loadConfig();
  const dir=await mkdtemp(join(tmpdir(),"fuel-history-reclaimer-crash-test-"));
  const path=join(dir,"history.json");
  const child=spawnSync(process.execPath,["-e",`const fs=require('node:fs');const path=process.argv[1];const owner=JSON.stringify({pid:process.pid,nonce:'crashed',acquiredAt:new Date().toISOString()});fs.writeFileSync(path+'.lock',owner);fs.writeFileSync(path+'.lock.reclaim',owner);process.exit(99)`,path],{encoding:"utf8"});
  assert.equal(child.status,99);
  const snapshot={fetchedAt:"2026-08-31T00:00:00Z",areaHash:"area",queryHash:"query",assessments:[]};
  const result=await recordHistory(path,snapshot,config);
  assert.equal(result.history.ticks.length,1);
  await assert.rejects(readFile(`${path}.lock`,"utf8"),error=>error.code==="ENOENT");
  await assert.rejects(readFile(`${path}.lock.reclaim`,"utf8"),error=>error.code==="ENOENT");
});

test("compromised history lock fails closed without throwing from the heartbeat callback", async () => {
  const config=await loadConfig();
  const dir=await mkdtemp(join(tmpdir(),"fuel-history-compromised-test-"));
  const path=join(dir,"history.json");
  const lock=async (_path,options)=>{ options.onCompromised(Object.assign(new Error("heartbeat lost ownership"),{code:"ECOMPROMISED"})); return async()=>{ throw Object.assign(new Error("already released"),{code:"ERELEASED"}); }; };
  const snapshot={fetchedAt:"2026-08-31T00:00:00Z",areaHash:"area",queryHash:"query",assessments:[]};
  await assert.rejects(recordHistory(path,snapshot,config,{lock}),error=>error.code==="HISTORY_LOCK_COMPROMISED");
  await assert.rejects(readFile(path,"utf8"),error=>error.code==="ENOENT");
});
