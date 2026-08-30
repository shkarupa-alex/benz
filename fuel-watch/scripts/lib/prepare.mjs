import { rankAssessments } from "./ranking.mjs";
import { updateAvailabilityRuns } from "./state.mjs";

export function prepareMonitoringSnapshot(state, snapshot, config) {
  const prepared = structuredClone(snapshot);
  const availabilityRuns = updateAvailabilityRuns(state.availabilityRuns, prepared.assessments, state.previous, prepared.fetchedAt);
  for (const assessment of prepared.assessments) assessment.availabilityRun = availabilityRuns.find(run => run.stationKey === assessment.stationKey && run.productKey === "AI95_UNION");
  prepared.rankedStationKeys = rankAssessments(prepared.assessments, prepared.rankingReferencePoint, new Date(prepared.fetchedAt)).map(item => item.stationKey);
  return { snapshot: prepared, availabilityRuns };
}
