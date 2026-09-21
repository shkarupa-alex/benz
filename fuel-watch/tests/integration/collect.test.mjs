import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { challengeHandoverPolicy, collectSnapshot, reapGraceMs, stationCatalogue } from "../../scripts/collect.mjs";
import { BrowserRunner } from "../../scripts/lib/browser-runner.mjs";
import { loadConfig } from "../../scripts/lib/config.mjs";

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
  assert.equal(created,4);
  assert.equal(closed,4);
  assert.equal(maxActive,1);
  assert.equal(active,0);
  assert.equal(result.snapshot.runtime.browserNamespaces.length,4);
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
  assert.equal(created,5);
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
  assert.equal(created,5);
  assert.equal(closes.length,5);
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
  assert.equal(created,4);
  assert.equal(result.snapshot.sourceHealth.find(value=>value.source==="gdebenz").code,"PAGE_LOST");
  assert.equal(result.snapshot.warnings.some(value=>value.code==="BROWSER_NETWORK_CONTROLS_DEGRADED" && value.message.startsWith("gdebenz:")),false);
});

test("one collapsing source never stops the others and stays named in source health", async () => {
  const station = source => ({ id: `${source}-1`, coordinate: [44.4825478, 48.7042007], title: "Лукойл", address: "Череповецкая ул., 5А" });
  const payload = source => ({
    stations: [station(source)],
    observations: [{ stationId: `${source}-1`, fuel: "АИ-95", status: "IN_STOCK", observedAt: "2026-08-30T09:50:00Z" }],
    queues: [], activity: [], schemaChanged: false, naturalTermination: true
  });
  const browserFactory = (config, sourceId) => ({
    namespace: `fixture-${sourceId}`,
    probe: async () => ({}),
    open: async url => {
      if (sourceId === "yandex") throw Object.assign(new Error("daemon connection lost"), { code: "BROWSER_UNAVAILABLE" });
      if (sourceId === "2gis") return { finalUrl: "https://2gis.ru/captcha", pageTextPrefix: "captcha" };
      return { finalUrl: url, pageTextPrefix: "станции" };
    },
    waitReady: async () => {},
    useRealisticUserAgent: async () => false,
    evalJson: async expression => expression.includes("window.scrollBy") ? true : payload(sourceId),
    close: async () => ({ sessionsRemaining: 0, warnings: [] })
  });
  const result = await collectSnapshot({ browserFactory, now: new Date("2026-08-30T10:00:00Z") });
  const health = Object.fromEntries(result.snapshot.sourceHealth.map(h => [h.source, h]));
  assert.equal(health.yandex.status, "PARTIAL");
  assert.equal(health.yandex.code, "BROWSER_UNAVAILABLE");
  assert.equal(health["2gis"].status, "CHALLENGE");
  assert.equal(health.gdebenz.status, "OK");
  assert.equal(health.benzonavt.status, "OK");
  assert.ok(result.snapshot.assessments.length > 0);
  assert.equal(result.exitCode, 0);
  const contributing = result.snapshot.assessments.flatMap(a => a.observations.map(o => o.source));
  assert.deepEqual([...new Set(contributing)].sort(), ["benzonavt", "gdebenz"]);
  assert.equal(result.snapshot.sourceCoverage.yandex, undefined);
  assert.equal(result.snapshot.sourceCoverage["2gis"], undefined);
});

// A one-off zone is for a single run: it resolves its own area and refuses to exceed the ceiling it declares.
test("a one-off area overrides the configured zone without touching it and enforces its station ceiling", async () => {
  const runner = {
    namespace: "fixture-oneoff",
    probe: async () => ({}),
    open: async url => ({ finalUrl: url, pageTextPrefix: "АЗС" }),
    waitReady: async () => {},
    evalJson: async () => ({ stations: [{ id: "a", coordinate: [44.49, 48.72], title: "АЗС A", address: "ул. Первая, 1" }, { id: "b", coordinate: [44.60, 48.80], title: "АЗС B", address: "ул. Вторая, 2" }], observations: [], queues: [], activity: [] }),
    close: async () => ({ sessionsRemaining: 0, warnings: [] })
  };
  const corridor = { kind: "route-corridor", label: "Разовый коридор", waypoints: [[44.49, 48.72], [44.60, 48.80]], corridorWidthMeters: 2000 };
  const result = await collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z"), areaOverride: corridor });
  assert.equal(result.snapshot.areaLabel, "Разовый коридор");
  assert.equal(result.snapshot.assessments.length, 2);
  const configured = await collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z") });
  assert.equal(configured.snapshot.areaLabel, "Волгоград — настроенная зона");
  assert.notEqual(configured.snapshot.areaHash, result.snapshot.areaHash);
  await assert.rejects(() => collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z"), areaOverride: { ...corridor, maxStationCount: 1 } }), error => error.code === "AREA_STATION_LIMIT");
});

// The skill must never solve or bypass a challenge; the only sanctioned behaviour is holding a visible window open.
test("challenge handover is off by default and never touches the page when it is on", async () => {
  const config = await loadConfig();
  let challengeSolved = false, retries = 0;
  const makeRunner = () => ({
    namespace: "fixture-challenge", sessionName: "source",
    probe: async () => ({}),
    open: async url => { retries++; return { finalUrl: challengeSolved ? url : "https://2gis.ru/captcha", pageTextPrefix: challengeSolved ? "АЗС" : "captcha" }; },
    waitReady: async () => {},
    evalJson: async () => ({ stations: [], observations: [], queues: [], activity: [], schemaChanged: true }),
    awaitManualChallengeResolution: async () => { challengeSolved = true; return "CLEARED"; },
    close: async () => ({ sessionsRemaining: 0, warnings: [] })
  });

  const off = await collectSnapshot({ configPath: undefined, browserFactory: () => makeRunner(), now: new Date("2026-09-21T10:00:00Z") });
  assert.deepEqual(off.snapshot.runtime.challengeHandovers, []);

  const dir = await mkdtemp(join(tmpdir(), "fuel-handover-"));
  const configPath = join(dir, "config.json");
  config.browser.configPath = "agent-browser.json";
  config.browser.challengeHandover = { enabled: true, waitSeconds: 10, pollSeconds: 2, maxPerRun: 1 };
  await writeFile(configPath, JSON.stringify(config));
  await cp(new URL("../../config/agent-browser.json", import.meta.url), join(dir, "agent-browser.json"));
  challengeSolved = false;
  const on = await collectSnapshot({ configPath, browserFactory: () => makeRunner(), now: new Date("2026-09-21T10:00:00Z") });
  const records = on.snapshot.runtime.challengeHandovers;
  assert.equal(records.length, 1, "maxPerRun must cap handovers at one per run");
  assert.equal(records[0].outcome, "CLEARED");
  assert.equal(records[0].waitSeconds, 10);
  await rm(dir, { recursive: true, force: true });
});

// CLEARED says the challenge page is gone, not that a person made it go; an unobservable one must not be claimed.
test("a handover we could not observe is reported as such and does not spend the per-run budget", async () => {
  const records = [];
  const config = { browser: { headed: true, challengeHandover: { enabled: true, waitSeconds: 10, pollSeconds: 2, maxPerRun: 1 } } };
  const policy = challengeHandoverPolicy(config, records);
  const runner = outcome => ({ namespace: "ns", sessionName: "source", expectedUrl: "https://2gis.ru/", awaitManualChallengeResolution: async () => outcome });
  assert.equal(await policy.hold("2gis", runner("NOT_OBSERVABLE")), false);
  assert.equal(await policy.hold("2gis", runner("UNREADABLE")), false);
  assert.equal(policy.mayOffer(), true, "an unobservable challenge must not consume maxPerRun");
  assert.deepEqual(records.map(value => value.outcome), ["NOT_OBSERVABLE", "UNREADABLE"]);
  assert.ok(records.every(value => !("resolved" in value)), "no field may imply a human acted");
  assert.equal(await policy.hold("2gis", runner("TIMED_OUT")), false);
  assert.equal(policy.mayOffer(), false, "a held-but-unsolved handover does consume maxPerRun");
});

// A headless run has no window to hand over, so the offer must never be made there whatever the config says.
test("challenge handover is refused without a visible window", () => {
  const withHeaded = headed => challengeHandoverPolicy({ browser: { headed, challengeHandover: { enabled: true, waitSeconds: 10, pollSeconds: 2, maxPerRun: 1 } } }, []);
  assert.equal(withHeaded(true).mayOffer(), true);
  assert.equal(withHeaded(false).mayOffer(), false);
  assert.equal(challengeHandoverPolicy({ browser: { headed: true } }, []).mayOffer(), false);
});

// The catalogue is a union across only the members that publish one, and absent stays unknown rather than negative.
test("collect merges the grade catalogue and litre limits across the sources of one station", async () => {
  const members = [
    { source: "2gis", sourceStationId: "a", assortment: ["92", "95"], limits: [{ gradeLabel: "AI_95", liters: 40 }] },
    { source: "benzonavt", sourceStationId: "b", assortment: ["95", "98"], limits: [{ gradeLabel: "95", liters: 20 }] },
    { source: "yandex", sourceStationId: "c" }
  ];
  const merged = stationCatalogue(members, ["95"]);
  assert.deepEqual(merged.assortment, ["92", "95", "98"]);
  assert.equal(merged.sellsRequestedFamily, true);
  assert.deepEqual(merged.limits.map(limit => [limit.source, limit.liters]), [["2gis", 40], ["benzonavt", 20]]);

  const dieselOnly = stationCatalogue([{ source: "2gis", sourceStationId: "a", assortment: [] }], ["95"]);
  assert.deepEqual(dieselOnly.assortment, []);
  assert.equal(dieselOnly.sellsRequestedFamily, false, "a published catalogue without AI-95 means the station does not sell it");

  const unknown = stationCatalogue([{ source: "yandex", sourceStationId: "c" }], ["95"]);
  assert.equal(unknown.assortment, undefined);
  assert.equal(unknown.sellsRequestedFamily, undefined, "no published catalogue must stay unknown, never negative");
  assert.equal(unknown.limits, undefined);
});

// A one-off zone must not inherit the standing zone's anchor exemptions, which bypass the polygon test entirely.
test("a one-off area does not admit stations exempted by the configured zone's anchors", async () => {
  const runner = {
    namespace: "fixture-anchor", probe: async () => ({}),
    open: async url => ({ finalUrl: url, pageTextPrefix: "АЗС" }), waitReady: async () => {},
    evalJson: async () => ({ stations: [{ id: "far", coordinate: [44.20, 48.50], title: "АЗС", address: "Череповецкая ул., 5А" }, { id: "near", coordinate: [44.50, 48.74], title: "АЗС", address: "ул. Рядом, 1" }], observations: [], queues: [], activity: [] }),
    close: async () => ({ sessionsRemaining: 0, warnings: [] })
  };
  const corridor = { kind: "route-corridor", label: "Разовый коридор", waypoints: [[44.49, 48.72], [44.60, 48.80]], corridorWidthMeters: 4000 };
  const oneOff = await collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z"), areaOverride: corridor });
  assert.deepEqual(oneOff.snapshot.assessments.map(a => a.address), ["ул. Рядом, 1"], "the configured zone's anchor label must not exempt a station 30 km outside the corridor");
  const configured = await collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z") });
  assert.ok(configured.snapshot.assessments.some(a => a.address === "Череповецкая ул., 5А"), "the configured zone still exempts its own anchors");
});

// Waiting is read-only by construction: the runner may look at the page, never type, click or submit on it.
test("waiting for a human to clear a challenge only reads the page and gives up on its own budget", async () => {
  const config = await loadConfig();
  const commands = [];
  let cleared = false;
  const exec = async (command, args) => {
    commands.push(args);
    if (args.includes("url")) return { exitCode: 0, stdout: JSON.stringify({ data: { url: cleared ? "https://2gis.ru/volgograd" : "https://2gis.ru/captcha" } }), stderr: "" };
    if (args.includes("eval")) { cleared = true; return { exitCode: 0, stdout: JSON.stringify({ data: { pageTitle: "2GIS", pageText: "АЗС", selectorReady: true } }), stderr: "" }; }
    return { exitCode: 0, stdout: JSON.stringify({ data: { sessions: [] } }), stderr: "" };
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  assert.equal(await runner.awaitManualChallengeResolution({ waitMs: 3000, pollMs: 100 }), "CLEARED");
  assert.ok(commands.every(args => !args.some(value => ["click", "type", "fill", "press", "submit", "solve"].includes(value))), "the wait must never act on the page");

  const stuck = new BrowserRunner(config, { exec: async (command, args) => args.includes("url") ? { exitCode: 0, stdout: JSON.stringify({ data: { url: "https://2gis.ru/captcha" } }), stderr: "" } : { exitCode: 0, stdout: JSON.stringify({ data: { pageTitle: "", pageText: "captcha", selectorReady: false } }), stderr: "" }, command: process.execPath });
  assert.equal(await stuck.awaitManualChallengeResolution({ waitMs: 300, pollMs: 100 }), "TIMED_OUT");
});

// An adapter can flag a challenge from the page's own data; with no visible marker we must not claim it cleared.
test("an unobservable challenge is never reported as cleared after a blind pause", async () => {
  const config = await loadConfig();
  const page = (url, text) => async (command, args) => ({ exitCode: 0, stdout: JSON.stringify({ data: args.includes("url") ? { url } : { pageTitle: "", pageText: text, selectorReady: true } }), stderr: "" });
  const invisible = new BrowserRunner(config, { exec: page("https://benzonavt.ru/", "Бензонавт"), command: process.execPath });
  const startedAt = Date.now();
  assert.equal(await invisible.awaitManualChallengeResolution({ waitMs: 5000, pollMs: 100 }), "NOT_OBSERVABLE");
  assert.ok(Date.now() - startedAt < 1000, "an unobservable challenge must return at once rather than waiting out the budget");

  // 2GIS answers automation with its "robot museum" landing page, which the adapters treat as a challenge.
  const museum = new BrowserRunner(config, { exec: page("https://2gis.ru/museum", "Вы попали в музей роботов"), command: process.execPath });
  assert.equal(await museum.awaitManualChallengeResolution({ waitMs: 250, pollMs: 100 }), "TIMED_OUT");

  const broken = new BrowserRunner(config, { exec: async () => ({ exitCode: 1, stdout: "", stderr: "session gone" }), command: process.execPath });
  assert.equal(await broken.awaitManualChallengeResolution({ waitMs: 250, pollMs: 100 }), "UNREADABLE");
});

// The ceiling must measure the zone, not the sources: gdebenz searches a radius and 2GIS answers city-wide.
test("the one-off station ceiling counts only stations inside the zone", async () => {
  const runner = {
    namespace: "fixture-ceiling", probe: async () => ({}),
    open: async url => ({ finalUrl: url, pageTextPrefix: "АЗС" }), waitReady: async () => {},
    evalJson: async () => ({ stations: [{ id: "in", coordinate: [44.50, 48.74], title: "АЗС", address: "ул. Внутри, 1" }, ...Array.from({ length: 30 }, (value, index) => ({ id: `out-${index}`, coordinate: [44.00 + index * 0.01, 48.20], title: "АЗС", address: `ул. Снаружи, ${index}` }))], observations: [], queues: [], activity: [] }),
    close: async () => ({ sessionsRemaining: 0, warnings: [] })
  };
  const corridor = { kind: "route-corridor", label: "Коридор", waypoints: [[44.49, 48.72], [44.60, 48.80]], corridorWidthMeters: 4000, maxStationCount: 5 };
  const result = await collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z"), areaOverride: corridor });
  assert.equal(result.snapshot.assessments.length, 1, "31 enumerated stations, one inside the corridor, ceiling of 5");
  await assert.rejects(() => collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z"), areaOverride: { ...corridor, maxStationCount: 0.5 } }), error => error.code === "AREA_STATION_LIMIT");
});

// stationCatalogue is only useful if the snapshot actually carries it: a unit test of the helper cannot tell whether
// collect still calls it, and the catalogue is what keeps "never sells AI-95" apart from "AI-95 ran out here".
test("the grade catalogue and litre limits reach the snapshot through a full collection", async () => {
  const station = { id: "s1", coordinate: [44.50, 48.74], title: "АЗС A", address: "ул. Первая, 1" };
  const runner = {
    namespace: "fixture-catalogue", probe: async () => ({}),
    open: async url => ({ finalUrl: url, pageTextPrefix: "АЗС" }), waitReady: async () => {},
    evalJson: async () => ({
      stations: [{ ...station, assortment: ["92", "98"], limits: [{ liters: 20, gradeLabel: "95", observedAt: "2026-09-21T09:40:00Z" }] }],
      observations: [], queues: [], activity: []
    }),
    close: async () => ({ sessionsRemaining: 0, warnings: [] })
  };
  const result = await collectSnapshot({ browserFactory: () => runner, now: new Date("2026-09-21T10:00:00Z") });
  const assessment = result.snapshot.assessments.find(value => value.address === "ул. Первая, 1");
  assert.ok(assessment, "the fixture station must be assessed");
  assert.deepEqual(assessment.assortment, ["92", "98"]);
  assert.equal(assessment.sellsRequestedFamily, false, "a published catalogue without AI-95 must reach the snapshot");
  assert.deepEqual(assessment.limits.map(limit => limit.liters), [20, 20, 20, 20]);
});

// Once the window has actually been held, the attempt is spent however it ended: otherwise every source could hold
// its window for the full wait and the per-run cap would never bite.
test("a page lost mid-hold spends the per-run handover budget", async () => {
  const records = [];
  const config = { browser: { headed: true, challengeHandover: { enabled: true, waitSeconds: 10, pollSeconds: 2, maxPerRun: 1 } } };
  const policy = challengeHandoverPolicy(config, records);
  const runner = { namespace: "ns", sessionName: "source", expectedUrl: "https://2gis.ru/", awaitManualChallengeResolution: async () => "LOST_WHILE_HELD" };
  assert.equal(await policy.hold("2gis", runner), false);
  assert.deepEqual(records.map(value => value.outcome), ["LOST_WHILE_HELD"]);
  assert.equal(policy.mayOffer(), false, "a window we did hold must consume maxPerRun even when the page died");
});

// Reaping shares the cleanup reserve with close(), so its grace must stay bounded whatever close() left over.
test("orphan reaping gets a bounded grace whether cleanup time is plentiful or gone", async () => {
  const graces = [];
  const makeRunner = closeDelayMs => ({
    namespace: "fixture-grace", probe: async () => ({}),
    open: async url => ({ finalUrl: url, pageTextPrefix: "АЗС" }), waitReady: async () => {},
    evalJson: async () => ({ stations: [], observations: [], queues: [], activity: [] }),
    reapLeftoverProcesses: async ({ graceMs }) => { graces.push(graceMs); return []; },
    close: async () => { await new Promise(resolve => setTimeout(resolve, closeDelayMs)); return { sessionsRemaining: 0, warnings: [] }; }
  });
  await collectSnapshot({ browserFactory: () => makeRunner(0), now: new Date("2026-09-21T10:00:00Z") });
  assert.ok(graces.length >= 4, "every closed runner is reaped");
  assert.ok(graces.every(value => value >= 250 && value <= 3000), `grace must stay within [250, 3000], got ${graces.join(", ")}`);
  assert.equal(reapGraceMs(120000), 3000, "a large remaining reserve must not become a long wait for a stuck daemon");
  assert.equal(reapGraceMs(1200), 1200, "what is left of the reserve is what reaping gets");
  assert.equal(reapGraceMs(-5000), 250, "an exhausted reserve still leaves room for SIGTERM to take effect");
  assert.equal(reapGraceMs(Number.NaN), 250);
});
