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
function is502(opened) { return /^\s*(?:error\s+)?502(?:\s*-?\s*bad gateway)?\s*$/iu.test(opened.pageTitle ?? "") || /^\s*502\s*-?\s*bad gateway\b/iu.test(opened.pageTextPrefix ?? ""); }
export const GDEBENZ_EXTRACTOR = String.raw`(() => {
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
  const cards = [...document.querySelectorAll('.stn[data-osm]')];
  for (const card of cards) {
    const id = String(card.dataset.osm || '');
    if (!id || seen.has(id)) continue;
    const text = (card.innerText || card.textContent || '').replace(/\s+/g, ' ').trim();
    const coordinate = String(card.dataset.coordinates || '').split(',').map(Number);
    const title = card.querySelector('[class*=brand],strong,b')?.textContent?.trim() || text.split(/\s{2,}|\n/)[0] || 'АЗС';
    seen.add(id); stations.push({ id, coordinate: coordinate.length === 2 && coordinate.every(Number.isFinite) ? coordinate : [NaN,NaN], title, address: text.slice(0,500), url: location.href });
    const explicitNegative = /нет\s+топлива|заправка\s+не\s+работает/i.test(text);
    const explicitPositive = /есть\s+топливо/i.test(text) && /(?:^|[^\p{L}\p{N}])(?:аи[-\s]?)?95(?:\+)?(?:[^\p{L}\p{N}]|$)/iu.test(text);
    const status = explicitNegative ? 'нет топлива' : explicitPositive ? 'есть топливо' : 'нет данных о топливе';
    observations.push({ stationId: id, fuel: 'АИ-95', status, familyAllUnavailable: explicitNegative });
    if (/очередь/i.test(text)) queues.push({ stationId: id, present: true, value: text.match(/очередь[^,;]*/i)?.[0] || 'очередь' });
  }
  if (!cards.length) for (const [index, marker] of [...document.querySelectorAll('button[aria-label^="АЗС:"], [role="img"][aria-label^="АЗС:"]')].entries()) {
    const label = marker.getAttribute('aria-label') || '';
    const owner = marker.closest('[data-id],[data-station-id],[data-coordinates]');
    const id = marker.dataset.id || marker.dataset.stationId || owner?.dataset.id || owner?.dataset.stationId || 'dom-marker-' + index;
    if (seen.has(id)) continue;
    const rawCoordinate = marker.dataset.coordinates || owner?.dataset.coordinates || '';
    const coordinate = String(rawCoordinate).split(',').map(Number);
    seen.add(id); stations.push({ id, coordinate: coordinate.length === 2 && coordinate.every(Number.isFinite) ? coordinate : [NaN,NaN], title: 'АЗС', address: label, url: location.href });
    const dieselOnly = /только\s+дизель/i.test(label);
    observations.push({ stationId: id, fuel: 'АИ-95', status: dieselOnly ? 'нет данных о топливе' : label.replace(/^АЗС:\s*/i,''), familyAllUnavailable: /нет\s+топлива/i.test(label) });
    if (/очередь/i.test(label)) queues.push({ stationId: id, present: true, value: 'очередь' });
  }
  const missingCoordinates = stations.some(s => !Number.isFinite(Number(s.coordinate?.[0])) || !Number.isFinite(Number(s.coordinate?.[1])));
  return { stations, observations, queues, activity, schemaChanged: stations.length === 0, partial: missingCoordinates, code: missingCoordinates ? 'COORDINATE_COVERAGE' : undefined, message: missingCoordinates ? 'Recognizable gdebenz station statuses were found, but some coordinates are unavailable' : stations.length ? undefined : 'gdebenz page exposed no recognizable station data' };
})()`;
