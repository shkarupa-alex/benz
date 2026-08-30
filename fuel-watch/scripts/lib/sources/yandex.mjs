import { errorResult, healthResult, okResult } from "./common.mjs";

export const id = "yandex";
export const capability = "CURRENT_GRADE";

export async function collect(request, ctx) {
  try {
    const center = centroid(request.area.polygon);
    const url = `https://yandex.ru/maps/38/volgograd/search/${encodeURIComponent("АЗС АИ-95")}/?ll=${center[0]}%2C${center[1]}&z=12`;
    const opened = await ctx.browser.open(url);
    if (/captcha|showcaptcha/i.test(`${opened.finalUrl} ${opened.pageTextPrefix}`)) return healthResult(id, "CHALLENGE", "CHALLENGE", "Yandex presented a challenge");
    if (/^limited$/i.test(opened.pageTextPrefix.trim())) return healthResult(id, "HTTP_ERROR", "HTTP_429_LIMITED", "Yandex returned its automation rate-limit page");
    await ctx.browser.waitReady({ anyOfSelectors: ["[data-chunk=search-result]", ".search-snippet-view", "script"], urlRejectPatterns: ["showcaptcha", "captcha"], timeoutMs: Math.min(20000, ctx.config.browser.adapterTimeoutMs) });
    let raw = await ctx.browser.evalJson(YANDEX_EXTRACTOR);
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message ?? "No recognizable station structures");
    const batches = [raw];
    let previousIds = new Set(raw.stations.map(station => String(station.id)));
    let naturalTermination = false;
    for (let page = 1; page < 10; page++) {
      await ctx.browser.evalJson(`new Promise(resolve => { window.scrollBy(0, Math.max(window.innerHeight * 2, 1200)); setTimeout(() => resolve(true), 400); })`);
      const batch = await ctx.browser.evalJson(YANDEX_EXTRACTOR);
      const ids = new Set(batch.stations.map(station => String(station.id)));
      const newIds = [...ids].filter(value => !previousIds.has(value));
      batches.push(batch);
      if (!ids.size || !newIds.length) { naturalTermination = true; break; }
      previousIds = new Set([...previousIds, ...ids]);
    }
    raw = mergeBatches(batches);
    raw.naturalTermination = naturalTermination;
    raw.partial = !naturalTermination || raw.observations.length === 0;
    if (raw.partial) { raw.code = naturalTermination ? "LOW_FUEL_COVERAGE" : "TRUNCATED"; raw.message = naturalTermination ? "Stations were enumerated but no current fuel blocks were extracted" : "Pagination cap reached before repeated/empty station IDs"; }
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) { return errorResult(id, error); }
}

const YANDEX_EXTRACTOR = String.raw`(() => {
  const stationMap = new Map(), observations = [], queues = [], activity = [];
  const add = (raw, fallback = {}) => {
    if (!raw || typeof raw !== 'object') return;
    const id = String(raw.id || raw.businessId || raw.oid || raw.uri || fallback.id || '');
    const coords = raw.coordinates || raw.geometry?.coordinates || raw.point || raw.geocode;
    const fuels = raw.fuelAvailability || raw.fuels || raw.fuel || raw.properties?.fuelAvailability;
    if (id && Array.isArray(coords) && coords.length >= 2) stationMap.set(id, { id, coordinate: coords, title: raw.title || raw.name || fallback.title, address: raw.address || raw.subtitle || raw.properties?.CompanyMetaData?.address, brand: raw.brand, url: raw.uri || location.href });
    if (id && fuels) {
      const rows = Array.isArray(fuels) ? fuels : Object.entries(fuels).map(([fuel, value]) => typeof value === 'object' ? { fuel, ...value } : { fuel, status: value });
      for (const f of rows) observations.push({ stationId: id, fuel: f.fuel || f.name || f.title || f.grade, status: f.status || f.availability || f.value, observedAt: f.lastSignalTimestamp || f.updatedAt || f.timestamp, signalsPerHour: f.signalsCountPerHour, url: location.href });
    }
    const q = raw.queue || raw.queueStatus || raw.properties?.queue;
    if (id && q) queues.push({ stationId: id, value: typeof q === 'object' ? q.label || q.status || q.value : q, vehicleCount: q?.vehicleCount, observedAt: q?.updatedAt });
  };
  const seen = new WeakSet();
  const walk = (value, depth = 0) => { if (!value || typeof value !== 'object' || depth > 10 || seen.has(value)) return; seen.add(value); add(value); for (const child of Object.values(value)) walk(child, depth + 1); };
  for (const key of ['__INITIAL_STATE__','__PRELOADED_STATE__','__APOLLO_STATE__']) try { walk(window[key]); } catch {}
  for (const script of document.scripts) { const text = script.textContent || ''; if (text.length > 200 && text.length < 10000000 && /fuelAvailability|signalsCountPerHour/.test(text)) { try { walk(JSON.parse(text)); } catch {} } }
  for (const card of document.querySelectorAll('[data-business-id], [data-id], .search-snippet-view')) { const id = card.dataset.businessId || card.dataset.id || card.querySelector('a[href*="/org/"]')?.href.match(/\/org\/[^/]+\/(\d+)/)?.[1]; const title = card.querySelector('h2,h3,[class*=title]')?.textContent?.trim(); const text = card.textContent || ''; if (id && !stationMap.has(id)) stationMap.set(id, { id, title, address: text.slice(0,300), coordinate: [NaN,NaN], url: card.querySelector('a')?.href || location.href }); }
  const stations = [...stationMap.values()];
  return { stations, observations, queues, activity, schemaChanged: stations.length === 0, message: stations.length ? undefined : 'Yandex station enumeration returned no station records' };
})()`;
function centroid(points) { const ring = points.at(-1)?.[0] === points[0]?.[0] && points.at(-1)?.[1] === points[0]?.[1] ? points.slice(0, -1) : points; return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]; }
function mergeBatches(batches) { const stations = new Map(), observations = new Map(), queues = new Map(), activity = new Map(); for (const batch of batches) { for (const station of batch.stations ?? []) stations.set(String(station.id), station); for (const value of batch.observations ?? []) observations.set(JSON.stringify([value.stationId,value.fuel,value.status,value.observedAt]), value); for (const value of batch.queues ?? []) queues.set(JSON.stringify([value.stationId,value.value,value.observedAt]), value); for (const value of batch.activity ?? []) activity.set(JSON.stringify(value), value); } return { stations:[...stations.values()], observations:[...observations.values()], queues:[...queues.values()], activity:[...activity.values()] }; }
