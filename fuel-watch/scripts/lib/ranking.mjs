import { haversineMeters } from "./geometry.mjs";
import { queueSortKey } from "./queue.mjs";

export function rankAssessments(assessments, referencePoint) {
  return assessments.filter(a => ["AVAILABLE", "LIKELY_AVAILABLE"].includes(a.verdict)).sort((a, b) => compareKeys(rankKey(a, referencePoint), rankKey(b, referencePoint)));
}

export function rankKey(a, ref) {
  const activity = a.activity?.some(x => x.kind === "TRANSACTIONS_RESUMED") ? 0 : a.activity?.some(x => x.kind === "TRANSACTIONS_ONGOING") ? 1 : 2;
  const support = -(new Set((a.observations ?? []).filter(o => ["IN_STOCK", "LIMITED"].includes(o.status)).map(o => o.source)).size);
  const confidence = -({ HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }[a.confidence] ?? 0);
  const freshness = Math.min(...(a.observations ?? []).map(o => o.ageMinutes ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  const queue = queueSortKey(a.queue);
  const runAge = a.availabilityRun?.basis === "OBSERVED_TRANSITION" ? -(Date.now() - new Date(a.availabilityRun.firstObservedAt).getTime()) : Number.MAX_SAFE_INTEGER;
  const distance = ref ? haversineMeters(a.coordinate, ref) : 0;
  return [activity, support, confidence, freshness, ...queue, runAge, distance, a.stationKey];
}
function compareKeys(a, b) { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; }
