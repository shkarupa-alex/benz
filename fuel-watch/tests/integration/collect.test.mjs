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

test("each enabled source uses a sequential isolated browser session", async () => {
  let active=0,maxActive=0,created=0,closed=0;
  const browserFactory=(config,sourceId)=>{
    const namespace=`fixture-${sourceId}-${created++}`;
    let opened=false;
    return {
      namespace,
      probe:async()=>({}),
      open:async url=>{
        if(!opened){opened=true;active++;maxActive=Math.max(maxActive,active);}
        if(url.includes("yandex"))return{finalUrl:url,pageTextPrefix:"limited"};
        if(url.includes("gdebenz"))return{finalUrl:url,pageTitle:"Error 502",pageTextPrefix:"502 - Bad Gateway"};
        return{finalUrl:"https://2gis.ru/captcha",pageTextPrefix:"captcha"};
      },
      waitReady:async()=>{},
      evalJson:async()=>({}),
      close:async()=>{if(opened){opened=false;active--;}closed++;return{sessionsRemaining:0,warnings:[]};}
    };
  };
  const result=await collectSnapshot({browserFactory,now:new Date("2026-08-30T10:00:00Z")});
  assert.equal(created,3);
  assert.equal(closed,3);
  assert.equal(maxActive,1);
  assert.equal(active,0);
  assert.equal(result.snapshot.runtime.browserNamespaces.length,3);
});

test("adapter-level network-control failure retries the source once degraded", async () => {
  let created=0;
  const browserFactory=(config,sourceId)=>{
    const attempt=created++;
    return{
      namespace:`retry-${attempt}`,
      networkControlsStatus:"PENDING",
      runtimeWarnings:[],
      probe:async()=>({}),
      open:async url=>{
        if(sourceId==="yandex")return{finalUrl:url,pageTextPrefix:"limited"};
        if(sourceId==="gdebenz" && attempt===1)throw Object.assign(new Error("Failed to install browser network controls: CDP error (Runtime.evaluate): Cannot find default execution context"),{code:"BROWSER_UNAVAILABLE"});
        if(sourceId==="gdebenz")return{finalUrl:url,pageTitle:"Error 502",pageTextPrefix:"502 - Bad Gateway"};
        return{finalUrl:"https://2gis.ru/captcha",pageTextPrefix:"captcha"};
      },
      waitReady:async()=>{},evalJson:async()=>({}),close:async()=>({sessionsRemaining:0,warnings:[]})
    };
  };
  const result=await collectSnapshot({browserFactory,now:new Date("2026-08-30T10:00:00Z")});
  assert.equal(created,4);
  assert.equal(result.snapshot.sourceHealth.find(value=>value.source==="gdebenz").code,"HTTP_ERROR_PAGE");
  assert.ok(result.snapshot.warnings.some(value=>value.code==="BROWSER_NETWORK_CONTROLS_DEGRADED" && value.message.startsWith("gdebenz:")));
});

test("all source runners and retries share one collection cleanup reserve", async () => {
  let created=0;
  let cleanupClock=0;
  const closes=[];
  const browserFactory=(config,sourceId)=>{
    const attempt=created++;
    return{
      namespace:`cleanup-${attempt}`,
      networkControlsStatus:"PENDING",
      runtimeWarnings:[],
      probe:async()=>({}),
      open:async url=>{
        if(sourceId==="yandex")return{finalUrl:url,pageTextPrefix:"limited"};
        if(sourceId==="gdebenz" && attempt===1)throw Object.assign(new Error("Failed to install browser network controls: CDP error (Runtime.evaluate): Cannot find default execution context"),{code:"BROWSER_UNAVAILABLE"});
        if(sourceId==="gdebenz")return{finalUrl:url,pageTitle:"Error 502",pageTextPrefix:"502 - Bad Gateway"};
        return{finalUrl:"https://2gis.ru/captcha",pageTextPrefix:"captcha"};
      },
      waitReady:async()=>{},
      evalJson:async()=>({}),
      close:async deadline=>{
        const startedAt=cleanupClock;
        const spent=Math.min(7000,Math.max(0,deadline-startedAt));
        cleanupClock+=spent;
        closes.push({startedAt,deadline,spent});
        return{sessionsRemaining:1,warnings:["fixture hung cleanup"]};
      }
    };
  };
  const result=await collectSnapshot({browserFactory,now:new Date("2026-08-30T10:00:00Z"),cleanupNow:()=>cleanupClock});
  const cleanup=result.snapshot.runtime.cleanup;
  assert.equal(created,4);
  assert.equal(closes.length,4);
  assert.ok(closes.every(value=>value.deadline===cleanup.budgetMs));
  assert.equal(cleanupClock,cleanup.budgetMs);
  assert.equal(cleanup.spentMs,cleanup.budgetMs);
  assert.equal(cleanup.remainingMs,0);
  assert.equal(closes.at(-1).spent,0);
  assert.equal(result.exitCode,75);
});

test("about-blank page loss never disables network controls", async () => {
  let created=0;
  const browserFactory=(config,sourceId)=>{
    const attempt=created++;
    return{
      namespace:`blank-${attempt}`,networkControlsStatus:"PENDING",runtimeWarnings:[],probe:async()=>({}),
      open:async url=>{
        if(sourceId==="yandex")return{finalUrl:url,pageTextPrefix:"limited"};
        if(sourceId==="gdebenz" && attempt===1)throw Object.assign(new Error("Browser page changed unexpectedly: expected https://gdebenz.ru/, got about:blank"),{code:"PAGE_LOST"});
        if(sourceId==="gdebenz")return{finalUrl:url,pageTitle:"Error 502",pageTextPrefix:"502 - Bad Gateway"};
        return{finalUrl:"https://2gis.ru/captcha",pageTextPrefix:"captcha"};
      },
      waitReady:async()=>{},evalJson:async()=>({}),close:async()=>({sessionsRemaining:0,warnings:[]})
    };
  };
  const result=await collectSnapshot({browserFactory,now:new Date("2026-08-30T10:00:00Z")});
  assert.equal(created,3);
  assert.equal(result.snapshot.sourceHealth.find(value=>value.source==="gdebenz").code,"PAGE_LOST");
  assert.equal(result.snapshot.warnings.some(value=>value.code==="BROWSER_NETWORK_CONTROLS_DEGRADED" && value.message.startsWith("gdebenz:")),false);
});
