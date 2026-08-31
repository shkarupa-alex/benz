import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import * as yandex from "../../scripts/lib/sources/yandex.mjs";
import * as twogis from "../../scripts/lib/sources/twogis.mjs";
import * as gdebenz from "../../scripts/lib/sources/gdebenz.mjs";
import * as benzonavt from "../../scripts/lib/sources/benzonavt.mjs";
import { readJson } from "../../scripts/lib/util.mjs";

const request = config => ({ area: { polygon: [[44,48],[45,48],[45,49],[44,48]] }, requestedProducts: config.requestedProducts, fetchedAt: new Date().toISOString() });

test("Yandex adapter normalizes fake BrowserRunner output", async () => {
  const config = await loadConfig();
  const raw=await readJson(new URL("../fixtures/yandex-current.json",import.meta.url));
  const browser = { open: async()=>({finalUrl:"https://yandex.ru/maps",pageTextPrefix:"АЗС"}), waitReady:async()=>{}, evalJson:async expression=>expression.includes("window.scrollBy") ? true : raw };
  const result = await yandex.collect(request(config),{browser,config});
  assert.equal(result.health.status,"OK");
  assert.equal(result.observations[0].status,"IN_STOCK");
  assert.equal(result.activity[0].gradeLabel,"АИ-92");
  assert.equal(result.activity[0].product,undefined);
  assert.equal(result.activity[0].count,5);
});

test("2GIS challenge is explicit and never evaluated", async () => {
  const config = await loadConfig(); let evaluated=false;
  const fixture=await readJson(new URL("../fixtures/2gis-challenge.json",import.meta.url));
  const browser={open:async()=>({finalUrl:fixture.url,pageTextPrefix:fixture.textPrefix}),waitReady:async()=>{},evalJson:async()=>{evaluated=true;}};
  const result=await twogis.collect(request(config),{browser,config});
  assert.equal(result.health.status,"CHALLENGE");
  assert.equal(evaluated,false);
});

test("gdebenz does not confuse a standalone 502 in normal content with Bad Gateway", async () => {
  const config=await loadConfig(); let opens=0;
  const browser={open:async()=>{opens++;return{finalUrl:"https://gdebenz.ru/",pageTitle:"Где бензин",pageTextPrefix:"На карте 502 АЗС"};},waitReady:async()=>{},evalJson:async()=>({stations:[{id:"1",coordinate:[44.5,48.7]}],observations:[{stationId:"1",fuel:"АИ-95",status:"есть",observedAt:new Date().toISOString()}]})};
  const result=await gdebenz.collect(request(config),{browser,config});
  assert.equal(opens,1);
  assert.notEqual(result.health.code,"HTTP_ERROR_PAGE");
});

test("gdebenz retries and reports the actual 502 Bad Gateway signature", async () => {
  const config=await loadConfig(); const fixture=await readJson(new URL("../fixtures/gdebenz-502.json",import.meta.url)); let opens=0, evaluated=false;
  const browser={open:async()=>{opens++;return{finalUrl:"https://gdebenz.ru/",pageTitle:fixture.title,pageTextPrefix:fixture.textPrefix};},waitReady:async()=>{},evalJson:async()=>{evaluated=true;}};
  const result=await gdebenz.collect(request(config),{browser,config});
  assert.equal(opens,2);
  assert.equal(result.health.status,"HTTP_ERROR");
  assert.equal(result.health.code,"HTTP_ERROR_PAGE");
  assert.equal(evaluated,false);
});

test("gdebenz recognizes the observed Error 502 headed-vs-headless response", async () => {
  const config=await loadConfig(); let opens=0;
  const browser={open:async()=>{opens++;return{finalUrl:"https://gdebenz.ru/",pageTitle:"Error 502",pageTextPrefix:"502 - Bad Gateway . That's an error."};},waitReady:async()=>{},evalJson:async()=>{throw new Error("must not evaluate an error page");}};
  const result=await gdebenz.collect(request(config),{browser,config});
  assert.equal(opens,2);
  assert.equal(result.health.code,"HTTP_ERROR_PAGE");
});

test("gdebenz falls back to DOM when a nonempty API payload has no compatible stations", async () => {
  const config=await loadConfig(); let evaluations=0;
  const browser={
    open:async()=>({finalUrl:"https://gdebenz.ru/",pageTitle:"Где бензин",pageTextPrefix:"Карта"}),waitReady:async()=>{},
    evalJson:async()=>++evaluations===1
      ? {stations:[],observations:[],schemaChanged:true,message:"API shape changed"}
      : {stations:[{id:"dom-1",coordinate:[44.5,48.7]}],observations:[{stationId:"dom-1",fuel:"АИ-95",status:"нет данных о топливе"}],partial:true,code:"NO_FRESHNESS_METADATA",freshnessExpected:false}
  };
  const result=await gdebenz.collect(request(config),{browser,config});
  assert.equal(evaluations,2);
  assert.equal(result.health.code,"NO_FRESHNESS_METADATA");
  assert.equal(result.stations.length,1);
});

test("Yandex extractor keeps aggregate counts out of grade confidence and declares missing grade freshness", async () => {
  const payload={stack:[{results:{items:[{id:"1089357396",coordinates:[44.502992,48.723609],title:"АЗС",fuelAvailability:{fuel:[{fuelType:"AI92",localizedName:"92",status:"IN_STOCK"},{fuelType:"AI95",localizedName:"95",status:"IN_STOCK"},{fuelType:"DIESEL",localizedName:"ДТ",status:"IN_STOCK"}],signalsCountPerHour:3,lastSignalTimestamp:1788076800,queueStatus:"MEDIUM",localizedQueueSize:"Средняя"}}]}}]};
  const document={scripts:[{textContent:JSON.stringify(payload)}],querySelectorAll:()=>[]};
  const raw=Function("window","document","location",`return ${yandex.YANDEX_EXTRACTOR}`)({},document,{href:"https://yandex.ru/maps"});
  assert.equal(raw.stations[0].id,"1089357396");
  assert.equal(raw.observations[0].status,"IN_STOCK");
  assert.equal(raw.observations[0].signalsPerHour,undefined);
  assert.equal(raw.observations[0].observedAt,undefined);
  assert.equal(raw.observations.some(value=>value.observedAt),false);
  assert.equal(raw.activity.length,2);
  assert.equal(raw.activity.some(value=>value.gradeLabel==="ДТ"),false);
  assert.equal(raw.activity[0].kind,"PETROL_STATUS_SNAPSHOT");
  assert.equal(raw.activity[0].gradeLabel,"92");
  assert.equal(raw.queues[0].ordinal,"MEDIUM");
  assert.match(raw.queues[0].observedAt,/^2026-/);
  const config=await loadConfig();
  const browser={open:async()=>({finalUrl:"https://yandex.ru/maps",pageTextPrefix:"АЗС"}),waitReady:async()=>{},evalJson:async expression=>expression.includes("window.scrollBy")?true:raw};
  const result=await yandex.collect(request(config),{browser,config});
  assert.equal(result.health.status,"PARTIAL");
  assert.equal(result.health.code,"NO_GRADE_FRESHNESS_METADATA");
  assert.equal(result.coverage.freshnessExpected,false);
});

test("gdebenz page extractor uses stable data-osm cards", () => {
  const card={dataset:{osm:"1377306600"},innerText:"Teboil Есть топливо 95 Очередь до 5 ул. Рокоссовского, 4б",textContent:"",querySelector:()=>({textContent:"Teboil"})};
  const document={scripts:[],querySelectorAll:selector=>selector===".stn[data-osm]"?[card]:[]};
  const raw=Function("window","document","location",`return ${gdebenz.GDEBENZ_EXTRACTOR}`)({},document,{href:"https://gdebenz.ru/"});
  assert.equal(raw.stations[0].id,"1377306600");
  assert.equal(raw.observations[0].status,"есть топливо");
  assert.equal(raw.queues[0].present,true);
  assert.equal(raw.partial,true);
  assert.equal(raw.freshnessExpected,false);
  assert.match(raw.message,/no observation timestamps or freshness bands/);
});

test("gdebenz nearby API extractor preserves coordinates, current family status and time", async () => {
  const rows={stations:[
    {osm_id:"yes-95",lon:44.5,lat:48.7,name:"АЗС 1",addr:"Адрес 1",status:"queue",fuels_now:"92,95",detail:"92, 95 · Очередь ≈20–50 машин",last_at:"2026-08-30 19:33:26"},
    {osm_id:"no-fuel",lon:44.6,lat:48.8,name:"АЗС 2",addr:"Адрес 2",status:"no",fuels_now:"95",detail:"Заправка не работает",last_at:"2026-08-30 19:35:39"}
  ]};
  const fetch=async()=>({ok:true,json:async()=>rows});
  const raw=await Function("fetch","location",`return ${gdebenz.gdebenzApiExtractor("https://gdebenz.ru/api/nearby")}`)(fetch,{href:"https://gdebenz.ru/"});
  assert.deepEqual(raw.stations[0].coordinate,[44.5,48.7]);
  assert.equal(raw.observations[0].status,"92, 95 · Очередь ≈20–50 машин");
  assert.equal(raw.observations[0].normalizedStatus,"IN_STOCK");
  assert.equal(raw.observations[0].observedAt,"2026-08-30T19:33:26.000Z");
  assert.equal(raw.observations[1].status,"Заправка не работает");
  assert.equal(raw.observations[1].normalizedStatus,"OUT_OF_STOCK");
  assert.equal(raw.observations[1].familyAllUnavailable,true);
  assert.equal(raw.queues[0].ordinal,"LONG");
  assert.equal(raw.freshnessExpected,true);
  const browser={open:async()=>({finalUrl:"https://gdebenz.ru/",pageTitle:"Где бензин",pageTextPrefix:"Карта"}),waitReady:async()=>{},evalJson:async()=>raw};
  const normalized=await gdebenz.collect(request(await loadConfig()),{browser,config:await loadConfig()});
  assert.equal(normalized.observations[1].status,"OUT_OF_STOCK");
  assert.equal(normalized.observations[1].rawStatus,"Заправка не работает");
});

test("gdebenz API extractor treats missing timestamps as a declared limitation and ignores decimal prices", async () => {
  const rows={stations:[{osm_id:"price-only",lon:44.5,lat:48.7,status:"yes",fuels_now:"",detail:"Цена 59.95 · Только наличные"}]};
  const fetch=async()=>({ok:true,json:async()=>rows});
  const raw=await Function("fetch","location",`return ${gdebenz.gdebenzApiExtractor("https://gdebenz.ru/api/nearby")}`)(fetch,{href:"https://gdebenz.ru/"});
  assert.equal(raw.observations[0].status,"Цена 59.95 · Только наличные");
  assert.equal(raw.observations[0].normalizedStatus,"UNKNOWN");
  assert.equal(raw.partial,true);
  assert.equal(raw.code,"NO_FRESHNESS_METADATA");
  assert.equal(raw.freshnessExpected,false);
});

test("2GIS extractor reads current fuel data and normalizes structured brands", async () => {
  const liveUrl="https://benzin.api.2gis.ru/api/v1/stations/by-ids?ids=station-1";
  const rows=[{station:{id:"station-1",lng:44.5,lat:48.7,name:"АЗС",address:"Адрес",brand:{id:"brand-1",name:"Бренд"}},fuel_statuses:[{fuel_type:"AI_95",available:true,last_report_at:"2026-08-30T19:40:00Z",queue_level:"UP_TO_25"}],queue_level:"UP_TO_25"}];
  const document={body:{innerText:"АЗС"},scripts:[]};
  const performance={getEntriesByType:()=>[{name:liveUrl}]};
  const fetch=async()=>({ok:true,json:async()=>rows});
  const raw=await Function("window","document","location","performance","fetch","URL",`return ${twogis.TWOGIS_EXTRACTOR}`)({},document,{href:"https://2gis.ru/volgograd/search/АЗС"},performance,fetch,URL);
  assert.deepEqual(raw.stations[0].coordinate,[44.5,48.7]);
  assert.equal(raw.stations[0].brand,"Бренд");
  assert.equal(raw.observations[0].fuel,"AI_95");
  assert.equal(raw.observations[0].status,"IN_STOCK");
  assert.equal(raw.observations[0].observedAt,"2026-08-30T19:40:00Z");
  assert.equal(raw.queues[0].ordinal,"LONG");
  assert.equal(raw.partial,false);
});

test("2GIS extractor preserves alias, array and opaque brand forms", async () => {
  const rows = [
    { station: { id: "alias", lng: 44.5, lat: 48.7, brand: { id: 1, alias: "Лукойл" } }, fuel_statuses: [] },
    { station: { id: "array", lng: 44.6, lat: 48.7, brand: [{ name: "Роснефть" }, { alias: "Пульсар" }] }, fuel_statuses: [] },
    { station: { id: "opaque", lng: 44.7, lat: 48.7, brand: { id: 42 } }, fuel_statuses: [] }
  ];
  const liveUrl = "https://benzin.api.2gis.ru/api/v1/stations/by-ids?ids=alias,array,opaque";
  const raw = await Function("window", "document", "location", "performance", "fetch", "URL", `return ${twogis.TWOGIS_EXTRACTOR}`)({}, { body: { innerText: "АЗС" }, scripts: [] }, { href: "https://2gis.ru/volgograd/search/АЗС" }, { getEntriesByType: () => [{ name: liveUrl }] }, async () => ({ ok: true, json: async () => rows }), URL);
  assert.deepEqual(raw.stations.map(station => station.brand), ["Лукойл", "Роснефть / Пульсар", "brand-id:42"]);
});

test("Benzonavt handles exhaustive fuels, conflicts and structured queues conservatively", async () => {
  const rows=[
    {id:1,lon:44.5,lat:48.7,name:"АЗС 1",brand:"Бренд",address:"Адрес 1",st:{status:"yes",fuels_now:["92","95"],updated_at:"2026-08-30T19:40:00Z",queue:{at:"2026-08-30T19:42:00Z",size:"20_50"}}},
    {id:2,lon:44.6,lat:48.8,name:"АЗС 2",brand:"Бренд",address:"Адрес 2",st:{status:"no",fuels_now:[],updated_at:"2026-08-30T19:41:00Z"}},
    {id:3,lon:44.7,lat:48.7,name:"АЗС 3",brand:"Бренд",address:"Адрес 3",st:{status:"yes",fuels_now:["dt"],updated_at:"2026-08-30T19:42:00Z",queue:{at:"2026-08-30T19:43:00Z",size:"gt50"}}},
    {id:4,lon:44.8,lat:48.7,name:"АЗС 4",brand:"Бренд",address:"Адрес 4",st:{status:"no",fuels_now:[],updated_at:"2026-08-30T19:43:00Z",conflict:{status:"yes",created_at:"2026-08-30T19:42:00Z"}}},
    {id:5,lon:44.9,lat:48.7,name:"АЗС 5",brand:"Бренд",address:"Адрес 5",st:{status:"yes",fuels_now:["95"],updated_at:"2026-08-30T19:44:00Z",conflict:{status:"no",created_at:"2026-08-30T19:43:00Z"}}},
    {id:6,lon:45.0,lat:48.7,name:"АЗС 6",brand:"Бренд",address:"Адрес 6",st:{status:"yes",fuels_now:["95"],updated_at:"2026-08-30T19:45:00Z",conflict:{fuels_now:["dt"]},queue:{size:"20_50"}}}
  ];
  const document={body:{innerText:"Бензонавт"}};
  const fetch=async()=>({ok:true,json:async()=>rows});
  const raw=await Function("document","location","fetch",`return ${benzonavt.benzonavtExtractor("https://benzonavt.ru/api/v1/stations?bbox=x")}`)(document,{href:"https://benzonavt.ru/"},fetch);
  assert.equal(raw.stations.length,6);
  const byId=Object.fromEntries(raw.observations.map(value=>[value.stationId,value]));
  assert.equal(byId["1"].status,"IN_STOCK");
  assert.equal(byId["2"].familyAllUnavailable,true);
  assert.equal(byId["3"].status,"OUT_OF_STOCK");
  assert.equal(byId["3"].familyAllUnavailable,true);
  assert.equal(byId["4"].status,"UNCERTAIN");
  assert.equal(byId["4"].familyAllUnavailable,undefined);
  assert.equal(byId["5"].status,"UNCERTAIN");
  assert.equal(byId["6"].status,"UNCERTAIN");
  assert.equal(byId["6"].observedAt,undefined);
  assert.ok(byId["4"].conflict && byId["5"].conflict && byId["6"].conflict);
  assert.equal(raw.queues[0].ordinal,"LONG");
  assert.equal(raw.queues[0].observedAt,"2026-08-30T19:42:00Z");
  assert.equal(raw.queues[1].ordinal,"VERY_LONG");
  assert.equal(raw.queues[2].ordinal,"LONG");
  assert.equal(raw.queues[2].observedAt,undefined);
  assert.equal(raw.freshnessExpected,true);
});
