import { ageMinutes } from "./util.mjs";

const ORDINAL_ORDER = { NONE: 0, SHORT: 1, MEDIUM: 2, LONG: 3, VERY_LONG: 4 };

export function normalizeQueues(observations, now = new Date()) {
  if (!observations?.length) return { comparable: false, displayText: "нет данных", observations: [] };
  const exact = observations.filter(o => o.kind === "VEHICLES" && Number.isFinite(o.vehicleCount)).sort((a, b) => ageOf(a, now) - ageOf(b, now));
  if (exact.length) return { comparable: true, vehicleCount: exact[0].vehicleCount, displayText: `${exact[0].vehicleCount} авт.`, freshestAgeMinutes: ageOf(exact[0], now), observations };
  const ordinal = observations.filter(o => o.kind === "ORDINAL" && o.ordinal).sort((a, b) => ageOf(a, now) - ageOf(b, now) || ORDINAL_ORDER[a.ordinal] - ORDINAL_ORDER[b.ordinal]);
  if (ordinal.length) return { comparable: true, ordinal: ordinal[0].ordinal, displayText: ordinalLabel(ordinal[0].ordinal), freshestAgeMinutes: ageOf(ordinal[0], now), observations };
  if (observations.some(o => o.kind === "PRESENCE")) return { comparable: false, displayText: "очередь есть, размер неизвестен", observations };
  return { comparable: false, displayText: observations[0].rawValue || "размер неизвестен", observations };
}

export function queueSortKey(queue) {
  if (Number.isFinite(queue?.vehicleCount)) return [0, queue.vehicleCount];
  if (queue?.ordinal) return [1, ORDINAL_ORDER[queue.ordinal]];
  return [2, Number.MAX_SAFE_INTEGER];
}
function ageOf(observation, now) { return observation.time?.kind === "EXACT" ? Math.max(0, ageMinutes(observation.time.observedAt, now)) : Number.MAX_SAFE_INTEGER; }
function ordinalLabel(value) { return ({ NONE: "нет", SHORT: "короткая", MEDIUM: "средняя", LONG: "большая", VERY_LONG: "очень большая" })[value] ?? value; }
