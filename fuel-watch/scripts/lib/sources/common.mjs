import { classifyFuelLabel } from "../fuels.mjs";

export function okResult(source, raw, request, config) {
  const stations = (raw.stations ?? []).map(s => ({ source, sourceStationId: String(s.id ?? s.sourceStationId ?? syntheticId(s)), title: s.title, brand: s.brand, address: s.address, coordinate: normalizeCoordinate(s.coordinate ?? s.coordinates), provenanceUrl: s.url ?? raw.url ?? "" })).filter(s => validCoordinate(s.coordinate));
  const stationIds = new Set(stations.map(s => s.sourceStationId));
  const observations = (raw.observations ?? []).flatMap(o => {
    const sourceStationId = String(o.stationId ?? o.sourceStationId ?? "");
    const product = o.product ?? classifyFuelLabel(o.fuel ?? o.label ?? o.grade, request.requestedProducts);
    if (!sourceStationId || !stationIds.has(sourceStationId) || !product) return [];
    return [{ source, sourceStationId, product, status: normalizeStatus(o.status), time: normalizeTime(o), signalsPerHour: finite(o.signalsPerHour), rawStatus: String(o.status ?? "UNKNOWN"), conflict: o.conflict ? { raw: o.conflict } : undefined, fetchedAt: request.fetchedAt, provenanceUrl: o.url ?? stations.find(s => s.sourceStationId === sourceStationId)?.provenanceUrl ?? "" }];
  });
  const queues = (raw.queues ?? []).flatMap(q => {
    const sourceStationId = String(q.stationId ?? q.sourceStationId ?? "");
    if (!stationIds.has(sourceStationId)) return [];
    return [{ source, sourceStationId, time: normalizeTime(q), kind: normalizeQueueKind(q), vehicleCount: finite(q.vehicleCount), ordinal: normalizeOrdinal(q.ordinal ?? q.value), rawValue: String(q.rawValue ?? q.value ?? "") }];
  });
  const activity = (raw.activity ?? []).flatMap(a => {
    const sourceStationId = String(a.stationId ?? a.sourceStationId ?? "");
    if (!stationIds.has(sourceStationId)) return [];
    const product = a.product ?? (a.fuel ? classifyFuelLabel(a.fuel, request.requestedProducts) : undefined);
    return [{ source, sourceStationId, product, kind: a.kind ?? "RECENT_SIGNAL", eventTimes: Array.isArray(a.eventTimes) ? a.eventTimes : [], precedingGapMinutes: finite(a.precedingGapMinutes), gradeSpecific: Boolean(a.gradeSpecific ?? product), sourceTerminology: a.sourceTerminology ?? "SIGNAL" }];
  });
  const status = raw.partial ? "PARTIAL" : "OK";
  return { source, health: { source, status, code: raw.code, message: raw.message }, stations, observations, queues, activity };
}

export function healthResult(source, status, code, message) { return { source, health: { source, status, code, message }, stations: [], observations: [], queues: [], activity: [] }; }
export function errorResult(source, error) {
  const map = { CHALLENGE: "CHALLENGE", TIMEOUT: "TIMEOUT", RESOURCE_BLOCKED: "RESOURCE_BLOCKED", HTTP_ERROR_PAGE: "HTTP_ERROR", SCHEMA_CHANGED: "SCHEMA_CHANGED", EMPTY_RESULT: "PARTIAL", TRUNCATED: "PARTIAL" };
  return healthResult(source, map[error.code] ?? "PARTIAL", error.code ?? "INTERNAL_ADAPTER_ERROR", error.message);
}
function normalizeCoordinate(value) { if (!Array.isArray(value) || value.length < 2) return [NaN, NaN]; const a = Number(value[0]), b = Number(value[1]); return Math.abs(a) <= 90 && Math.abs(b) > 90 ? [b, a] : [a, b]; }
function validCoordinate(c) { return Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90; }
function syntheticId(s) { return `${s.title ?? "station"}:${(s.coordinate ?? []).join(",")}`; }
function normalizeStatus(value) { const text = String(value ?? "").toLowerCase(); if (/in.?stock|available|есть|налич/u.test(text)) return "IN_STOCK"; if (/limited|мало|заканч/u.test(text)) return "LIMITED"; if (/out.?of.?stock|нет|отсутств/u.test(text)) return "OUT_OF_STOCK"; if (/uncertain|сомнит|возможно/u.test(text)) return "UNCERTAIN"; return "UNKNOWN"; }
function normalizeTime(o) { if (o.observedAt || o.timestamp) { const value = new Date(o.observedAt ?? o.timestamp); if (Number.isFinite(value.getTime())) return { kind: "EXACT", observedAt: value.toISOString() }; } if (Number.isFinite(o.minMinutes) && Number.isFinite(o.maxMinutes)) return { kind: "BOUNDED_AGE", minMinutes: o.minMinutes, maxMinutes: o.maxMinutes }; return { kind: "UNKNOWN" }; }
function normalizeQueueKind(q) { if (Number.isFinite(q.vehicleCount)) return "VEHICLES"; if (normalizeOrdinal(q.ordinal ?? q.value)) return "ORDINAL"; if (q.present === true) return "PRESENCE"; return "TEXT"; }
function normalizeOrdinal(value) { const text = String(value ?? "").toLowerCase(); if (/very.?long|очень.*(длин|бол)/u.test(text)) return "VERY_LONG"; if (/long|больш|длин/u.test(text)) return "LONG"; if (/medium|сред/u.test(text)) return "MEDIUM"; if (/short|мал|корот/u.test(text)) return "SHORT"; if (/none|нет|без/u.test(text)) return "NONE"; return undefined; }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
