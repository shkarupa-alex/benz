import { classifyFuelLabel } from "../fuels.mjs";

export function okResult(source, raw, request, config, { capability = "CURRENT_GRADE", coordinateOrder = "LON_LAT" } = {}) {
  const enumerated = (raw.stations ?? []).map(s => ({ source, sourceStationId: String(s.id ?? s.sourceStationId ?? syntheticId(s)), title: s.title, brand: s.brand, address: s.address, coordinate: normalizeCoordinate(s.coordinate ?? s.coordinates, coordinateOrder), provenanceUrl: s.url ?? raw.url ?? "" }));
  const stations = enumerated.filter(s => validCoordinate(s.coordinate));
  const stationIds = new Set(enumerated.map(s => s.sourceStationId));
  const observations = (raw.observations ?? []).flatMap(o => {
    const sourceStationId = String(o.stationId ?? o.sourceStationId ?? "");
    const classified = o.product ?? classifyFuelLabel(o.fuel ?? o.label ?? o.grade, request.requestedProducts);
    const product = capability === "CURRENT_FAMILY" && classified ? { family: "AI_95", variant: "UNKNOWN", variantKey: "FAMILY", displayLabel: classified.displayLabel, specificity: "FAMILY_ONLY", productKey: "AI95_FAMILY" } : capability === "CATALOG_ONLY" && classified ? { ...classified, specificity: "CATALOG_ONLY" } : classified;
    if (!sourceStationId || !stationIds.has(sourceStationId) || !product) return [];
    return [{ source, sourceStationId, product, status: normalizeStatus(o.status), time: normalizeTime(o), signalsPerHour: finite(o.signalsPerHour), familyAllUnavailable: o.familyAllUnavailable === true, rawStatus: String(o.status ?? "UNKNOWN"), conflict: o.conflict ? { raw: o.conflict } : undefined, fetchedAt: request.fetchedAt, provenanceUrl: o.url ?? enumerated.find(s => s.sourceStationId === sourceStationId)?.provenanceUrl ?? "" }];
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
  const unlocatedStationIds = enumerated.filter(s => !validCoordinate(s.coordinate)).map(s => s.sourceStationId);
  const partial = raw.partial || unlocatedStationIds.length > 0;
  const status = partial ? "PARTIAL" : "OK";
  const code = raw.code ?? (unlocatedStationIds.length ? "COORDINATE_COVERAGE" : undefined);
  const message = raw.message ?? (unlocatedStationIds.length ? `${unlocatedStationIds.length} enumerated station(s) lacked valid coordinates` : undefined);
  const coverage = coverageMetrics(enumerated, observations, raw);
  return { source, health: { source, status, code, message }, stations, observations, queues, activity, coverage, enumeratedStationIds: enumerated.map(s => s.sourceStationId), unlocatedStationIds };
}

export function healthResult(source, status, code, message) { return { source, health: { source, status, code, message }, stations: [], observations: [], queues: [], activity: [] }; }
export function errorResult(source, error) {
  const map = { CHALLENGE: "CHALLENGE", TIMEOUT: "TIMEOUT", RESOURCE_BLOCKED: "RESOURCE_BLOCKED", HTTP_ERROR_PAGE: "HTTP_ERROR", SCHEMA_CHANGED: "SCHEMA_CHANGED", EMPTY_RESULT: "PARTIAL", TRUNCATED: "PARTIAL", PAGE_LOST: "PARTIAL", BROWSER_UNAVAILABLE: "PARTIAL" };
  return healthResult(source, map[error.code] ?? "PARTIAL", error.code ?? "INTERNAL_ADAPTER_ERROR", error.message);
}
export function normalizeCoordinate(value, order = "LON_LAT") { if (!Array.isArray(value) || value.length < 2) return [NaN, NaN]; const a = coordinateNumber(value[0]), b = coordinateNumber(value[1]); return order === "LAT_LON" ? [b, a] : [a, b]; }
export function validCoordinate(c) { return Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90; }
function coordinateNumber(value) { return value == null || (typeof value === "string" && !value.trim()) ? NaN : Number(value); }
function syntheticId(s) { return `${s.title ?? "station"}:${(s.coordinate ?? []).join(",")}`; }
export function normalizeStatus(value) {
  const text = String(value ?? "").normalize("NFKC").toLowerCase().replaceAll("ё", "е").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text || /^(?:нет данных(?: о топливе)?|неизвестно|unknown|no data|n\/a)$/u.test(text)) return "UNKNOWN";
  if (/\b(?:unavailable|not\s+available|out[\s-]*of[\s-]*stock|sold\s+out)\b/u.test(text) || /(?:^|\s)(?:нет|не)\s+(?:в\s+)?налич(?:ии|ие)(?:\s|$)/u.test(text) || /(?:^|\s)нет\s+топлива(?:\s|$)/u.test(text) || /(?:^|\s)отсутств\p{L}*(?:\s+в\s+наличии)?(?:\s|$)/u.test(text) || /^нет$/u.test(text)) return "OUT_OF_STOCK";
  if (/\b(?:limited|low\s+stock)\b/u.test(text) || /(?:^|\s)(?:мало|заканч\p{L}*)(?:\s|$)/u.test(text)) return "LIMITED";
  if (/\b(?:in[\s-]*stock|available)\b/u.test(text) || /(?:^|\s)(?:есть(?:\s+топливо)?|в\s+наличии)(?:\s|$)/u.test(text)) return "IN_STOCK";
  if (/\buncertain\b/u.test(text) || /(?:сомнит|возможно)/u.test(text)) return "UNCERTAIN";
  return "UNKNOWN";
}
function normalizeTime(o) { if (o.observedAt || o.timestamp) { const value = new Date(o.observedAt ?? o.timestamp); if (Number.isFinite(value.getTime())) return { kind: "EXACT", observedAt: value.toISOString() }; } if (Number.isFinite(o.minMinutes) && Number.isFinite(o.maxMinutes)) return { kind: "BOUNDED_AGE", minMinutes: o.minMinutes, maxMinutes: o.maxMinutes }; return { kind: "UNKNOWN" }; }
function normalizeQueueKind(q) { if (Number.isFinite(q.vehicleCount)) return "VEHICLES"; if (normalizeOrdinal(q.ordinal ?? q.value)) return "ORDINAL"; if (q.present === true) return "PRESENCE"; return "TEXT"; }
function normalizeOrdinal(value) { const text = String(value ?? "").toLowerCase(); if (/very.?long|очень.*(длин|бол)/u.test(text)) return "VERY_LONG"; if (/long|больш|длин/u.test(text)) return "LONG"; if (/medium|сред/u.test(text)) return "MEDIUM"; if (/short|мал|корот/u.test(text)) return "SHORT"; if (/none|нет|без/u.test(text)) return "NONE"; return undefined; }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function coverageMetrics(stations, observations, raw) {
  const ids = stations.map(s => s.sourceStationId);
  const unique = new Set(ids);
  const stationIdsWithFuel = new Set(observations.map(o => o.sourceStationId));
  const timed = observations.filter(o => o.time?.kind !== "UNKNOWN").length;
  return { stationCount: stations.length, coordinateCoverage: stations.length ? stations.filter(s => validCoordinate(s.coordinate)).length / stations.length : 0, duplicateRatio: stations.length ? 1 - unique.size / stations.length : 0, fuelBlockCoverage: unique.size ? stationIdsWithFuel.size / unique.size : 0, timestampCoverage: observations.length ? timed / observations.length : 0, naturalTermination: raw.naturalTermination !== false };
}
