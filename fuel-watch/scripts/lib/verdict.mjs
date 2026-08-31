import { ageMinutes } from "./util.mjs";

const POSITIVE = new Set(["IN_STOCK", "LIMITED"]);
const NEGATIVE = new Set(["OUT_OF_STOCK"]);

export function assessStation({ observations = [], activity = [], config, sourceGroups = {}, now = new Date() }) {
  const evidence = observations.map(o => enrich(o, config.freshness, now));
  const usable = evidence.filter(o => !o.expired && o.ageKind !== "UNKNOWN");
  const direct = usable.filter(o => o.product?.specificity === "EXACT_VARIANT");
  const positives = direct.filter(o => POSITIVE.has(o.status));
  const negatives = direct.filter(o => NEGATIVE.has(o.status));
  const conflict = hasFreshConflict(positives, negatives, config.freshness.conflictWindowMinutes);
  if (conflict) return result("CONFLICTING", "LOW", evidence, activity, "opposing fresh direct observations");
  const freshestPositive = newest(positives);
  const freshestNegative = newest(negatives);
  if (freshestPositive && (!freshestNegative || freshestPositive.observedMs > freshestNegative.observedMs)) {
    const confidence = positiveConfidence(positives, activity, sourceGroups, config);
    return result("AVAILABLE", confidence, evidence, activity, "fresh exact positive evidence");
  }
  const familyPositive = usable.find(o => POSITIVE.has(o.status) && o.product?.specificity === "FAMILY_ONLY");
  if (familyPositive) return result("LIKELY_AVAILABLE", "LOW", evidence, activity, "family-only positive evidence");
  const resumed = activity.some(a => a.kind === "TRANSACTIONS_RESUMED" && a.gradeSpecific);
  if (resumed) return result("LIKELY_AVAILABLE", "MEDIUM", evidence, activity, "grade-specific activity resumed");
  if (freshestNegative && (!freshestPositive || freshestNegative.observedMs > freshestPositive.observedMs)) return result("NOT_AVAILABLE", "MEDIUM", evidence, activity, "fresh exact negative evidence");
  if (usable.length) return result("INDIRECT", "LOW", evidence, activity, "indirect or uncertain evidence only");
  return result("NO_FRESH_DATA", "NONE", evidence, activity, "no usable current evidence");
}

export function assessUnion(productAssessments) {
  const values = Object.values(productAssessments);
  if (values.some(v => v.verdict === "AVAILABLE")) return strongest(values.filter(v => v.verdict === "AVAILABLE"));
  if (values.some(v => v.verdict === "LIKELY_AVAILABLE")) return strongest(values.filter(v => v.verdict === "LIKELY_AVAILABLE"));
  if (values.some(v => v.verdict === "CONFLICTING")) return strongest(values.filter(v => v.verdict === "CONFLICTING"));
  if (values.length && values.every(v => v.verdict === "NOT_AVAILABLE")) return { verdict: "NOT_AVAILABLE", confidence: weakest(values.map(v => v.confidence)) };
  return { verdict: "NO_FRESH_DATA", confidence: "NONE" };
}

export function assessRequestedUnion({ observations = [], activity = [], config, sourceGroups = {}, now = new Date() }) {
  const assessments = {};
  for (const product of config.requestedProducts.products) {
    const matching = observations.filter(o => o.product?.productKey === product.productKey);
    const matchingActivity = activity.filter(a => a.product?.productKey === product.productKey);
    assessments[product.productKey] = assessStation({ observations: matching, activity: matchingActivity, config, sourceGroups, now });
  }
  const unknown = observations.filter(o => o.product?.productKey === "AI95_UNKNOWN");
  if (unknown.length) assessments.AI95_UNKNOWN = assessStation({ observations: unknown, activity: activity.filter(a => a.product?.productKey === "AI95_UNKNOWN"), config, sourceGroups, now });
  const family = observations.filter(o => o.product?.specificity === "FAMILY_ONLY");
  const familyAssessment = family.length ? assessStation({ observations: family, activity: activity.filter(a => a.product?.family === "AI_95"), config, sourceGroups, now }) : null;
  const values = Object.values(assessments);
  let selected;
  const available = values.filter(v => v.verdict === "AVAILABLE");
  const likely = values.filter(v => v.verdict === "LIKELY_AVAILABLE");
  const conflicting = values.filter(v => v.verdict === "CONFLICTING");
  if (available.length) selected = strongest(available);
  else if (likely.length) selected = strongest(likely);
  else if (familyAssessment?.verdict === "LIKELY_AVAILABLE") selected = familyAssessment;
  else if (conflicting.length) selected = strongest(conflicting);
  else if (hasFreshFamilyAllNegative(family, config.freshness, now)) selected = { verdict: "NOT_AVAILABLE", confidence: "MEDIUM", reason: "source explicitly reports the whole AI-95 family unavailable" };
  else if (config.requestedProducts.products.every(p => assessments[p.productKey].verdict === "NOT_AVAILABLE")) selected = { verdict: "NOT_AVAILABLE", confidence: weakest(config.requestedProducts.products.map(p => assessments[p.productKey].confidence)), reason: "every configured AI-95 member has fresh direct negative evidence" };
  else if (values.some(v => v.verdict === "INDIRECT") || familyAssessment?.verdict === "INDIRECT") selected = { verdict: "INDIRECT", confidence: "LOW", reason: "indirect evidence only" };
  else selected = { verdict: "NO_FRESH_DATA", confidence: "NONE", reason: "configured union lacks complete fresh evidence" };
  const enriched = assessStation({ observations, activity, config, sourceGroups, now }).observations;
  return { ...selected, observations: enriched, activity, productAssessments: Object.fromEntries(Object.entries(assessments).map(([key, value]) => [key, compactAssessment(value)])) };
}

export function freshnessBand(observation, freshness, now = new Date()) { return enrich(observation, freshness, now).band; }

function enrich(observation, freshness, now) {
  if (observation.time?.kind === "BOUNDED_AGE") {
    const min = Number(observation.time.minMinutes), max = Number(observation.time.maxMinutes);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return { ...observation, ageKind: "INVALID", ageMinutes: null, band: "invalid", expired: true, observedMs: -Infinity };
    const band = bandForAge(max, freshness);
    return { ...observation, ageKind: "BOUNDED_AGE", ageMinutes: max, ageRangeMinutes: [min, max], approximate: true, band, expired: max > freshness.expireMinutes, observedMs: now.getTime() - max * 60000 };
  }
  if (observation.time?.kind !== "EXACT") return { ...observation, ageKind: observation.time?.kind ?? "UNKNOWN", ageMinutes: null, band: "unknown", expired: true, observedMs: -Infinity };
  const ms = new Date(observation.time.observedAt).getTime();
  if (!Number.isFinite(ms) || ms - now.getTime() > freshness.futureSkewSeconds * 1000) return { ...observation, ageKind: "INVALID", ageMinutes: null, band: "invalid", expired: true, observedMs: -Infinity };
  const age = Math.max(0, ageMinutes(observation.time.observedAt, now));
  const band = bandForAge(age, freshness);
  return { ...observation, ageKind: "EXACT", ageMinutes: age, band, expired: age > freshness.expireMinutes, observedMs: ms };
}
function hasFreshConflict(positives, negatives, windowMinutes) {
  return positives.some(p => p.band === "fresh" && negatives.some(n => n.band === "fresh" && Math.abs(p.observedMs - n.observedMs) <= windowMinutes * 60000));
}
function positiveConfidence(positives, activity, groups, config) {
  const fresh = positives.filter(o => o.band === "fresh");
  const provenance = new Set(fresh.map(o => groups[o.source] ?? o.source));
  if (provenance.size >= 2) return "HIGH";
  if (fresh.some(o => (o.signalsPerHour ?? 0) >= config.activity.strongSignalCountPerHour)) return "HIGH";
  if (fresh.length || activity.some(a => a.kind === "TRANSACTIONS_RESUMED" && a.gradeSpecific)) return "MEDIUM";
  return "LOW";
}
function newest(values) { return [...values].sort((a, b) => b.observedMs - a.observedMs)[0]; }
function result(verdict, confidence, observations, activity, reason) { return { verdict, confidence, observations, activity, reason }; }
function strongest(values) { return [...values].sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))[0]; }
function weakest(values) { return [...values].sort((a, b) => confidenceRank(a) - confidenceRank(b))[0] ?? "NONE"; }
function confidenceRank(v) { return ({ NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 })[v] ?? 0; }
function bandForAge(age, freshness) { return age <= freshness.freshMinutes ? "fresh" : age <= freshness.recentMinutes ? "recent" : age <= freshness.staleMinutes ? "stale" : "expired"; }
function hasFreshFamilyAllNegative(observations, freshness, now) { return observations.some(o => o.familyAllUnavailable === true && o.status === "OUT_OF_STOCK" && !enrich(o, freshness, now).expired); }
function compactAssessment(value) {
  const usable = value.observations.filter(o => !o.expired);
  const ages = usable.map(o => o.ageMinutes).filter(Number.isFinite);
  return { verdict: value.verdict, confidence: value.confidence, reason: value.reason, freshestAgeMinutes: ages.length ? Math.min(...ages) : null, approximate: usable.some(o => o.approximate), supportingSources: [...new Set(usable.map(o => o.source))] };
}
