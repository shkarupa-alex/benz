import { haversineMeters } from "./geometry.mjs";
import { isCurrentPositiveObservation } from "./evidence.mjs";
import { queueSortKey } from "./queue.mjs";

export function rankAssessments(assessments, referencePoint, now = new Date()) {
  return assessments.filter(a => ["AVAILABLE", "LIKELY_AVAILABLE"].includes(a.verdict)).sort((a, b) => compareKeys(rankKey(a, referencePoint, now), rankKey(b, referencePoint, now)));
}

export function rankKey(a, ref, now = new Date()) {
  const activity = a.activity?.some(x => x.kind === "TRANSACTIONS_RESUMED") ? 0 : a.activity?.some(x => x.kind === "TRANSACTIONS_ONGOING") ? 1 : 2;
  const currentPositive = (a.observations ?? []).filter(isCurrentPositiveObservation);
  const support = -(new Set(currentPositive.map(o => o.source)).size);
  const confidence = -({ HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }[a.confidence] ?? 0);
  const freshness = Math.min(...currentPositive.map(o => o.ageMinutes), Number.MAX_SAFE_INTEGER);
  const queue = queueSortKey(a.queue);
  const runAge = a.availabilityRun?.basis === "OBSERVED_TRANSITION" ? now.getTime() - new Date(a.availabilityRun.firstObservedAt).getTime() : Number.MAX_SAFE_INTEGER;
  const distance = ref ? haversineMeters(a.coordinate, ref) : 0;
  return [activity, support, confidence, freshness, ...queue, runAge, distance, a.stationKey];
}
function compareKeys(a, b) { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; }
