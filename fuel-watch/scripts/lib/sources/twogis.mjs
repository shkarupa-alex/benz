import { errorResult, healthResult, okResult } from "./common.mjs";

export const id = "2gis";
export const capability = "CURRENT_GRADE";

export async function collect(request, ctx) {
  try {
    const opened = await ctx.browser.open("https://2gis.ru/volgograd/search/%D0%90%D0%97%D0%A1");
    if (/\/captcha|\/museum|recaptcha|провер.{0,20}(робот|человек)/iu.test(`${opened.finalUrl} ${opened.pageTextPrefix}`)) return healthResult(id, "CHALLENGE", "CHALLENGE", "2GIS presented CAPTCHA/challenge; no bypass attempted");
    await ctx.browser.waitReady({ anyOfSelectors: ["[class*=searchResults]", "a[href*=firm]"], urlRejectPatterns: ["/captcha", "/museum", "recaptcha"], timeoutMs: Math.min(20000, ctx.config.browser.adapterTimeoutMs) });
    const raw = await ctx.browser.evalJson(twogisExtractor(request.area.polygon));
    if (raw.challenge) return healthResult(id, "CHALLENGE", "CHALLENGE", "2GIS challenge detected; no bypass attempted");
    if (raw.schemaChanged) return healthResult(id, "SCHEMA_CHANGED", "SCHEMA_CHANGED", raw.message);
    return okResult(id, { ...raw, url: opened.finalUrl }, request, ctx.config, { capability });
  } catch (error) { return errorResult(id, error); }
}
export function twogisExtractor(polygon) { return String.raw`(async () => {
  const body = document.body?.innerText || '';
  if (/recaptcha|captcha|подтвердите,? что вы не робот|museum/i.test(location.href + ' ' + body.slice(0,2000))) return { challenge: true };
  const stations = [], observations = [], queues = [], activity = [], seen = new Set();
  const brandName = brand => { if (brand == null) return undefined; if (['string','number'].includes(typeof brand)) return String(brand); if (Array.isArray(brand)) return [...new Set(brand.map(brandName).filter(Boolean))].join(' / ') || undefined; if (typeof brand !== 'object') return undefined; return brandName(brand.name ?? brand.alias ?? brand.title ?? brand.brand ?? (brand.id != null ? 'brand-id:' + brand.id : undefined)); };
  const consume = raw => { if (!raw || typeof raw !== 'object') return; const id=String(raw.id||raw.firmId||raw.orgId||''); const coordinate=raw.point ? [raw.point.lon||raw.point.lng,raw.point.lat] : raw.coordinates||raw.coordinate; if(id&&Array.isArray(coordinate)&&!seen.has(id)){seen.add(id);stations.push({id,coordinate,title:raw.name||raw.title,address:raw.address_name||raw.address,brand:brandName(raw.brand),url:raw.url||location.href});} const current=raw.currentFuelAvailability||raw.fuelAvailability; if(id&&current) for(const [fuel,v] of Object.entries(current)){const x=typeof v==='object'?v:{status:v};observations.push({stationId:id,fuel,status:x.status||x.available,observedAt:x.updatedAt});} };
  const walked=new WeakSet(); const walk=(v,d=0)=>{if(!v||typeof v!=='object'||d>8||walked.has(v))return;walked.add(v);consume(v);for(const x of Object.values(v))walk(x,d+1);};
  for(const key of Object.keys(window).filter(k=>/state|data|search|firm/i.test(k)).slice(0,100))try{walk(window[key]);}catch{}
  for(const script of document.scripts){const t=script.textContent||'';if(t.length>100&&t.length<10000000&&/(firm|address_name|fuelAvailability)/i.test(t))try{walk(JSON.parse(t));}catch{}}
  const liveUrl = performance.getEntriesByType('resource').map(entry => entry.name).reverse().find(url => /\/api\/v1\/stations\/by-ids\?ids=/i.test(url) && new URL(url).hostname === 'benzin.api.2gis.ru');
  let liveRows = [];
  if (liveUrl) try { const response = await fetch(liveUrl); if (response.ok) { const value = await response.json(); if (Array.isArray(value)) liveRows = value; } } catch {}
  const bounds = ${JSON.stringify(polygon ?? null)};
  const insideBounds = station => !Array.isArray(bounds) || !bounds.length || (Number(station?.lng) >= Math.min(...bounds.map(point => point[0])) && Number(station?.lng) <= Math.max(...bounds.map(point => point[0])) && Number(station?.lat) >= Math.min(...bounds.map(point => point[1])) && Number(station?.lat) <= Math.max(...bounds.map(point => point[1])));
  const isPetrol = value => /(?:^|[^0-9])(92|95|98|100)(?=$|[^0-9])/u.test(String(value || ''));
  const gradeOf = value => String(value || '').match(/(?:^|[^0-9])(92|95|98|100)(?=$|[^0-9])/u)?.[1];
  const mapLimit = async (values, limit, fn) => { const out = new Array(values.length); let cursor = 0; await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => { while (cursor < values.length) { const index = cursor++; try { out[index] = await fn(values[index]); } catch {} } })); return out; };
  const detailCandidates = liveRows.filter(row => row?.station?.id && insideBounds(row.station));
  const details = await mapLimit(detailCandidates, 6, async row => { const response = await fetch('https://benzin.api.2gis.ru/api/v1/stations/' + encodeURIComponent(row.station.id)); if (!response.ok) return; const detail = await response.json(); return detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : undefined; });
  const detailsById = new Map(details.filter(Boolean).map(detail => [String(detail.station?.id || ''), detail]));
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
      if (isPetrol(fuel.fuel_type)) activity.push({ stationId: id, fuel: fuel.fuel_type, gradeLabel: gradeOf(fuel.fuel_type), kind: 'PETROL_STATUS_SNAPSHOT', status: fuel.available === true ? 'IN_STOCK' : fuel.available === false ? 'OUT_OF_STOCK' : 'UNKNOWN', observedAt, gradeSpecific: true, sourceTerminology: 'STATUS' });
    }
    const queueLevel = row.queue_level || (row.fuel_statuses || []).find(fuel => fuel.queue_level && fuel.queue_level !== 'NONE')?.queue_level;
    if (queueLevel && queueLevel !== 'NONE') queues.push({ stationId: id, value: queueLevel, ordinal: queueLevel === 'OVER_50' ? 'VERY_LONG' : queueLevel === 'FROM_25_TO_50' ? 'LONG' : queueLevel === 'UP_TO_25' ? 'LONG' : undefined, present: true, observedAt: newest });
    const detail = detailsById.get(id);
    const reports = Array.isArray(detail?.recent_ugc_reports) ? [...detail.recent_ugc_reports].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : [];
    const knownGrades = [...new Set((row.fuel_statuses || []).map(fuel => gradeOf(fuel.fuel_type)).filter(Boolean))];
    const stateByGrade = new Map(knownGrades.map(grade => [grade, 'UNKNOWN']));
    const timesByGrade = new Map();
    for (const report of reports) {
      const at = new Date(report.created_at); if (!Number.isFinite(at.getTime())) continue;
      const grades = [...new Set((report.fuel_types || []).map(gradeOf).filter(Boolean))];
      if (report.available === false) for (const grade of (grades.length ? grades : knownGrades)) stateByGrade.set(grade, 'OUT_OF_STOCK');
      if (report.available === true) for (const grade of grades) {
        const eventTimes = timesByGrade.get(grade) ?? []; eventTimes.push(at.toISOString()); timesByGrade.set(grade, eventTimes);
        if (stateByGrade.get(grade) === 'OUT_OF_STOCK') activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'SOURCE_REPORTED_TRANSITION', observedAt: at.toISOString(), gradeSpecific: true, sourceTerminology: 'UGC_REPORT' });
        stateByGrade.set(grade, 'IN_STOCK');
      }
    }
    for (const [grade, eventTimes] of timesByGrade) activity.push({ stationId: id, fuel: grade, gradeLabel: grade, kind: 'RECENT_SIGNAL', eventTimes, gradeSpecific: true, sourceTerminology: 'UGC_REPORT' });
    const transactionTimes = (detail?.recent_transactions || []).map(value => new Date(value.created_at)).filter(value => Number.isFinite(value.getTime())).map(value => value.toISOString());
    if (transactionTimes.length) activity.push({ stationId: id, kind: 'RECENT_SIGNAL', eventTimes: transactionTimes, gradeSpecific: false, sourceTerminology: 'TRANSACTION' });
  }
  const liveAvailable = liveRows.length > 0;
  return {stations,observations,queues,activity,schemaChanged:stations.length===0,partial:!liveAvailable,code:liveAvailable?undefined:'CURRENT_DATA_UNAVAILABLE',message:stations.length===0?'2GIS exposed no recognizable coordinate-bearing station data':liveAvailable?undefined:'2GIS station catalogue loaded, but its current fuel response was not observable',freshnessExpected:liveAvailable,naturalTermination:true,activityHistoryCoverage:detailCandidates.length?detailsById.size/detailCandidates.length:0};
})()`; }
export const TWOGIS_EXTRACTOR = twogisExtractor();
