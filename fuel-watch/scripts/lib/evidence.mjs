const POSITIVE = new Set(["IN_STOCK", "LIMITED"]);
const CURRENT_SPECIFICITY = new Set(["EXACT_VARIANT", "FAMILY_ONLY"]);
const DEFAULT_FUTURE_SKEW_SECONDS = 120;
const DEFAULT_EXPIRE_MINUTES = 360;

export function isCurrentPositiveObservation(observation) {
  return POSITIVE.has(observation?.status)
    && CURRENT_SPECIFICITY.has(observation?.product?.specificity)
    && observation.expired === false
    && Number.isFinite(observation.ageMinutes);
}

export function activityTimestampMs(value) {
  return new Date(value?.latestEventAt ?? value?.resumedAt ?? value?.observedAt).getTime();
}

export function isFreshActivity(value, now = new Date(), freshness = {}) {
  const eventMs = activityTimestampMs(value);
  const nowMs = new Date(now).getTime();
  const futureSkewMs = Number(freshness.futureSkewSeconds ?? DEFAULT_FUTURE_SKEW_SECONDS) * 1000;
  const expireMs = Number(freshness.expireMinutes ?? DEFAULT_EXPIRE_MINUTES) * 60000;
  return Number.isFinite(eventMs) && Number.isFinite(nowMs) && eventMs <= nowMs + futureSkewMs && nowMs - eventMs <= expireMs;
}
