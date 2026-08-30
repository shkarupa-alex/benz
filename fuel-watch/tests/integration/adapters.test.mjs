import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import * as yandex from "../../scripts/lib/sources/yandex.mjs";
import * as twogis from "../../scripts/lib/sources/twogis.mjs";
import * as gdebenz from "../../scripts/lib/sources/gdebenz.mjs";
import { readJson } from "../../scripts/lib/util.mjs";

const request = config => ({ area: { polygon: [[44,48],[45,48],[45,49],[44,48]] }, requestedProducts: config.requestedProducts, fetchedAt: new Date().toISOString() });

test("Yandex adapter normalizes fake BrowserRunner output", async () => {
  const config = await loadConfig();
  const raw=await readJson(new URL("../fixtures/yandex-current.json",import.meta.url));
  const browser = { open: async()=>({finalUrl:"https://yandex.ru/maps",pageTextPrefix:"АЗС"}), waitReady:async()=>{}, evalJson:async expression=>expression.includes("window.scrollBy") ? true : raw };
  const result = await yandex.collect(request(config),{browser,config});
  assert.equal(result.health.status,"OK");
  assert.equal(result.observations[0].status,"IN_STOCK");
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

test("Yandex page extractor reads live fuelAvailability shape", () => {
  const payload={stack:[{results:{items:[{id:"1089357396",coordinates:[44.502992,48.723609],title:"АЗС",fuelAvailability:{fuel:[{fuelType:"AI95",localizedName:"95",status:"IN_STOCK"}],signalsCountPerHour:3,lastSignalTimestamp:1788076800,queueStatus:"MEDIUM",localizedQueueSize:"Средняя"}}]}}]};
  const document={scripts:[{textContent:JSON.stringify(payload)}],querySelectorAll:()=>[]};
  const raw=Function("window","document","location",`return ${yandex.YANDEX_EXTRACTOR}`)({},document,{href:"https://yandex.ru/maps"});
  assert.equal(raw.stations[0].id,"1089357396");
  assert.equal(raw.observations[0].status,"IN_STOCK");
  assert.equal(raw.observations[0].signalsPerHour,3);
  assert.match(raw.observations[0].observedAt,/^2026-/);
  assert.equal(raw.queues[0].ordinal,"MEDIUM");
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
