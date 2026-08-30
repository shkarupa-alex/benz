import { errorResult, healthResult, okResult } from "./common.mjs";

export const id = "2gis";
export const capability = "CATALOG_ONLY";

export async function collect(request, ctx) {
  try {
    const opened = await ctx.browser.open("https://2gis.ru/volgograd/search/%D0%90%D0%97%D0%A1");
    if (/\/captcha|\/museum|recaptcha|провер.{0,20}(робот|человек)/iu.test(`${opened.finalUrl} ${opened.pageTextPrefix}`)) return healthResult(id, "CHALLENGE", "CHALLENGE", "2GIS presented CAPTCHA/challenge; no bypass attempted");
    await ctx.browser.waitReady({ anyOfSelectors: ["[class*=searchResults]", "a[href*=firm]", "script"], urlRejectPatterns: ["/captcha", "/museum", "recaptcha"], timeoutMs: Math.min(20000, ctx.config.browser.adapterTimeoutMs) });
    const raw = await ctx.browser.evalJson(TWOGIS_EXTRACTOR);
    if (raw.challenge) return healthResult(id, "CHALLENGE", "CHALLENGE", "2GIS challenge detected; no bypass attempted");
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message);
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config);
  } catch (error) { return errorResult(id, error); }
}
const TWOGIS_EXTRACTOR = String.raw`(() => {
  const body = document.body?.innerText || '';
  if (/recaptcha|captcha|подтвердите,? что вы не робот|museum/i.test(location.href + ' ' + body.slice(0,2000))) return { challenge: true };
  const stations = [], observations = [], queues = [], seen = new Set();
  const consume = raw => { if (!raw || typeof raw !== 'object') return; const id=String(raw.id||raw.firmId||raw.orgId||''); const coordinate=raw.point ? [raw.point.lon||raw.point.lng,raw.point.lat] : raw.coordinates||raw.coordinate; if(id&&Array.isArray(coordinate)&&!seen.has(id)){seen.add(id);stations.push({id,coordinate,title:raw.name||raw.title,address:raw.address_name||raw.address,brand:raw.brand,url:raw.url||location.href});} const current=raw.currentFuelAvailability||raw.fuelAvailability; if(id&&current) for(const [fuel,v] of Object.entries(current)){const x=typeof v==='object'?v:{status:v};observations.push({stationId:id,fuel,status:x.status||x.available,observedAt:x.updatedAt});} };
  const walked=new WeakSet(); const walk=(v,d=0)=>{if(!v||typeof v!=='object'||d>8||walked.has(v))return;walked.add(v);consume(v);for(const x of Object.values(v))walk(x,d+1);};
  for(const key of Object.keys(window).filter(k=>/state|data|search|firm/i.test(k)).slice(0,100))try{walk(window[key]);}catch{}
  for(const script of document.scripts){const t=script.textContent||'';if(t.length>100&&t.length<10000000&&/(firm|address_name|fuelAvailability)/i.test(t))try{walk(JSON.parse(t));}catch{}}
  return {stations,observations,queues,activity:[],schemaChanged:stations.length===0,message:'2GIS exposed no recognizable coordinate-bearing station data'};
})()`;
