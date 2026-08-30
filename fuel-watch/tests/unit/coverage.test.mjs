import test from "node:test";
import assert from "node:assert/strict";
import { enforceCompleteness, nextCoverageBaselines } from "../../scripts/collect.mjs";

test("failed completeness makes source partial and cannot update baseline", () => {
  const results=[{source:"gdebenz",health:{source:"gdebenz",status:"OK"},coverage:{stationCount:1,coordinateCoverage:1,duplicateRatio:0,fuelBlockCoverage:0,timestampCoverage:0,naturalTermination:true}}];
  const warnings=[];
  enforceCompleteness(results,undefined,"area","contract","2026-08-30T10:00:00Z",warnings);
  assert.equal(results[0].health.status,"PARTIAL");
  assert.equal(results[0].health.code,"COMPLETENESS_INVARIANT");
  assert.ok(warnings.some(value=>value.code==="COMPLETENESS_INVARIANT"));
  assert.deepEqual(nextCoverageBaselines(results,undefined,"area","contract","2026-08-30T10:00:00Z"),{});
});
