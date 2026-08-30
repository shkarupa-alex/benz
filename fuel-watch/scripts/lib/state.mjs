export function updateAvailabilityRuns(previousRuns = [], assessments, previousSnapshot, fetchedAt) {
  const runs = new Map(previousRuns.map(run => [`${run.stationKey}:${run.productKey}`, { ...run }]));
  const prior = new Map((previousSnapshot?.assessments ?? []).map(a => [a.stationKey, a]));
  for (const assessment of assessments) {
    const productKey = "AI95_UNION";
    const key = `${assessment.stationKey}:${productKey}`;
    const currentPositive = ["AVAILABLE", "LIKELY_AVAILABLE"].includes(assessment.verdict);
    const oldVerdict = prior.get(assessment.stationKey)?.verdict;
    const old = runs.get(key);
    if (currentPositive) {
      if (old?.state === "AVAILABLE") { old.lastConfirmedAt = fetchedAt; old.confidence = assessment.confidence; old.negativeTicks = 0; runs.set(key, old); }
      else {
        const mayOpenTransition = oldVerdict === "NOT_AVAILABLE" && (assessment.verdict === "AVAILABLE" || ["MEDIUM", "HIGH"].includes(assessment.confidence));
        runs.set(key, { stationKey: assessment.stationKey, productKey, state: "AVAILABLE", verdict: assessment.verdict, confidence: assessment.confidence, firstObservedAt: fetchedAt, lastConfirmedAt: fetchedAt, transitionWindow: mayOpenTransition ? { after: previousSnapshot.fetchedAt, atOrBefore: fetchedAt } : undefined, basis: mayOpenTransition ? "OBSERVED_TRANSITION" : "FIRST_SEEN", negativeTicks: 0 });
      }
    } else if (assessment.verdict === "NOT_AVAILABLE" && old?.state === "AVAILABLE") {
      old.negativeTicks = (old.negativeTicks ?? 0) + 1;
      if (old.negativeTicks >= 2) { old.state = "NOT_AVAILABLE"; old.lastConfirmedAt = fetchedAt; }
      runs.set(key, old);
    }
  }
  return [...runs.values()];
}
