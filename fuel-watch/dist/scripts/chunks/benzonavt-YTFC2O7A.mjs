import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  detailTiming,
  errorResult,
  healthResult,
  okResult
} from "./chunk-HKDPASWA.mjs";
import "./chunk-IVODUSOD.mjs";
import "./chunk-XKTP5TT3.mjs";

// scripts/lib/sources/benzonavt.mjs
var id = "benzonavt";
var capability = "CURRENT_GRADE";
async function collect(request, ctx) {
  try {
    const opened = await ctx.browser.open("https://benzonavt.ru/");
    if (/captcha|recaptcha|провер.{0,20}(робот|человек)/iu.test(`${opened.finalUrl} ${opened.pageTextPrefix}`)) return healthResult(id, "CHALLENGE", "CHALLENGE", "Benzonavt presented CAPTCHA/challenge; no bypass attempted");
    await ctx.browser.waitReady({ anyOfSelectors: ["#map", "[class*=map]", "script[src*=_next]"], urlRejectPatterns: ["captcha", "challenge"], timeoutMs: Math.min(2e4, ctx.config.browser.adapterTimeoutMs) });
    const timing = detailTiming(ctx.config);
    const raw = await ctx.browser.evalJson(benzonavtExtractor(stationsUrl(request.area.polygon), timing.requestTimeoutMs, timing.budgetMs));
    if (raw.challenge) return healthResult(id, "CHALLENGE", "CHALLENGE", "Benzonavt challenge detected; no bypass attempted");
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message);
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) {
    return errorResult(id, error);
  }
}
function benzonavtExtractor(url, detailTimeoutMs = 3500, detailBudgetMs = 1e4) {
  return String.raw`(async () => {
  const extractorStartedAt = Date.now();
  const body = document.body?.innerText || '';
  if (/recaptcha|captcha|подтвердите,? что вы не робот/iu.test(location.href + ' ' + body.slice(0,2000))) return { challenge: true };
  try {
    const response = await fetch(${JSON.stringify(url)}, { credentials: 'same-origin' });
    if (!response.ok) return { schemaChanged: true, message: 'Benzonavt stations API returned HTTP ' + response.status };
    const rows = await response.json();
    if (!Array.isArray(rows)) return { schemaChanged: true, message: 'Benzonavt stations API payload is not an array' };
    const stations = [], observations = [], queues = [], activity = [];
    const familyProduct = { family: 'AI_95', variant: 'UNKNOWN', variantKey: 'FAMILY', displayLabel: 'АИ-95', specificity: 'FAMILY_ONLY', productKey: 'AI95_FAMILY' };
    const isoTime = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : undefined; };
    const petrolGrades = values => [...new Set((Array.isArray(values) ? values : [values]).flatMap(value => String(value || '').match(/(?:^|[^0-9])(92|95|98|100)(?=$|[^0-9])/gu)?.map(match => match.match(/92|95|98|100/u)?.[0]) || []).filter(Boolean))];
    const eventPetrolGrades = event => { if (Array.isArray(event.fuel_grades)) return petrolGrades(event.fuel_grades); const fuelSegment = String(event.detail || '').split('·')[0].trim(); return /очеред|лимит|цена/iu.test(fuelSegment) ? [] : petrolGrades(fuelSegment); };
    const mapLimit = async (values, limit, fn) => { const out = new Array(values.length); let cursor = 0; await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => { while (cursor < values.length) { const index = cursor++; try { out[index] = await fn(values[index]); } catch {} } })); return out; };
    const detailDeadline = extractorStartedAt + ${Number(detailBudgetMs)};
    const detailRows = rows.filter(row => String(row.id ?? '') && Number.isFinite(Number(row.lon)) && Number.isFinite(Number(row.lat)));
    const details = await mapLimit(detailRows, 6, async row => { const remainingMs = detailDeadline - Date.now(); if (remainingMs <= 0) return; const id = String(row.id ?? ''); const detailResponse = await fetch('/api/v1/stations/' + encodeURIComponent(id), { credentials: 'same-origin', signal: AbortSignal.timeout(Math.max(1, Math.min(${Number(detailTimeoutMs)}, remainingMs))) }); if (!detailResponse.ok) return; const detail = await detailResponse.json(); return detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : undefined; });
    const detailsById = new Map(details.filter(Boolean).map(detail => [String(detail.id), detail]));
    for (const row of rows) {
      const id = String(row.id ?? '');
      if (!id || !Number.isFinite(Number(row.lon)) || !Number.isFinite(Number(row.lat))) continue;
      stations.push({ id, coordinate: [Number(row.lon), Number(row.lat)], title: row.name || row.brand, brand: row.brand, address: row.address, url: location.href });
      const state = row.st && typeof row.st === 'object' ? row.st : {};
      const detailRow = detailsById.get(id);
      const updatedAt = state.updated_at;
      const unavailable = String(state.status || '').toLowerCase() === 'no';
      const currentFuels = Array.isArray(state.fuels_now) ? state.fuels_now.map(String) : [];
      const ai95 = currentFuels.filter(fuel => petrolGrades(fuel).includes('95'));
      const hasConflict = state.conflict != null && state.conflict !== false;
      const conflict = hasConflict ? state.conflict : undefined;
      const conflictTime = typeof conflict === 'object' ? conflict.created_at || conflict.updated_at : undefined;
      const currentMs = new Date(updatedAt).getTime(), conflictMs = new Date(conflictTime).getTime();
      const activeConflict = hasConflict && !(Number.isFinite(currentMs) && Number.isFinite(conflictMs) && conflictMs < currentMs);
      if (activeConflict) {
        const products = ai95.length ? ai95 : ['АИ-95'];
        for (const fuel of products) observations.push({ stationId: id, product: ai95.length ? undefined : familyProduct, fuel, status: 'UNCERTAIN', observedAt: conflictTime, conflict: { current: { status: state.status, fuels_now: currentFuels, updated_at: updatedAt }, opposing: conflict } });
      } else if (unavailable) observations.push({ stationId: id, product: familyProduct, fuel: 'АИ-95', status: 'OUT_OF_STOCK', observedAt: updatedAt, familyAllUnavailable: true });
      else if (ai95.length) for (const fuel of ai95) observations.push({ stationId: id, fuel, status: 'IN_STOCK', observedAt: updatedAt });
      else if (currentFuels.length) observations.push({ stationId: id, product: familyProduct, fuel: 'АИ-95', status: 'OUT_OF_STOCK', observedAt: updatedAt, familyAllUnavailable: true });
      else observations.push({ stationId: id, product: familyProduct, fuel: 'АИ-95', status: 'UNKNOWN', observedAt: updatedAt });
      const recent = Array.isArray(detailRow?.recent) ? [...detailRow.recent].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : [];
      const knownPetrol = [...new Set([...petrolGrades(detailRow?.fuels), ...petrolGrades(row.fuels), ...petrolGrades(currentFuels), ...recent.flatMap(eventPetrolGrades)])];
      for (const grade of knownPetrol) activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'PETROL_STATUS_SNAPSHOT', status: activeConflict ? 'UNCERTAIN' : unavailable || (currentFuels.length && !petrolGrades(currentFuels).includes(grade)) ? 'OUT_OF_STOCK' : petrolGrades(currentFuels).includes(grade) ? 'IN_STOCK' : 'UNKNOWN', observedAt: updatedAt, gradeSpecific: true, sourceTerminology: 'STATUS' });
      const stateByGrade = new Map(knownPetrol.map(grade => [grade, 'UNKNOWN']));
      const timesByGrade = new Map();
      for (const event of recent) {
        const at = isoTime(event.created_at); if (!at) continue;
        const status = String(event.status || '').toLowerCase();
        const grades = eventPetrolGrades(event);
        const explicitFuelValues = Array.isArray(event.fuel_grades) ? event.fuel_grades : [];
        const detailText = String(event.detail || '');
        const fuelSegment = detailText.split('·')[0].trim();
        const namesSpecificFuel = explicitFuelValues.length > 0 || /(?:^|[^\p{L}\p{N}])(?:дт|дизел\p{L}*|92|95|98|100)(?:[^\p{L}\p{N}]|$)/iu.test(fuelSegment);
        const familyNegative = status === 'no' && !namesSpecificFuel && (Array.isArray(event.fuel_grades) || /нет\s+(?:топлива|бензина)|заправка\s+не\s+работает/iu.test(detailText));
        if (status === 'no') for (const grade of (grades.length ? grades : familyNegative ? knownPetrol : [])) stateByGrade.set(grade, 'OUT_OF_STOCK');
        if (['yes','queue'].includes(status)) for (const grade of grades) {
          const times = timesByGrade.get(grade) ?? []; times.push(at); timesByGrade.set(grade, times);
          if (stateByGrade.get(grade) === 'OUT_OF_STOCK') activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'SOURCE_REPORTED_TRANSITION', observedAt: at, gradeSpecific: true, sourceTerminology: event.origin === 'bank' ? 'BANK_SIGNAL' : 'USER_REPORT' });
          stateByGrade.set(grade, 'IN_STOCK');
        }
      }
      for (const [grade, eventTimes] of timesByGrade) activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'RECENT_SIGNAL', eventTimes, gradeSpecific: true, sourceTerminology: 'USER_REPORT' });
      const queue = state.queue;
      if (queue) {
        const value = typeof queue === 'object' ? queue.size || queue.label || queue.level || queue.status || queue.value : queue;
        const vehicleCount = typeof queue === 'object' ? Number(queue.vehicle_count ?? queue.vehicleCount ?? queue.count) : undefined;
        const ordinal = /^(?:20_50|20-50)$/iu.test(String(value)) ? 'LONG' : /^(?:gt50|50\+|over_50)$/iu.test(String(value)) ? 'VERY_LONG' : value;
        queues.push({ stationId: id, value, ordinal, vehicleCount: Number.isFinite(vehicleCount) ? vehicleCount : undefined, present: true, observedAt: typeof queue === 'object' ? queue.at : undefined });
      }
    }
    const hasFreshness = observations.some(observation => observation.observedAt);
    const noFreshnessMetadata = observations.length > 0 && !hasFreshness;
    return { stations, observations, queues, activity, schemaChanged: stations.length === 0, partial: noFreshnessMetadata, code: noFreshnessMetadata ? 'NO_FRESHNESS_METADATA' : undefined, message: stations.length === 0 ? 'Benzonavt API exposed no coordinate-bearing stations' : noFreshnessMetadata ? 'Benzonavt API exposes no observation timestamps' : undefined, freshnessExpected: hasFreshness, naturalTermination: true, activityHistoryCoverage: detailRows.length ? detailsById.size / detailRows.length : 1 };
  } catch (error) { return { schemaChanged: true, message: 'Benzonavt stations API could not be read: ' + error.message }; }
})()`;
}
function stationsUrl(polygon) {
  const south = Math.min(...polygon.map((point) => point[1])), north = Math.max(...polygon.map((point) => point[1]));
  const west = Math.min(...polygon.map((point) => point[0])), east = Math.max(...polygon.map((point) => point[0]));
  return `https://benzonavt.ru/api/v1/stations?bbox=${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;
}
export {
  benzonavtExtractor,
  capability,
  collect,
  id
};
