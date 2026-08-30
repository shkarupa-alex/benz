import test from "node:test";
import assert from "node:assert/strict";
import { collectSnapshot } from "../../scripts/collect.mjs";

test("all-source degradation is not rendered as no fuel and cleanup failure returns 75", async () => {
  const runner = {
    namespace: "fixture-owned",
    probe: async () => ({}),
    open: async url => url.includes("yandex") ? {finalUrl:url,pageTextPrefix:"limited"} : url.includes("gdebenz") ? {finalUrl:url,pageTextPrefix:"502 Bad Gateway"} : {finalUrl:"https://2gis.ru/captcha",pageTextPrefix:"captcha"},
    waitReady: async () => {},
    evalJson: async () => ({stations:[],observations:[],queues:[],activity:[],schemaChanged:true}),
    close: async () => ({sessionsRemaining:1,warnings:["fixture cleanup failure"]})
  };
  const result = await collectSnapshot({browserFactory:()=>runner,now:new Date("2026-08-30T10:00:00Z")});
  assert.equal(result.exitCode,75);
  assert.equal(result.snapshot.assessments.length,0);
  assert.ok(result.snapshot.sourceHealth.every(h=>h.status!=="OK"));
  assert.ok(result.snapshot.warnings.some(w=>w.code==="CLEANUP_FAILED"));
  assert.equal(result.snapshot.runtime.browserMode,"HEADED");
});

test("shared browser failure is reported once as common-mode failure", async () => {
  const runner = { namespace:"fixture", probe:async()=>{throw Object.assign(new Error("missing runtime"),{code:"BROWSER_UNAVAILABLE"});}, close:async()=>({sessionsRemaining:0,warnings:[]}) };
  const result = await collectSnapshot({browserFactory:()=>runner,now:new Date("2026-08-30T10:00:00Z")});
  assert.equal(result.snapshot.runtime.health.status,"BROWSER_UNAVAILABLE");
  assert.ok(result.snapshot.sourceHealth.filter(h=>h.status!=="DISABLED").every(h=>h.code==="NOT_ATTEMPTED"));
  assert.ok(result.snapshot.sourceHealth.every(h=>h.status!=="TIMEOUT"));
});
