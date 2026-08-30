const POSITIVE = new Set(["IN_STOCK", "LIMITED"]);
const CURRENT_SPECIFICITY = new Set(["EXACT_VARIANT", "FAMILY_ONLY"]);

export function isCurrentPositiveObservation(observation) {
  return POSITIVE.has(observation?.status)
    && CURRENT_SPECIFICITY.has(observation?.product?.specificity)
    && observation.expired === false
    && Number.isFinite(observation.ageMinutes);
}
