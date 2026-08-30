import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import * as yandex from "../../scripts/lib/sources/yandex.mjs";
import * as twogis from "../../scripts/lib/sources/twogis.mjs";
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
