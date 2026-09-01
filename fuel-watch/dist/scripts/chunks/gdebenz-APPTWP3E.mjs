import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  detailTiming,
  errorResult,
  healthResult,
  okResult
} from "./chunk-XZJAO6QU.mjs";
import "./chunk-PGL4WRLA.mjs";
import "./chunk-XKTP5TT3.mjs";

// scripts/lib/sources/gdebenz.mjs
var id = "gdebenz";
var capability = "CURRENT_FAMILY";
async function collect(request, ctx) {
  try {
    let opened = await ctx.browser.open("https://gdebenz.ru/");
    if (is502(opened)) {
      opened = await ctx.browser.open("https://gdebenz.ru/");
      if (is502(opened)) return healthResult(id, "HTTP_ERROR", "HTTP_ERROR_PAGE", "Fixture-validated 502 error page");
    }
    await ctx.browser.waitReady({ anyOfSelectors: ["#map", "[class*=map]", "script"], urlRejectPatterns: ["captcha", "challenge"], timeoutMs: Math.min(2e4, ctx.config.browser.adapterTimeoutMs) });
    const timing = detailTiming(ctx.config);
    let raw = await ctx.browser.evalJson(gdebenzApiExtractor(nearbyUrl(request.area.polygon), timing.requestTimeoutMs, timing.budgetMs));
    if (raw.apiUnavailable || raw.schemaChanged) {
      const fallback = await ctx.browser.evalJson(GDEBENZ_EXTRACTOR);
      raw = fallback.schemaChanged ? { ...fallback, message: `${raw.message}; ${fallback.message}` } : fallback;
    }
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message);
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) {
    return errorResult(id, error);
  }
}
function is502(opened) {
  return /^\s*(?:error\s+)?502(?:\s*-?\s*bad gateway)?\s*$/iu.test(opened.pageTitle ?? "") || /^\s*502\s*-?\s*bad gateway\b/iu.test(opened.pageTextPrefix ?? "");
}
function gdebenzApiExtractor(url, detailTimeoutMs = 3500, detailBudgetMs = 1e4) {
  return String.raw`(async () => {
  const extractorStartedAt = Date.now();
  try {
    const response = await fetch(${JSON.stringify(url)}, { credentials: 'same-origin' });
    if (!response.ok) return { apiUnavailable: true, schemaChanged: true, message: 'gdebenz nearby API returned HTTP ' + response.status };
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload && Array.isArray(payload.stations) ? payload.stations : [];
    if (!rows.length) return { apiUnavailable: true, schemaChanged: true, message: 'gdebenz nearby API exposed no station rows' };
    const stations = [], observations = [], queues = [], activity = [];
    const isoTime = value => {
      if (!value) return undefined;
      const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(String(value)) ? String(value).replace(' ', 'T') + 'Z' : value;
      const date = new Date(normalized);
      return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
    };
    const petrolGrades = value => [...new Set((String(value || '').match(/(?:^|[^0-9])(92|95|98|100)(?=$|[^0-9])/gu) || []).map(match => match.match(/92|95|98|100/u)?.[0]).filter(Boolean))];
    const commentPetrolGrades = value => { const fuelSegment = String(value || '').split('·')[0].trim(); return /очеред|лимит|цена/iu.test(fuelSegment) ? [] : petrolGrades(fuelSegment); };
    const mapLimit = async (values, limit, fn) => { const out = new Array(values.length); let cursor = 0; await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => { while (cursor < values.length) { const index = cursor++; try { out[index] = await fn(values[index]); } catch {} } })); return out; };
    const detailDeadline = extractorStartedAt + ${Number(detailBudgetMs)};
    const detailRows = rows.filter(row => String(row.osm_id || row.id || '') && Number.isFinite(Number(row.lon)) && Number.isFinite(Number(row.lat)));
    const commentRows = await mapLimit(detailRows, 6, async row => { const remainingMs = detailDeadline - Date.now(); if (remainingMs <= 0) return; const id = String(row.osm_id || row.id || ''); const commentsResponse = await fetch('/api/comments/' + encodeURIComponent(id) + '/recent?limit=12', { credentials: 'same-origin', signal: AbortSignal.timeout(Math.max(1, Math.min(${Number(detailTimeoutMs)}, remainingMs))) }); if (!commentsResponse.ok) return; const comments = await commentsResponse.json(); return Array.isArray(comments) ? [id, comments] : undefined; });
    const commentsById = new Map(commentRows.filter(Boolean));
    for (const row of rows) {
      const id = String(row.osm_id || row.id || '');
      if (!id || !Number.isFinite(Number(row.lon)) || !Number.isFinite(Number(row.lat))) continue;
      stations.push({ id, coordinate: [Number(row.lon), Number(row.lat)], title: row.name || row.brand, brand: row.brand, address: row.addr, url: location.href });
      const detail = String(row.detail || '');
      const listed = String(row.fuels_now || '') + ',' + detail.split('·')[0];
      const hasAi95 = /(?:^|[\s,;/])(?:аи[-\s]?|ai[-\s]?)?95\+?(?=$|[\s,;/])/iu.test(listed);
      const familyUnavailable = String(row.status || '').toLowerCase() === 'no' || /нет\s+топлива|заправка\s+не\s+работает/iu.test(detail);
      observations.push({ stationId: id, fuel: 'АИ-95', status: detail || String(row.status || ''), normalizedStatus: familyUnavailable ? 'OUT_OF_STOCK' : hasAi95 ? 'IN_STOCK' : 'UNKNOWN', observedAt: isoTime(row.last_at), familyAllUnavailable: familyUnavailable });
      for (const grade of petrolGrades(listed)) activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'PETROL_STATUS_SNAPSHOT', status: familyUnavailable ? 'OUT_OF_STOCK' : 'IN_STOCK', observedAt: isoTime(row.last_at), gradeSpecific: true, sourceTerminology: 'STATUS' });
      const comments = [...(commentsById.get(id) || [])].sort((a, b) => new Date(isoTime(a.created_at) || 0) - new Date(isoTime(b.created_at) || 0));
      const knownGrades = [...new Set([...(petrolGrades(listed)), ...comments.flatMap(comment => commentPetrolGrades(comment.detail))])];
      const stateByGrade = new Map(knownGrades.map(grade => [grade, 'UNKNOWN']));
      const timesByGrade = new Map();
      for (const comment of comments) {
        const at = isoTime(comment.created_at); if (!at) continue;
        const status = String(comment.status || '').toLowerCase();
        const grades = commentPetrolGrades(comment.detail);
        const detailText = String(comment.detail || '');
        const fuelSegment = detailText.split('·')[0].trim();
        const namesSpecificFuel = /(?:^|[^\p{L}\p{N}])(?:дт|дизел\p{L}*|92|95|98|100)(?:[^\p{L}\p{N}]|$)/iu.test(fuelSegment);
        const familyNegative = status === 'no' && !namesSpecificFuel && /нет\s+(?:топлива|бензина)|заправка\s+не\s+работает/iu.test(detailText);
        if (status === 'no') for (const grade of (grades.length ? grades : familyNegative ? knownGrades : [])) stateByGrade.set(grade, 'OUT_OF_STOCK');
        if (['yes','queue'].includes(status)) for (const grade of grades) {
          const eventTimes = timesByGrade.get(grade) ?? []; eventTimes.push(at); timesByGrade.set(grade, eventTimes);
          if (stateByGrade.get(grade) === 'OUT_OF_STOCK') activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'SOURCE_REPORTED_TRANSITION', observedAt: at, gradeSpecific: true, sourceTerminology: 'USER_REPORT' });
          stateByGrade.set(grade, 'IN_STOCK');
        }
      }
      for (const [grade, eventTimes] of timesByGrade) activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'RECENT_SIGNAL', eventTimes, gradeSpecific: true, sourceTerminology: 'USER_REPORT' });
      const queue = detail.match(/очередь\s*([^·,;]*)/iu)?.[1]?.trim();
      if (queue) {
        const ordinal = /100\s*\+/u.test(queue) ? 'VERY_LONG' : /50\s*[–—-]\s*100/u.test(queue) ? 'LONG' : /20\s*[–—-]\s*50/u.test(queue) ? 'LONG' : /5\s*[–—-]\s*20/u.test(queue) ? 'MEDIUM' : undefined;
        queues.push({ stationId: id, value: queue, ordinal, present: true, observedAt: isoTime(row.last_at) });
      }
    }
    const hasFreshness = observations.some(observation => observation.observedAt);
    const noFreshnessMetadata = observations.length > 0 && !hasFreshness;
    return { stations, observations, queues, activity, apiUnavailable: stations.length === 0, schemaChanged: stations.length === 0, partial: noFreshnessMetadata, code: noFreshnessMetadata ? 'NO_FRESHNESS_METADATA' : undefined, freshnessExpected: hasFreshness, naturalTermination: true, message: stations.length === 0 ? 'gdebenz nearby API rows lacked station identity or coordinates' : noFreshnessMetadata ? 'gdebenz nearby API exposes no observation timestamps' : undefined, activityHistoryCoverage: detailRows.length ? commentsById.size / detailRows.length : 1 };
  } catch (error) {
    return { apiUnavailable: true, schemaChanged: true, message: 'gdebenz nearby API could not be read: ' + error.message };
  }
})()`;
}
function nearbyUrl(polygon) {
  const ring = polygon.length > 1 && polygon[0][0] === polygon.at(-1)[0] && polygon[0][1] === polygon.at(-1)[1] ? polygon.slice(0, -1) : polygon;
  const lon = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
  const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  const radiusKm = Math.max(5, Math.ceil(Math.max(...ring.map((point) => distanceKm([lon, lat], point))) + 2));
  return `https://gdebenz.ru/api/nearby?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&radius_km=${radiusKm}`;
}
function distanceKm(a, b) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
var GDEBENZ_EXTRACTOR = String.raw`(() => {
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
  const hasFreshness = observations.some(o => o.observedAt || (Number.isFinite(o.minMinutes) && Number.isFinite(o.maxMinutes)));
  const noFreshnessMetadata = observations.length > 0 && !hasFreshness;
  const limitations = [missingCoordinates && 'some coordinates are unavailable', noFreshnessMetadata && 'the source exposes no observation timestamps or freshness bands'].filter(Boolean);
  return { stations, observations, queues, activity, schemaChanged: stations.length === 0, partial: missingCoordinates || noFreshnessMetadata, code: missingCoordinates ? 'COORDINATE_COVERAGE' : noFreshnessMetadata ? 'NO_FRESHNESS_METADATA' : undefined, message: limitations.length ? 'Recognizable gdebenz station statuses were found, but ' + limitations.join(' and ') : stations.length ? undefined : 'gdebenz page exposed no recognizable station data', freshnessExpected: !noFreshnessMetadata };
})()`;
export {
  GDEBENZ_EXTRACTOR,
  capability,
  collect,
  gdebenzApiExtractor,
  id
};
