import { errorResult, healthResult, okResult } from "./common.mjs";

export const id = "benzonavt";
export const capability = "CURRENT_GRADE";

export async function collect(request, ctx) {
  try {
    const opened = await ctx.browser.open("https://benzonavt.ru/");
    if (/captcha|recaptcha|провер.{0,20}(робот|человек)/iu.test(`${opened.finalUrl} ${opened.pageTextPrefix}`)) return healthResult(id, "CHALLENGE", "CHALLENGE", "Benzonavt presented CAPTCHA/challenge; no bypass attempted");
    await ctx.browser.waitReady({ anyOfSelectors: ["#map", "[class*=map]", "script[src*=_next]"], urlRejectPatterns: ["captcha", "challenge"], timeoutMs: Math.min(20000, ctx.config.browser.adapterTimeoutMs) });
    const raw = await ctx.browser.evalJson(benzonavtExtractor(stationsUrl(request.area.polygon)));
    if (raw.challenge) return healthResult(id, "CHALLENGE", "CHALLENGE", "Benzonavt challenge detected; no bypass attempted");
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message);
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) { return errorResult(id, error); }
}

export function benzonavtExtractor(url) { return String.raw`(async () => {
  const body = document.body?.innerText || '';
  if (/recaptcha|captcha|подтвердите,? что вы не робот/iu.test(location.href + ' ' + body.slice(0,2000))) return { challenge: true };
  try {
    const response = await fetch(${JSON.stringify(url)}, { credentials: 'same-origin' });
    if (!response.ok) return { schemaChanged: true, message: 'Benzonavt stations API returned HTTP ' + response.status };
    const rows = await response.json();
    if (!Array.isArray(rows)) return { schemaChanged: true, message: 'Benzonavt stations API payload is not an array' };
    const stations = [], observations = [], queues = [];
    const familyProduct = { family: 'AI_95', variant: 'UNKNOWN', variantKey: 'FAMILY', displayLabel: 'АИ-95', specificity: 'FAMILY_ONLY', productKey: 'AI95_FAMILY' };
    for (const row of rows) {
      const id = String(row.id ?? '');
      if (!id || !Number.isFinite(Number(row.lon)) || !Number.isFinite(Number(row.lat))) continue;
      stations.push({ id, coordinate: [Number(row.lon), Number(row.lat)], title: row.name || row.brand, brand: row.brand, address: row.address, url: location.href });
      const state = row.st && typeof row.st === 'object' ? row.st : {};
      const updatedAt = state.updated_at;
      const unavailable = String(state.status || '').toLowerCase() === 'no';
      const currentFuels = Array.isArray(state.fuels_now) ? state.fuels_now.map(String) : [];
      const ai95 = currentFuels.filter(fuel => /^(?:аи[-\s]?|ai[-\s]?)?95\+?$/iu.test(fuel.trim()));
      if (unavailable) observations.push({ stationId: id, product: familyProduct, fuel: 'АИ-95', status: 'OUT_OF_STOCK', observedAt: updatedAt, familyAllUnavailable: true });
      else if (ai95.length) for (const fuel of ai95) observations.push({ stationId: id, fuel, status: 'IN_STOCK', observedAt: updatedAt });
      else observations.push({ stationId: id, product: familyProduct, fuel: 'АИ-95', status: 'UNKNOWN', observedAt: updatedAt });
      const queue = state.queue;
      if (queue) {
        const value = typeof queue === 'object' ? queue.label || queue.level || queue.status || queue.value : queue;
        const vehicleCount = typeof queue === 'object' ? Number(queue.vehicle_count ?? queue.vehicleCount ?? queue.count) : undefined;
        queues.push({ stationId: id, value, ordinal: value, vehicleCount: Number.isFinite(vehicleCount) ? vehicleCount : undefined, present: true, observedAt: updatedAt });
      }
    }
    const hasFreshness = observations.some(observation => observation.observedAt);
    const noFreshnessMetadata = observations.length > 0 && !hasFreshness;
    return { stations, observations, queues, activity: [], schemaChanged: stations.length === 0, partial: noFreshnessMetadata, code: noFreshnessMetadata ? 'NO_FRESHNESS_METADATA' : undefined, message: stations.length === 0 ? 'Benzonavt API exposed no coordinate-bearing stations' : noFreshnessMetadata ? 'Benzonavt API exposes no observation timestamps' : undefined, freshnessExpected: hasFreshness, naturalTermination: true };
  } catch (error) { return { schemaChanged: true, message: 'Benzonavt stations API could not be read: ' + error.message }; }
})()`; }

function stationsUrl(polygon) {
  const south = Math.min(...polygon.map(point => point[1])), north = Math.max(...polygon.map(point => point[1]));
  const west = Math.min(...polygon.map(point => point[0])), east = Math.max(...polygon.map(point => point[0]));
  return `https://benzonavt.ru/api/v1/stations?bbox=${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;
}
