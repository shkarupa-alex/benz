import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  errorResult,
  healthResult,
  okResult
} from "./chunk-HKDPASWA.mjs";
import "./chunk-IVODUSOD.mjs";
import "./chunk-XKTP5TT3.mjs";

// scripts/lib/sources/yandex.mjs
var id = "yandex";
var capability = "CURRENT_GRADE";
async function collect(request, ctx) {
  try {
    const center = centroid(request.area.polygon);
    const url = `https://yandex.ru/maps/38/volgograd/search/${encodeURIComponent("\u0410\u0417\u0421 \u0410\u0418-95")}/?ll=${center[0]}%2C${center[1]}&z=12`;
    const opened = await ctx.browser.open(url);
    if (/captcha|showcaptcha/i.test(`${opened.finalUrl} ${opened.pageTextPrefix}`)) return healthResult(id, "CHALLENGE", "CHALLENGE", "Yandex presented a challenge");
    if (/^limited$/i.test(opened.pageTextPrefix.trim())) return healthResult(id, "HTTP_ERROR", "HTTP_429_LIMITED", "Yandex returned its automation rate-limit page");
    await ctx.browser.waitReady({ anyOfSelectors: ["[data-chunk=search-result]", ".search-snippet-view", "script"], urlRejectPatterns: ["showcaptcha", "captcha"], timeoutMs: Math.min(2e4, ctx.config.browser.adapterTimeoutMs) });
    let raw = await ctx.browser.evalJson(YANDEX_EXTRACTOR);
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message ?? "No recognizable station structures");
    const batches = [raw];
    let previousIds = new Set(raw.stations.map((station) => String(station.id)));
    let naturalTermination = false;
    for (let page = 1; page < 10; page++) {
      await ctx.browser.evalJson(`new Promise(resolve => { window.scrollBy(0, Math.max(window.innerHeight * 2, 1200)); setTimeout(() => resolve(true), 400); })`);
      const batch = await ctx.browser.evalJson(YANDEX_EXTRACTOR);
      const ids = new Set(batch.stations.map((station) => String(station.id)));
      const newIds = [...ids].filter((value) => !previousIds.has(value));
      batches.push(batch);
      if (!ids.size || !newIds.length) {
        naturalTermination = true;
        break;
      }
      previousIds = /* @__PURE__ */ new Set([...previousIds, ...ids]);
    }
    raw = mergeBatches(batches);
    raw.naturalTermination = naturalTermination;
    const noGradeFreshness = raw.observations.length > 0 && !raw.observations.some((observation) => observation.observedAt);
    raw.freshnessExpected = !noGradeFreshness;
    raw.partial = !naturalTermination || raw.observations.length === 0 || noGradeFreshness;
    if (raw.partial) {
      raw.code = !naturalTermination ? "TRUNCATED" : noGradeFreshness ? "NO_GRADE_FRESHNESS_METADATA" : "LOW_FUEL_COVERAGE";
      raw.message = !naturalTermination ? "Pagination cap reached before repeated/empty station IDs" : noGradeFreshness ? "Yandex exposes only station-level freshness, which is ineligible for grade verdicts" : "Stations were enumerated but no current fuel blocks were extracted";
    }
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) {
    return errorResult(id, error);
  }
}
var YANDEX_EXTRACTOR = String.raw`(() => {
  const stationMap = new Map(), observations = [], queues = [], activity = [];
  const isoTime = value => { if (value == null || value === '') return undefined; const numeric = Number(value); const date = Number.isFinite(numeric) ? new Date(numeric < 1e12 ? numeric * 1000 : numeric) : new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : undefined; };
  const isGasoline = value => /(?:^|[^\p{L}\p{N}])(?:аи|ai)?[-\s]?(?:92|95|98|100)(?:\+)?(?:[^\p{L}\p{N}]|$)/iu.test(String(value || ''));
  const add = (raw, fallback = {}) => {
    if (!raw || typeof raw !== 'object') return;
    const id = String(raw.id || raw.businessId || raw.oid || raw.uri || fallback.id || '');
    const coords = raw.coordinates || raw.geometry?.coordinates || raw.point || raw.geocode;
    const fuels = raw.fuelAvailability || raw.fuels || raw.fuel || raw.properties?.fuelAvailability;
    if (id && Array.isArray(coords) && coords.length >= 2) stationMap.set(id, { id, coordinate: coords, title: raw.title || raw.name || fallback.title, address: raw.address || raw.subtitle || raw.properties?.CompanyMetaData?.address, brand: raw.brand, url: raw.uri || location.href });
    if (id && fuels) {
      const rows = Array.isArray(fuels?.fuel) ? fuels.fuel : Array.isArray(fuels) ? fuels : Object.entries(fuels).filter(([,value]) => value == null || typeof value !== 'object' || !Array.isArray(value)).map(([fuel, value]) => typeof value === 'object' ? { fuel, ...value } : { fuel, status: value });
      for (const f of rows) {
        const fuel = f.localizedName || f.fuelType || f.fuel || f.name || f.title || f.grade;
        const observedAt = isoTime(f.lastSignalTimestamp || f.updatedAt || f.timestamp);
        const perGradeSignals = f.signalsCountPerHour == null ? NaN : Number(f.signalsCountPerHour);
        observations.push({ stationId: id, fuel, status: f.status || f.availability || f.value, observedAt, signalsPerHour: Number.isFinite(perGradeSignals) ? perGradeSignals : undefined, url: location.href });
        if (isGasoline(fuel)) activity.push({ stationId: id, fuel, gradeLabel: fuel, kind: 'PETROL_STATUS_SNAPSHOT', status: f.status || f.availability || f.value, gradeSpecific: true, sourceTerminology: 'STATUS' });
        const perGradeObservedAt = isoTime(f.lastSignalTimestamp || f.updatedAt || f.timestamp);
        if (isGasoline(fuel) && perGradeObservedAt && Number.isFinite(perGradeSignals)) activity.push({ stationId: id, fuel, gradeLabel: fuel, kind: 'ROLLING_SIGNAL_COUNT', observedAt: perGradeObservedAt, latestEventAt: perGradeObservedAt, count: perGradeSignals, windowMinutes: 60, gradeSpecific: true, sourceTerminology: 'SIGNAL' });
      }
      if (fuels.queueStatus || fuels.localizedQueueSize) queues.push({ stationId: id, value: fuels.localizedQueueSize || fuels.queueStatus, ordinal: fuels.queueStatus, observedAt: isoTime(fuels.lastSignalTimestamp) });
    }
    const q = raw.queue || raw.queueStatus || raw.properties?.queue;
    if (id && q) queues.push({ stationId: id, value: typeof q === 'object' ? q.label || q.status || q.value : q, vehicleCount: q?.vehicleCount, observedAt: q?.updatedAt });
  };
  const seen = new WeakSet();
  const walk = (value, depth = 0) => { if (!value || typeof value !== 'object' || depth > 10 || seen.has(value)) return; seen.add(value); add(value); for (const child of Object.values(value)) walk(child, depth + 1); };
  for (const key of ['__INITIAL_STATE__','__PRELOADED_STATE__','__APOLLO_STATE__']) try { walk(window[key]); } catch {}
  for (const script of document.scripts) { const text = script.textContent || ''; if (text.length > 200 && text.length < 10000000 && /fuelAvailability|signalsCountPerHour/.test(text)) { try { walk(JSON.parse(text)); } catch {} } }
  for (const card of document.querySelectorAll('[data-business-id], [data-id], .search-snippet-view')) { const id = card.dataset.businessId || card.dataset.id || card.querySelector('a[href*="/org/"]')?.href.match(/\/org\/[^/]+\/(\d+)/)?.[1]; const title = card.querySelector('h2,h3,[class*=title]')?.textContent?.trim(); const text = card.textContent || ''; const coordinate = String(card.dataset.coordinates || '').split(',').map(Number); if (id && !stationMap.has(id)) stationMap.set(id, { id, title, address: text.slice(0,300), coordinate: coordinate.length === 2 && coordinate.every(Number.isFinite) ? coordinate : [NaN,NaN], url: card.querySelector('a')?.href || location.href }); }
  const stations = [...stationMap.values()];
  return { stations, observations, queues, activity, schemaChanged: stations.length === 0, message: stations.length ? undefined : 'Yandex station enumeration returned no station records' };
})()`;
function centroid(points) {
  const ring = points.at(-1)?.[0] === points[0]?.[0] && points.at(-1)?.[1] === points[0]?.[1] ? points.slice(0, -1) : points;
  return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
}
function mergeBatches(batches) {
  const stations = /* @__PURE__ */ new Map(), observations = /* @__PURE__ */ new Map(), queues = /* @__PURE__ */ new Map(), activity = /* @__PURE__ */ new Map();
  for (const batch of batches) {
    for (const station of batch.stations ?? []) stations.set(String(station.id), station);
    for (const value of batch.observations ?? []) observations.set(JSON.stringify([value.stationId, value.fuel, value.status, value.observedAt]), value);
    for (const value of batch.queues ?? []) queues.set(JSON.stringify([value.stationId, value.value, value.observedAt]), value);
    for (const value of batch.activity ?? []) activity.set(JSON.stringify(value), value);
  }
  return { stations: [...stations.values()], observations: [...observations.values()], queues: [...queues.values()], activity: [...activity.values()] };
}
export {
  YANDEX_EXTRACTOR,
  capability,
  collect,
  id
};
