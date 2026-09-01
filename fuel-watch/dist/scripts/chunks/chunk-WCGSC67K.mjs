import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  ageMinutes,
  haversineMeters
} from "./chunk-GQHB3NSD.mjs";
import {
  petrolOctaneKey
} from "./chunk-XKTP5TT3.mjs";

// scripts/lib/queue.mjs
var ORDINAL_ORDER = { NONE: 0, SHORT: 1, MEDIUM: 2, LONG: 3, VERY_LONG: 4 };
function normalizeQueues(observations, now = /* @__PURE__ */ new Date()) {
  if (!observations?.length) return { comparable: false, displayText: "\u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445", observations: [] };
  const exact = observations.filter((o) => o.kind === "VEHICLES" && Number.isFinite(o.vehicleCount)).sort((a, b) => ageOf(a, now) - ageOf(b, now));
  if (exact.length) return { comparable: true, vehicleCount: exact[0].vehicleCount, displayText: `${exact[0].vehicleCount} \u0430\u0432\u0442.`, freshestAgeMinutes: ageOf(exact[0], now), observations };
  const ordinal = observations.filter((o) => o.kind === "ORDINAL" && o.ordinal).sort((a, b) => ageOf(a, now) - ageOf(b, now) || ORDINAL_ORDER[a.ordinal] - ORDINAL_ORDER[b.ordinal]);
  if (ordinal.length) return { comparable: true, ordinal: ordinal[0].ordinal, displayText: ordinalLabel(ordinal[0].ordinal), freshestAgeMinutes: ageOf(ordinal[0], now), observations };
  if (observations.some((o) => o.kind === "PRESENCE")) return { comparable: false, displayText: "\u043E\u0447\u0435\u0440\u0435\u0434\u044C \u0435\u0441\u0442\u044C, \u0440\u0430\u0437\u043C\u0435\u0440 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D", observations };
  return { comparable: false, displayText: observations[0].rawValue || "\u0440\u0430\u0437\u043C\u0435\u0440 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D", observations };
}
function queueSortKey(queue) {
  if (Number.isFinite(queue?.vehicleCount)) return [0, queue.vehicleCount];
  if (queue?.ordinal) return [1, ORDINAL_ORDER[queue.ordinal]];
  return [2, Number.MAX_SAFE_INTEGER];
}
function ageOf(observation, now) {
  return observation.time?.kind === "EXACT" ? Math.max(0, ageMinutes(observation.time.observedAt, now)) : Number.MAX_SAFE_INTEGER;
}
function ordinalLabel(value) {
  return { NONE: "\u043D\u0435\u0442", SHORT: "\u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F", MEDIUM: "\u0441\u0440\u0435\u0434\u043D\u044F\u044F", LONG: "\u0431\u043E\u043B\u044C\u0448\u0430\u044F", VERY_LONG: "\u043E\u0447\u0435\u043D\u044C \u0431\u043E\u043B\u044C\u0448\u0430\u044F" }[value] ?? value;
}

// scripts/lib/evidence.mjs
var POSITIVE = /* @__PURE__ */ new Set(["IN_STOCK", "LIMITED"]);
var CURRENT_SPECIFICITY = /* @__PURE__ */ new Set(["EXACT_VARIANT", "FAMILY_ONLY"]);
var DEFAULT_FUTURE_SKEW_SECONDS = 120;
var DEFAULT_EXPIRE_MINUTES = 360;
function isCurrentPositiveObservation(observation) {
  return POSITIVE.has(observation?.status) && CURRENT_SPECIFICITY.has(observation?.product?.specificity) && observation.expired === false && Number.isFinite(observation.ageMinutes);
}
function activityTimestampMs(value) {
  return new Date(value?.latestEventAt ?? value?.resumedAt ?? value?.observedAt).getTime();
}
function isFreshActivity(value, now = /* @__PURE__ */ new Date(), freshness = {}) {
  const eventMs = activityTimestampMs(value);
  const nowMs = new Date(now).getTime();
  const futureSkewMs = Number(freshness.futureSkewSeconds ?? DEFAULT_FUTURE_SKEW_SECONDS) * 1e3;
  const expireMs = Number(freshness.expireMinutes ?? DEFAULT_EXPIRE_MINUTES) * 6e4;
  return Number.isFinite(eventMs) && Number.isFinite(nowMs) && eventMs <= nowMs + futureSkewMs && nowMs - eventMs <= expireMs;
}

// scripts/lib/ranking.mjs
function rankAssessments(assessments, referencePoint, now = /* @__PURE__ */ new Date(), freshness) {
  return assessments.filter((a) => ["AVAILABLE", "LIKELY_AVAILABLE"].includes(a.verdict)).sort((a, b) => compareKeys(rankKey(a, referencePoint, now, freshness), rankKey(b, referencePoint, now, freshness)));
}
function rankKey(a, ref, now = /* @__PURE__ */ new Date(), freshness = {}) {
  const currentActivity = (a.activity ?? []).filter((value) => petrolOctaneKey(value) === "95" && isFreshActivity(value, now, freshness));
  const activity = currentActivity.some((x) => x.kind === "TRANSACTIONS_RESUMED") ? 0 : currentActivity.some((x) => x.kind === "TRANSACTIONS_ONGOING") ? 1 : 2;
  const currentPositive = (a.observations ?? []).filter(isCurrentPositiveObservation);
  const support = -new Set(currentPositive.map((o) => o.source)).size;
  const confidence = -({ HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }[a.confidence] ?? 0);
  const freshnessAge = Math.min(...currentPositive.map((o) => o.ageMinutes), Number.MAX_SAFE_INTEGER);
  const queue = queueSortKey(a.queue);
  const runAge = a.availabilityRun?.basis === "OBSERVED_TRANSITION" ? now.getTime() - new Date(a.availabilityRun.firstObservedAt).getTime() : Number.MAX_SAFE_INTEGER;
  const distance = ref ? haversineMeters(a.coordinate, ref) : 0;
  return [activity, support, confidence, freshnessAge, ...queue, runAge, distance, a.stationKey];
}
function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export {
  normalizeQueues,
  isCurrentPositiveObservation,
  activityTimestampMs,
  isFreshActivity,
  rankAssessments
};
