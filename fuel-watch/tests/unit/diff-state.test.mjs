import test from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots } from "../../scripts/lib/diff.mjs";
import { updateAvailabilityRuns } from "../../scripts/lib/state.mjs";

test("scope change suppresses station diffs", () => {
  assert.deepEqual(diffSnapshots({areaHash:"a",queryHash:"q",assessments:[]},{areaHash:"b",queryHash:"q",assessments:[]})[0].type, "SCOPE_CHANGED");
});

test("adapter contract change suppresses station diffs", () => {
  const previous={areaHash:"a",queryHash:"q",adapterContractHash:"old",assessments:[{stationKey:"s",verdict:"AVAILABLE",confidence:"MEDIUM"}]};
  const current={areaHash:"a",queryHash:"q",adapterContractHash:"new",assessments:[]};
  assert.deepEqual(diffSnapshots(previous,current).map(change=>change.type),["SCOPE_CHANGED"]);
});

test("availability run opens factual transition only after prior negative", () => {
  const previous = { fetchedAt: "2026-08-30T10:00:00Z", assessments: [{stationKey:"s",verdict:"NOT_AVAILABLE"}] };
  const runs = updateAvailabilityRuns([], [{stationKey:"s",verdict:"AVAILABLE",confidence:"MEDIUM"}], previous, "2026-08-30T10:15:00Z");
  assert.equal(runs[0].basis, "OBSERVED_TRANSITION");
  assert.deepEqual(runs[0].transitionWindow, { after: previous.fetchedAt, atOrBefore: "2026-08-30T10:15:00Z" });
});

test("one negative tick does not close established run", () => {
  const old = [{stationKey:"s",productKey:"AI95_UNION",state:"AVAILABLE",firstObservedAt:"2026-08-30T09:00:00Z",lastConfirmedAt:"2026-08-30T10:00:00Z"}];
  const runs = updateAvailabilityRuns(old, [{stationKey:"s",verdict:"NOT_AVAILABLE",confidence:"MEDIUM"}], {assessments:[]}, "2026-08-30T10:15:00Z");
  assert.equal(runs[0].state, "AVAILABLE");
});

test("low-confidence likely tick is retained as cautious first-seen", () => {
  const runs=updateAvailabilityRuns([], [{stationKey:"s",verdict:"LIKELY_AVAILABLE",confidence:"LOW"}], undefined, "2026-08-30T10:00:00Z");
  assert.equal(runs[0].basis,"FIRST_SEEN");
  assert.equal(runs[0].verdict,"LIKELY_AVAILABLE");
  assert.equal(runs[0].confidence,"LOW");
});

test("low-confidence likely tick after negative cannot open an observed transition", () => {
  const previous={fetchedAt:"2026-08-30T13:00:00Z",assessments:[{stationKey:"s",verdict:"NOT_AVAILABLE"}]};
  const runs=updateAvailabilityRuns([], [{stationKey:"s",verdict:"LIKELY_AVAILABLE",confidence:"LOW"}], previous, "2026-08-30T13:15:00Z");
  assert.equal(runs[0].basis,"FIRST_SEEN");
  assert.equal(runs[0].transitionWindow,undefined);
  assert.equal(runs[0].verdict,"LIKELY_AVAILABLE");
});
