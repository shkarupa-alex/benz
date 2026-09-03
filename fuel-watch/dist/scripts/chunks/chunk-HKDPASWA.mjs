import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  brandLabel
} from "./chunk-IVODUSOD.mjs";
import {
  classifyFuelLabel
} from "./chunk-XKTP5TT3.mjs";

// scripts/lib/sources/common.mjs
function okResult(source, raw, request, config, { capability = "CURRENT_GRADE", coordinateOrder = "LON_LAT" } = {}) {
  const enumerated = (raw.stations ?? []).map((s) => ({ source, sourceStationId: String(s.id ?? s.sourceStationId ?? syntheticId(s)), title: s.title, brand: brandLabel(s.brand) || void 0, address: s.address, coordinate: normalizeCoordinate(s.coordinate ?? s.coordinates, coordinateOrder), provenanceUrl: s.url ?? raw.url ?? "" }));
  const stations = enumerated.filter((s) => validCoordinate(s.coordinate));
  const stationIds = new Set(enumerated.map((s) => s.sourceStationId));
  const observations = (raw.observations ?? []).flatMap((o) => {
    const sourceStationId = String(o.stationId ?? o.sourceStationId ?? "");
    const classified = o.product ?? classifyFuelLabel(o.fuel ?? o.label ?? o.grade, request.requestedProducts);
    const product = capability === "CURRENT_FAMILY" && classified ? { family: "AI_95", variant: "UNKNOWN", variantKey: "FAMILY", displayLabel: classified.displayLabel, specificity: "FAMILY_ONLY", productKey: "AI95_FAMILY" } : capability === "CATALOG_ONLY" && classified ? { ...classified, specificity: "CATALOG_ONLY" } : classified;
    if (!sourceStationId || !stationIds.has(sourceStationId) || !product) return [];
    return [{ source, sourceStationId, product, status: normalizeStatus(o.normalizedStatus ?? o.status), time: normalizeTime(o), signalsPerHour: finite(o.signalsPerHour), familyAllUnavailable: o.familyAllUnavailable === true, rawStatus: String(o.status ?? "UNKNOWN"), conflict: o.conflict ? { raw: o.conflict } : void 0, fetchedAt: request.fetchedAt, provenanceUrl: o.url ?? enumerated.find((s) => s.sourceStationId === sourceStationId)?.provenanceUrl ?? "" }];
  });
  const queues = (raw.queues ?? []).flatMap((q) => {
    const sourceStationId = String(q.stationId ?? q.sourceStationId ?? "");
    if (!stationIds.has(sourceStationId)) return [];
    return [{ source, sourceStationId, time: normalizeTime(q), kind: normalizeQueueKind(q), vehicleCount: finite(q.vehicleCount), ordinal: normalizeOrdinal(q.ordinal ?? q.value), rawValue: String(q.rawValue ?? q.value ?? "") }];
  });
  const activity = (raw.activity ?? []).flatMap((a) => {
    const sourceStationId = String(a.stationId ?? a.sourceStationId ?? "");
    if (!stationIds.has(sourceStationId)) return [];
    const classified = a.product ?? (a.fuel ? classifyFuelLabel(a.fuel, request.requestedProducts) : void 0) ?? void 0;
    return [{ source, sourceStationId, product: classified, gradeLabel: String(a.gradeLabel ?? a.fuel ?? classified?.displayLabel ?? "").trim() || void 0, kind: a.kind ?? "RECENT_SIGNAL", status: a.status == null ? void 0 : normalizeStatus(a.status), eventTimes: Array.isArray(a.eventTimes) ? a.eventTimes : [], observedAt: iso(a.observedAt), latestEventAt: iso(a.latestEventAt), windowMinutes: finite(a.windowMinutes), count: finite(a.count), precedingGapMinutes: finite(a.precedingGapMinutes), gradeSpecific: Boolean(a.gradeSpecific ?? classified), sourceTerminology: a.sourceTerminology ?? "SIGNAL" }];
  });
  const unlocatedStationIds = enumerated.filter((s) => !validCoordinate(s.coordinate)).map((s) => s.sourceStationId);
  const historyUnavailable = finite(raw.activityHistoryCoverage) === 0;
  const partial = raw.partial || unlocatedStationIds.length > 0;
  const status = partial ? "PARTIAL" : "OK";
  const code = raw.code ?? (unlocatedStationIds.length ? "COORDINATE_COVERAGE" : historyUnavailable ? "ACTIVITY_HISTORY_UNAVAILABLE" : void 0);
  const message = raw.message ?? (unlocatedStationIds.length ? `${unlocatedStationIds.length} enumerated station(s) lacked valid coordinates` : historyUnavailable ? "Optional activity history could not be loaded; current status data was preserved" : void 0);
  const coverage = coverageMetrics(enumerated, observations, raw);
  return { source, health: { source, status, code, message }, stations, observations, queues, activity, coverage, enumeratedStationIds: enumerated.map((s) => s.sourceStationId), unlocatedStationIds };
}
function healthResult(source, status, code, message) {
  return { source, health: { source, status, code, message }, stations: [], observations: [], queues: [], activity: [] };
}
function detailTiming(config) {
  const adapterTimeoutMs = Number(config.browser.adapterTimeoutMs);
  return { requestTimeoutMs: Math.max(250, Math.min(3500, Math.floor(adapterTimeoutMs / 4))), budgetMs: Math.max(1e3, Math.min(1e4, Math.floor(adapterTimeoutMs / 2))) };
}
function errorResult(source, error) {
  const map = { CHALLENGE: "CHALLENGE", TIMEOUT: "TIMEOUT", RESOURCE_BLOCKED: "RESOURCE_BLOCKED", HTTP_ERROR_PAGE: "HTTP_ERROR", SCHEMA_CHANGED: "SCHEMA_CHANGED", EMPTY_RESULT: "PARTIAL", TRUNCATED: "PARTIAL", PAGE_LOST: "PARTIAL", BROWSER_UNAVAILABLE: "PARTIAL" };
  return healthResult(source, map[error.code] ?? "PARTIAL", error.code ?? "INTERNAL_ADAPTER_ERROR", error.message);
}
function normalizeCoordinate(value, order = "LON_LAT") {
  if (!Array.isArray(value) || value.length < 2) return [NaN, NaN];
  const a = coordinateNumber(value[0]), b = coordinateNumber(value[1]);
  return order === "LAT_LON" ? [b, a] : [a, b];
}
function validCoordinate(c) {
  return Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
}
function coordinateNumber(value) {
  return value == null || typeof value === "string" && !value.trim() ? NaN : Number(value);
}
function syntheticId(s) {
  return `${s.title ?? "station"}:${(s.coordinate ?? []).join(",")}`;
}
function normalizeStatus(value) {
  const text = String(value ?? "").normalize("NFKC").toLowerCase().replaceAll("\u0451", "\u0435").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text || /^(?:нет данных(?: о топливе)?|неизвестно|unknown|no data|n\/a)$/u.test(text)) return "UNKNOWN";
  if (/\b(?:unavailable|not\s+available|out[\s-]*of[\s-]*stock|sold\s+out)\b/u.test(text) || /(?:^|\s)(?:нет|не)\s+(?:в\s+)?налич(?:ии|ие)(?:\s|$)/u.test(text) || /(?:^|\s)нет\s+топлива(?:\s|$)/u.test(text) || new RegExp("(?:^|\\s)\u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\\p{L}*(?:\\s+\u0432\\s+\u043D\u0430\u043B\u0438\u0447\u0438\u0438)?(?:\\s|$)", "u").test(text) || /^нет$/u.test(text)) return "OUT_OF_STOCK";
  if (/\b(?:limited|low\s+stock)\b/u.test(text) || new RegExp("(?:^|\\s)(?:\u043C\u0430\u043B\u043E|\u0437\u0430\u043A\u0430\u043D\u0447\\p{L}*)(?:\\s|$)", "u").test(text)) return "LIMITED";
  if (/\b(?:in[\s-]*stock|available)\b/u.test(text) || /(?:^|\s)(?:есть(?:\s+топливо)?|в\s+наличии)(?:\s|$)/u.test(text)) return "IN_STOCK";
  if (/\buncertain\b/u.test(text) || /(?:сомнит|возможно)/u.test(text)) return "UNCERTAIN";
  return "UNKNOWN";
}
function normalizeTime(o) {
  if (o.observedAt || o.timestamp) {
    const value = new Date(o.observedAt ?? o.timestamp);
    if (Number.isFinite(value.getTime())) return { kind: "EXACT", observedAt: value.toISOString() };
  }
  if (Number.isFinite(o.minMinutes) && Number.isFinite(o.maxMinutes)) return { kind: "BOUNDED_AGE", minMinutes: o.minMinutes, maxMinutes: o.maxMinutes };
  return { kind: "UNKNOWN" };
}
function normalizeQueueKind(q) {
  if (Number.isFinite(q.vehicleCount)) return "VEHICLES";
  if (normalizeOrdinal(q.ordinal ?? q.value)) return "ORDINAL";
  if (q.present === true) return "PRESENCE";
  return "TEXT";
}
function normalizeOrdinal(value) {
  const text = String(value ?? "").toLowerCase();
  if (/very.?long|очень.*(длин|бол)/u.test(text)) return "VERY_LONG";
  if (/long|больш|длин/u.test(text)) return "LONG";
  if (/medium|сред/u.test(text)) return "MEDIUM";
  if (/short|мал|корот/u.test(text)) return "SHORT";
  if (/none|нет|без/u.test(text)) return "NONE";
  return void 0;
}
function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : void 0;
}
function iso(value) {
  if (!value) return void 0;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : void 0;
}
function coverageMetrics(stations, observations, raw) {
  const ids = stations.map((s) => s.sourceStationId);
  const unique = new Set(ids);
  const stationIdsWithFuel = new Set(observations.map((o) => o.sourceStationId));
  const timed = observations.filter((o) => o.time?.kind !== "UNKNOWN").length;
  return { stationCount: stations.length, coordinateCoverage: stations.length ? stations.filter((s) => validCoordinate(s.coordinate)).length / stations.length : 0, duplicateRatio: stations.length ? 1 - unique.size / stations.length : 0, fuelBlockCoverage: unique.size ? stationIdsWithFuel.size / unique.size : 0, timestampCoverage: observations.length ? timed / observations.length : 0, activityHistoryCoverage: finite(raw.activityHistoryCoverage), freshnessExpected: raw.freshnessExpected !== false, naturalTermination: raw.naturalTermination !== false };
}

export {
  okResult,
  healthResult,
  detailTiming,
  errorResult
};
