import { errorResult, healthResult, okResult } from "./common.mjs";

export const id = "gdebenz";
export const capability = "CURRENT_FAMILY";

export async function collect(request, ctx) {
  try {
    let opened = await ctx.browser.open("https://gdebenz.ru/");
    if (is502(opened)) { opened = await ctx.browser.open("https://gdebenz.ru/"); if (is502(opened)) return healthResult(id, "HTTP_ERROR", "HTTP_ERROR_PAGE", "Fixture-validated 502 error page"); }
    await ctx.browser.waitReady({ anyOfSelectors: ["#map", "[class*=map]", "script"], urlRejectPatterns: ["captcha", "challenge"], timeoutMs: Math.min(20000, ctx.config.browser.adapterTimeoutMs) });
    const raw = await ctx.browser.evalJson(GDEBENZ_EXTRACTOR);
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message);
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) { return errorResult(id, error); }
}
function is502(opened) { return /(?:^|\s)502(?:\s|$)|bad gateway/i.test(opened.pageTextPrefix); }
const GDEBENZ_EXTRACTOR = String.raw`(() => {
  const stations = [], observations = [], queues = [], activity = [], seen = new Set();
  const consume = raw => {
    if (!raw || typeof raw !== 'object') return;
    const id = String(raw.id || raw.station_id || raw.stationId || raw.uuid || '');
    const coordinate = raw.coordinates || raw.coordinate || (raw.lon != null ? [raw.lon, raw.lat] : raw.lng != null ? [raw.lng, raw.lat] : null);
    if (id && Array.isArray(coordinate) && !seen.has(id)) { seen.add(id); stations.push({ id, coordinate, title: raw.name || raw.title, brand: raw.brand, address: raw.address, url: location.href }); }
    const fuels = raw.fuels || raw.fuel_status || raw.petrol || raw.grades;
    if (id && fuels) for (const [fuel, value] of Object.entries(fuels)) { const v = typeof value === 'object' ? value : { status: value }; observations.push({ stationId: id, fuel, status: v.status ?? v.available ?? value, observedAt: v.updatedAt || v.timestamp, minMinutes: v.minMinutes, maxMinutes: v.maxMinutes, conflict: v.conflict, familyAllUnavailable: v.familyAllUnavailable === true || v.scope === 'family-all' }); }
    if (id && (raw.queue || raw.hasQueue)) queues.push({ stationId: id, value: raw.queue, present: raw.hasQueue === true, observedAt: raw.updatedAt });
  };
  const walked = new WeakSet(); const walk = (v,d=0) => { if (!v || typeof v !== 'object' || d > 9 || walked.has(v)) return; walked.add(v); consume(v); for (const x of Object.values(v)) walk(x,d+1); };
  for (const key of Object.keys(window).filter(k => /state|station|map|data/i.test(k)).slice(0,100)) try { walk(window[key]); } catch {}
  for (const script of document.scripts) { const t=script.textContent||''; if(t.length>100&&t.length<10000000&&/(station|fuel|бенз)/i.test(t)) try { walk(JSON.parse(t)); } catch {} }
  return { stations, observations, queues, activity, schemaChanged: stations.length === 0, message: 'gdebenz page exposed no recognizable coordinate-bearing station data' };
})()`;
