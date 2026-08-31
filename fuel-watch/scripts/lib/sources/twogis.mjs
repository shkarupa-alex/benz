import { errorResult, healthResult, okResult } from "./common.mjs";

export const id = "2gis";
export const capability = "CURRENT_GRADE";

export async function collect(request, ctx) {
  try {
    const opened = await ctx.browser.open("https://2gis.ru/volgograd/search/%D0%90%D0%97%D0%A1");
    if (/\/captcha|\/museum|recaptcha|провер.{0,20}(робот|человек)/iu.test(`${opened.finalUrl} ${opened.pageTextPrefix}`)) return healthResult(id, "CHALLENGE", "CHALLENGE", "2GIS presented CAPTCHA/challenge; no bypass attempted");
    await ctx.browser.waitReady({ anyOfSelectors: ["[class*=searchResults]", "a[href*=firm]"], urlRejectPatterns: ["/captcha", "/museum", "recaptcha"], timeoutMs: Math.min(20000, ctx.config.browser.adapterTimeoutMs) });
    const raw = await ctx.browser.evalJson(TWOGIS_EXTRACTOR);
    if (raw.challenge) return healthResult(id, "CHALLENGE", "CHALLENGE", "2GIS challenge detected; no bypass attempted");
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message);
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) { return errorResult(id, error); }
}
export const TWOGIS_EXTRACTOR = String.raw`(async () => {
  const body = document.body?.innerText || '';
  if (/recaptcha|captcha|подтвердите,? что вы не робот|museum/i.test(location.href + ' ' + body.slice(0,2000))) return { challenge: true };
  const stations = [], observations = [], queues = [], seen = new Set();
  const brandName = brand => typeof brand === 'string' ? brand : brand?.name || brand?.title;
  const consume = raw => { if (!raw || typeof raw !== 'object') return; const id=String(raw.id||raw.firmId||raw.orgId||''); const coordinate=raw.point ? [raw.point.lon||raw.point.lng,raw.point.lat] : raw.coordinates||raw.coordinate; if(id&&Array.isArray(coordinate)&&!seen.has(id)){seen.add(id);stations.push({id,coordinate,title:raw.name||raw.title,address:raw.address_name||raw.address,brand:brandName(raw.brand),url:raw.url||location.href});} const current=raw.currentFuelAvailability||raw.fuelAvailability; if(id&&current) for(const [fuel,v] of Object.entries(current)){const x=typeof v==='object'?v:{status:v};observations.push({stationId:id,fuel,status:x.status||x.available,observedAt:x.updatedAt});} };
  const walked=new WeakSet(); const walk=(v,d=0)=>{if(!v||typeof v!=='object'||d>8||walked.has(v))return;walked.add(v);consume(v);for(const x of Object.values(v))walk(x,d+1);};
  for(const key of Object.keys(window).filter(k=>/state|data|search|firm/i.test(k)).slice(0,100))try{walk(window[key]);}catch{}
  for(const script of document.scripts){const t=script.textContent||'';if(t.length>100&&t.length<10000000&&/(firm|address_name|fuelAvailability)/i.test(t))try{walk(JSON.parse(t));}catch{}}
  const liveUrl = performance.getEntriesByType('resource').map(entry => entry.name).reverse().find(url => /\/api\/v1\/stations\/by-ids\?ids=/i.test(url) && new URL(url).hostname === 'benzin.api.2gis.ru');
  let liveRows = [];
  if (liveUrl) try { const response = await fetch(liveUrl); if (response.ok) { const value = await response.json(); if (Array.isArray(value)) liveRows = value; } } catch {}
  for (const row of liveRows) {
    const station = row?.station;
    const id = String(station?.id || '');
    if (!id || !Number.isFinite(Number(station.lng)) || !Number.isFinite(Number(station.lat))) continue;
    if (!seen.has(id)) { seen.add(id); stations.push({ id, coordinate: [Number(station.lng), Number(station.lat)], title: station.name, address: station.address, brand: brandName(station.brand), url: location.href }); }
    let newest;
    for (const fuel of row.fuel_statuses || []) {
      const observedAt = fuel.last_report_at;
      if (observedAt && (!newest || new Date(observedAt) > new Date(newest))) newest = observedAt;
      observations.push({ stationId: id, fuel: fuel.fuel_type, status: fuel.available === true ? 'IN_STOCK' : fuel.available === false ? 'OUT_OF_STOCK' : 'UNKNOWN', observedAt, signalsPerHour: undefined });
    }
    const queueLevel = row.queue_level || (row.fuel_statuses || []).find(fuel => fuel.queue_level && fuel.queue_level !== 'NONE')?.queue_level;
    if (queueLevel && queueLevel !== 'NONE') queues.push({ stationId: id, value: queueLevel, ordinal: queueLevel === 'OVER_50' ? 'VERY_LONG' : queueLevel === 'FROM_25_TO_50' ? 'LONG' : queueLevel === 'UP_TO_25' ? 'LONG' : undefined, present: true, observedAt: newest });
  }
  const liveAvailable = liveRows.length > 0;
  return {stations,observations,queues,activity:[],schemaChanged:stations.length===0,partial:!liveAvailable,code:liveAvailable?undefined:'CURRENT_DATA_UNAVAILABLE',message:stations.length===0?'2GIS exposed no recognizable coordinate-bearing station data':liveAvailable?undefined:'2GIS station catalogue loaded, but its current fuel response was not observable',freshnessExpected:liveAvailable,naturalTermination:true};
})()`;
