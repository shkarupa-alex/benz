import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BrowserRunner } from "../../scripts/lib/browser-runner.mjs";

test("runner strips inherited agent-browser, gateway and proxy variables", async () => {
  const config = await loadConfig();
  const original = { ...process.env };
  process.env.AGENT_BROWSER_ENGINE = "lightpanda";
  process.env.AGENT_BROWSER_EXECUTABLE_PATH = "/bin/false";
  process.env.AI_GATEWAY_API_KEY = "secret";
  process.env.HTTP_PROXY = "http://bad.invalid";
  process.env.DISPLAY = ":42";
  process.env.XAUTHORITY = "/tmp/fuel-watch-test-xauthority";
  const calls = [];
  const exec = async (command, args, options) => { calls.push(options.env); return { exitCode: 0, stdout: JSON.stringify({data:{sessions:[]}}), stderr: "" }; };
  try {
    const runner = new BrowserRunner(config, { exec, command: process.execPath, namespace: "test-ns", sessionName: "source" });
    await runner.probe();
    const env = calls[0];
    assert.equal(env.AGENT_BROWSER_ENGINE, undefined);
    assert.equal(env.AGENT_BROWSER_EXECUTABLE_PATH, undefined);
    assert.equal(env.AI_GATEWAY_API_KEY, undefined);
    assert.equal(env.HTTP_PROXY, undefined);
    assert.equal(env.AGENT_BROWSER_NAMESPACE, "test-ns");
    assert.equal(env.AGENT_BROWSER_IDLE_TIMEOUT_MS, "10000");
    assert.equal(env.DISPLAY, ":42");
    assert.equal(env.XAUTHORITY, "/tmp/fuel-watch-test-xauthority");
    assert.ok(calls.length);
  } finally { process.env = original; }
});

test("runner pins the explicitly loaded config file", async () => {
  const config = await loadConfig();
  const calls = [];
  const exec = async (command, args) => { calls.push(args); return { exitCode: 0, stdout: JSON.stringify({data:{sessions:[]}}), stderr: "" }; };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.probe();
  assert.equal(calls[0][calls[0].indexOf("--config") + 1], config.browser.configPath);
  assert.ok(calls[0].includes("--headed"));
  assert.match(config.browser.configPath, /fuel-watch\/config\/agent-browser\.json$/);
});

test("page loss is explicit and cannot become an empty parser result", async () => {
  const config = await loadConfig();
  const exec = async (command, args) => {
    if (args.includes("open")) return { exitCode: 0, stdout: JSON.stringify({ data: { url: "https://yandex.ru/maps" } }), stderr: "" };
    if (args.includes("url")) return { exitCode: 0, stdout: JSON.stringify({ data: { url: "about:blank" } }), stderr: "" };
    return { exitCode: 0, stdout: JSON.stringify({ data: { value: "" } }), stderr: "" };
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(runner.open("https://yandex.ru/maps"), error => error.code === "PAGE_LOST");
});

test("initial redirect may land on another allowed host", async () => {
  const config=await loadConfig();
  const landed="https://maps.yandex.ru/captcha";
  const exec=async(command,args)=>{
    if(args.includes("open"))return{exitCode:0,stdout:JSON.stringify({data:{url:landed}}),stderr:""};
    if(args.includes("url"))return{exitCode:0,stdout:JSON.stringify({data:{url:landed}}),stderr:""};
    if(args.includes("title"))return{exitCode:0,stdout:JSON.stringify({data:{title:"Captcha"}}),stderr:""};
    if(args.includes("text"))return{exitCode:0,stdout:JSON.stringify({data:{text:"captcha"}}),stderr:""};
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  const opened=await runner.open("https://yandex.ru/maps");
  assert.equal(opened.finalUrl,landed);
});

test("initial redirect may cross between configured 2GIS domains", async () => {
  const config=await loadConfig();
  const landed="https://2gis.com/volgograd/search/%D0%90%D0%97%D0%A1";
  const exec=async(command,args)=>{
    if(args.includes("open"))return{exitCode:0,stdout:JSON.stringify({data:{url:landed}}),stderr:""};
    if(args.includes("url"))return{exitCode:0,stdout:JSON.stringify({data:{url:landed}}),stderr:""};
    if(args.includes("title"))return{exitCode:0,stdout:JSON.stringify({data:{title:"2GIS"}}),stderr:""};
    if(args.includes("text"))return{exitCode:0,stdout:JSON.stringify({data:{text:"АЗС"}}),stderr:""};
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  const opened=await runner.open("https://2gis.ru/volgograd/search/%D0%90%D0%97%D0%A1");
  assert.equal(opened.finalUrl,landed);
});

test("stale CDP target is recreated once before opening 2GIS", async () => {
  const config=await loadConfig(); let opens=0;
  const landed="https://2gis.ru/volgograd/search/%D0%90%D0%97%D0%A1";
  const exec=async(command,args)=>{
    if(args.includes("open") && opens++ === 0)return{exitCode:1,stdout:"",stderr:"Failed to install browser network controls: CDP error (Page.enable): Session with given id not found."};
    if(args.includes("open"))return{exitCode:0,stdout:JSON.stringify({data:{url:landed}}),stderr:""};
    if(args.includes("url"))return{exitCode:0,stdout:JSON.stringify({data:{url:landed}}),stderr:""};
    if(args.includes("title"))return{exitCode:0,stdout:JSON.stringify({data:{title:"2GIS"}}),stderr:""};
    if(args.includes("text"))return{exitCode:0,stdout:JSON.stringify({data:{text:"АЗС"}}),stderr:""};
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  const opened=await runner.open(landed);
  assert.equal(opened.finalUrl,landed);
  assert.equal(opens,2);
  assert.equal(runner.networkControlsStatus,"DEGRADED");
  assert.equal(runner.runtimeWarnings.length,1);
});

test("degraded network-control fallback still rejects an external landing", async () => {
  const config=await loadConfig(); let opens=0;
  const exec=async(command,args)=>{
    if(args.includes("open") && opens++ === 0)return{exitCode:1,stdout:"",stderr:"Failed to install browser network controls: CDP error (Runtime.evaluate): Cannot find default execution context"};
    if(args.includes("open"))return{exitCode:0,stdout:JSON.stringify({data:{url:"https://evil.invalid/"}}),stderr:""};
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  await assert.rejects(runner.open("https://gdebenz.ru/"),error=>error.code==="RESOURCE_BLOCKED");
});

test("post-open network-control failure recreates before page inspection", async () => {
  const config=await loadConfig(); let opens=0,urlReads=0;
  const exec=async(command,args)=>{
    if(args.includes("open")){opens++;return{exitCode:0,stdout:JSON.stringify({data:{url:"https://gdebenz.ru/"}}),stderr:""};}
    if(args.includes("url") && urlReads++ === 0)return{exitCode:1,stdout:"",stderr:"Failed to install browser network controls: CDP error (Runtime.evaluate): Cannot find default execution context"};
    if(args.includes("url"))return{exitCode:0,stdout:JSON.stringify({data:{url:"https://gdebenz.ru/"}}),stderr:""};
    if(args.includes("title"))return{exitCode:0,stdout:JSON.stringify({data:{title:"ГдеБЕНЗ"}}),stderr:""};
    if(args.includes("text"))return{exitCode:0,stdout:JSON.stringify({data:{text:"АЗС"}}),stderr:""};
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  const opened=await runner.open("https://gdebenz.ru/");
  assert.equal(opened.finalUrl,"https://gdebenz.ru/");
  assert.equal(opens,2);
  assert.equal(runner.networkControlsStatus,"DEGRADED");
});

test("ordinary Runtime.evaluate failure never disables network controls", async () => {
  const config=await loadConfig(); let opens=0;
  const exec=async(command,args)=>{
    if(args.includes("open")){opens++;return{exitCode:1,stdout:"",stderr:"CDP error (Runtime.evaluate): JavaScript exception"};}
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  await assert.rejects(runner.open("https://gdebenz.ru/"),error=>error.code==="INTERNAL_ADAPTER_ERROR");
  assert.equal(opens,1);
  assert.equal(runner.networkControlsStatus,"PENDING");
});

test("network controls are installed once per live browser session", async () => {
  const config=await loadConfig();
  const openCalls=[];
  let currentUrl="https://yandex.ru/maps";
  const exec=async(command,args)=>{
    if(args.includes("open")){
      openCalls.push(args);
      currentUrl=args[args.indexOf("open")+1];
      return{exitCode:0,stdout:JSON.stringify({data:{url:currentUrl}}),stderr:""};
    }
    if(args.includes("url"))return{exitCode:0,stdout:JSON.stringify({data:{url:currentUrl}}),stderr:""};
    if(args.includes("title"))return{exitCode:0,stdout:JSON.stringify({data:{title:"page"}}),stderr:""};
    if(args.includes("text"))return{exitCode:0,stdout:JSON.stringify({data:{text:"body"}}),stderr:""};
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  await runner.open("https://yandex.ru/maps");
  await runner.open("https://gdebenz.ru/");
  assert.equal(openCalls.length,2);
  assert.ok(openCalls[0].includes("--allowed-domains"));
  assert.equal(openCalls[1].includes("--allowed-domains"),false);
});

test("snapshot never runs concurrent CLI commands in one session", async () => {
  const config=await loadConfig();
  let active=0,maxActive=0;
  const exec=async(command,args)=>{
    active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,2));
    active--;
    if(args.includes("open"))return{exitCode:0,stdout:JSON.stringify({data:{url:"https://gdebenz.ru/"}}),stderr:""};
    if(args.includes("url"))return{exitCode:0,stdout:JSON.stringify({data:{url:"https://gdebenz.ru/"}}),stderr:""};
    if(args.includes("title"))return{exitCode:0,stdout:JSON.stringify({data:{title:"ГдеБЕНЗ"}}),stderr:""};
    if(args.includes("text"))return{exitCode:0,stdout:JSON.stringify({data:{text:"АЗС"}}),stderr:""};
    return{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath});
  await runner.open("https://gdebenz.ru/");
  assert.equal(maxActive,1);
});

test("cleanup never invokes close --all outside owned namespace", async () => {
  const config = await loadConfig();
  config.browser.cleanupReserveMs = 20;
  let fallbackClosed = false;
  const calls = [];
  const exec = async (command, args) => { calls.push(args); if (args.includes("list")) return { exitCode:0,stdout:JSON.stringify({data:{sessions:fallbackClosed ? [] : [{name:"source"}]}}),stderr:""}; if(args.includes("--all"))fallbackClosed=true; return {exitCode:0,stdout:"{}",stderr:""}; };
  const runner = new BrowserRunner(config,{exec,command:process.execPath,namespace:"owned",sessionName:"source"});
  await runner.close();
  const fallback = calls.find(args => args.includes("--all"));
  assert.ok(fallback);
  assert.equal(fallback[fallback.indexOf("--namespace") + 1], "owned");
});

test("cleanup verifies every rotated namespace and preserves early close failures", async () => {
  const config=await loadConfig(); config.browser.cleanupReserveMs=20;
  const alive=new Map([["old-owned",true]]); const calls=[];
  const exec=async(command,args)=>{
    calls.push(args);
    const namespace=args[args.indexOf("--namespace")+1];
    if(args.includes("list"))return{exitCode:0,stdout:JSON.stringify({data:{sessions:alive.get(namespace)?[{name:"source"}]:[]}}),stderr:""};
    if(args.includes("close") && args.includes("--all"))return{exitCode:1,stdout:"",stderr:"fallback failed"};
    if(args.includes("close") && namespace==="old-owned")return{exitCode:1,stdout:"",stderr:"early close failed"};
    if(args.includes("close")){alive.set(namespace,false);return{exitCode:0,stdout:"{}",stderr:""};}
    return{exitCode:0,stdout:"{}",stderr:""};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath,namespace:"old-owned",sessionName:"source"});
  await runner.closeSessionBestEffort();
  runner.rotateNamespace();
  alive.set(runner.namespace,true);
  const cleanup=await runner.close();
  assert.equal(cleanup.sessionsRemaining,1);
  assert.equal(cleanup.namespaces.length,2);
  assert.equal(cleanup.namespaces.find(value=>value.namespace==="old-owned").sessionsRemaining,1);
  assert.ok(cleanup.warnings.some(value=>value.startsWith("old-owned: session close failed: early close failed")));
  assert.ok(calls.some(args=>args.includes("--all") && args[args.indexOf("--namespace")+1]==="old-owned"));
});

test("cleanup uses one absolute reserve across commands and namespaces", async () => {
  const config=await loadConfig(); config.browser.cleanupReserveMs=20;
  let now=1000; const calls=[];
  const exec=async(command,args,options)=>{
    const namespace=args[args.indexOf("--namespace")+1];
    calls.push({namespace,args,timeoutMs:options.timeoutMs,startedAt:now});
    now+=Math.min(7,options.timeoutMs);
    if(args.includes("list"))return{exitCode:0,stdout:JSON.stringify({data:{sessions:[{name:"source"}]}}),stderr:""};
    if(args.includes("--all"))return{exitCode:1,stdout:"",stderr:"fallback failed"};
    return{exitCode:1,stdout:"",stderr:"close failed"};
  };
  const runner=new BrowserRunner(config,{exec,command:process.execPath,namespace:"budget-old",sessionName:"source",now:()=>now});
  runner.rotateNamespace();
  const cleanup=await runner.close();
  assert.ok(calls.every(call=>call.timeoutMs>0 && call.timeoutMs<=20));
  assert.ok(calls.every(call=>call.timeoutMs<=1020-call.startedAt));
  assert.ok(now<=1020);
  assert.equal(cleanup.sessionsRemaining,2);
  assert.ok(cleanup.namespaces.every(value=>value.warnings.some(message=>/deadline exhausted/.test(message))));
});

test("cleanup waits for an asynchronously disappearing session before fallback", async () => {
  const config=await loadConfig(); config.browser.cleanupReserveMs=100;
  let polls=0; const calls=[];
  const exec=async(command,args)=>{calls.push(args);if(args.includes("list"))return{exitCode:0,stdout:JSON.stringify({data:{sessions:polls++ < 1 ? [{name:"source"}] : []}}),stderr:""};return{exitCode:0,stdout:"{}",stderr:""};};
  const runner=new BrowserRunner(config,{exec,command:process.execPath,namespace:"delayed",sessionName:"source"});
  const cleanup=await runner.close();
  assert.equal(cleanup.sessionsRemaining,0);
  assert.equal(calls.some(args=>args.includes("--all")),false);
});

test("twenty fake cleanup cycles leave zero owned sessions", async () => {
  const config=await loadConfig();
  for(let cycle=0;cycle<20;cycle++){
    const exec=async(command,args)=>args.includes("list")?{exitCode:0,stdout:JSON.stringify({data:{sessions:[]}}),stderr:""}:{exitCode:0,stdout:"{}",stderr:""};
    const runner=new BrowserRunner(config,{exec,command:process.execPath,namespace:`soak-${cycle}`,sessionName:"source"});
    const cleanup=await runner.close();
    assert.equal(cleanup.sessionsRemaining,0);
  }
});

const okJson = value => ({ exitCode: 0, stdout: JSON.stringify({ data: value }), stderr: "" });

test("a blank tab right after open is retried in a fresh namespace instead of dropping the source", async () => {
  const config = await loadConfig();
  let urlReads = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("open")) return okJson({ url: "https://gdebenz.ru/" });
    if (args.includes("url")) return okJson({ url: ++urlReads === 1 ? "about:blank" : "https://gdebenz.ru/" });
    if (args.includes("title")) return okJson({ title: "ГдеБЕНЗ" });
    return okJson({ text: "станции" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  const first = runner.namespace;
  const opened = await runner.open("https://gdebenz.ru/");
  assert.equal(opened.finalUrl, "https://gdebenz.ru/");
  assert.equal(urlReads, 2);
  assert.notEqual(runner.namespace, first);
  assert.deepEqual(runner.namespaceHistory, [first, runner.namespace]);
});

test("a Chrome error page after open is retried the same way as a blank tab", async () => {
  const config = await loadConfig();
  let urlReads = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("open")) return okJson({ url: "https://2gis.ru/volgograd" });
    if (args.includes("url")) return okJson({ url: ++urlReads === 1 ? "chrome-error://chromewebdata/" : "https://2gis.ru/volgograd" });
    if (args.includes("title")) return okJson({ title: "2GIS" });
    return okJson({ text: "АЗС" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  const opened = await runner.open("https://2gis.ru/volgograd");
  assert.equal(opened.finalUrl, "https://2gis.ru/volgograd");
  assert.equal(urlReads, 2);
});

test("a page that stays blank still fails closed as page loss", async () => {
  const config = await loadConfig();
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("open")) return okJson({ url: "https://gdebenz.ru/" });
    if (args.includes("url")) return okJson({ url: "about:blank" });
    if (args.includes("title")) return okJson({ title: "" });
    if (args.includes("close")) return okJson({ closed: true });
    return okJson({ text: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://gdebenz.ru/"), error => error.code === "PAGE_LOST");
});

test("real drift to another origin is never retried away", async () => {
  const config = await loadConfig();
  let opens = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("open")) { opens++; return okJson({ url: "https://gdebenz.ru/" }); }
    if (args.includes("url")) return okJson({ url: "https://gdebenz.ru.evil.example/" });
    if (args.includes("title")) return okJson({ title: "" });
    return okJson({ text: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://gdebenz.ru/"), error => error.code === "PAGE_LOST");
  assert.equal(opens, 1);
});

test("a headless User-Agent is reused without the Headless token and passed to later commands", async () => {
  const config = await loadConfig();
  const calls = [];
  const exec = async (command, args) => {
    calls.push(args);
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("eval")) return okJson({ result: "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/153.0.0.0 Safari/537.36" });
    return okJson({ closed: true });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.probe();
  assert.equal(await runner.useRealisticUserAgent(), true);
  assert.equal(runner.userAgent, "Mozilla/5.0 (X11; Linux x86_64) Chrome/153.0.0.0 Safari/537.36");
  assert.ok(runner.runtimeWarnings.some(value => /Headless/.test(value)));
  await runner.probe();
  const last = calls.at(-1);
  assert.equal(last[last.indexOf("--user-agent") + 1], runner.userAgent);
  assert.equal(await runner.useRealisticUserAgent(), false);
});

test("a browser that is already not headless is left untouched", async () => {
  const config = await loadConfig();
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("eval")) return okJson({ result: "Mozilla/5.0 (Macintosh) Chrome/153.0.0.0 Safari/537.36" });
    return okJson({ closed: true });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.probe();
  assert.equal(await runner.useRealisticUserAgent(), false);
  assert.equal(runner.userAgent, undefined);
  assert.equal(runner.runtimeWarnings.length, 0);
});

test("a first-navigation certificate failure is retried in a fresh namespace", async () => {
  const config = await loadConfig();
  let opens = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) {
      if (++opens === 1) return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_CERT_AUTHORITY_INVALID" }), stderr: "" };
      return okJson({ url: "https://yandex.ru/maps" });
    }
    if (args.includes("url")) return okJson({ url: "https://yandex.ru/maps" });
    if (args.includes("title")) return okJson({ title: "Яндекс Карты" });
    return okJson({ text: "АЗС" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  const first = runner.namespace;
  const opened = await runner.open("https://yandex.ru/maps");
  assert.equal(opened.finalUrl, "https://yandex.ru/maps");
  assert.equal(opens, 2);
  assert.notEqual(runner.namespace, first);
});

test("a navigation failure that keeps repeating is named rather than reported as an internal error", async () => {
  const config = await loadConfig();
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_CERT_AUTHORITY_INVALID" }), stderr: "" };
    return okJson({ url: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://yandex.ru/maps"), error => error.code === "NAVIGATION_FAILED" && /ERR_CERT_AUTHORITY_INVALID/.test(error.message));
});

test("a permanent navigation error is retried only once, without network controls, never as transient", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens.push(args.includes("--allowed-domains")); return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_SSL_PROTOCOL_ERROR" }), stderr: "" }; }
    return okJson({ url: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://yandex.ru/maps"), error => error.code === "NAVIGATION_FAILED" && /ERR_SSL_PROTOCOL_ERROR/.test(error.message));
  assert.deepEqual(opens, [true, false]);
  assert.equal(runner.networkControlsStatus, "DEGRADED");
});

test("a connection refused under network controls falls back to an uncontrolled open", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) {
      opens.push(args.includes("--allowed-domains"));
      if (args.includes("--allowed-domains")) return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_CONNECTION_REFUSED" }), stderr: "" };
      return okJson({ url: "https://benzonavt.ru/" });
    }
    if (args.includes("url")) return okJson({ url: "https://benzonavt.ru/" });
    return okJson({ pageTitle: "Бензонавт", pageText: "АЗС", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.open("https://benzonavt.ru/");
  assert.deepEqual(opens, [true, false], "the browser-level 'connection' retry must not keep the broken controls");
  assert.equal(runner.networkControlsStatus, "DEGRADED");
});

test("a connection refused that persists without controls is not retried a third time", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens.push(args.includes("--allowed-domains")); return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_CONNECTION_REFUSED" }), stderr: "" }; }
    return okJson({ url: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://benzonavt.ru/"), error => error.code === "NAVIGATION_FAILED" && /ERR_CONNECTION_REFUSED/.test(error.message));
  assert.deepEqual(opens, [true, false]);
});

test("without network controls a permanent navigation error is not retried at all", async () => {
  const config = await loadConfig();
  let opens = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens++; return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_SSL_PROTOCOL_ERROR" }), stderr: "" }; }
    return okJson({ url: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  runner.networkControlsStatus = "DEGRADED";
  await assert.rejects(() => runner.open("https://yandex.ru/maps"), error => error.code === "NAVIGATION_FAILED");
  assert.equal(opens, 1);
});

// agent-browser 0.38.2: open succeeds, then the page silently turns into about:blank
// whenever --allowed-domains is in force, even with "*". No error text names the controls.
test("a page blanked right after controls were installed is reopened once without them", async () => {
  const config = await loadConfig();
  const opens = [];
  let current = "about:blank";
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { const controls = args.includes("--allowed-domains"); opens.push(controls); current = controls ? "about:blank" : "https://gdebenz.ru/"; return okJson({ url: "https://gdebenz.ru/" }); }
    if (args.includes("url")) return okJson({ url: current });
    return okJson({ pageTitle: "ГдеБЕНЗ", pageText: "станции", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  const opened = await runner.open("https://gdebenz.ru/");
  assert.equal(opened.finalUrl, "https://gdebenz.ru/");
  assert.deepEqual(opens, [true, false]);
  assert.equal(runner.networkControlsStatus, "DEGRADED");
  assert.equal(runner.runtimeWarnings.length, 1);
  assert.match(runner.runtimeWarnings[0], /about:blank/);
});

test("a blank page in a session without controls is only moved to a fresh namespace", async () => {
  const config = await loadConfig();
  const opens = [];
  let urlReads = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens.push(args.includes("--allowed-domains")); return okJson({ url: "https://gdebenz.ru/" }); }
    if (args.includes("url")) return okJson({ url: ++urlReads === 1 ? "about:blank" : "https://gdebenz.ru/" });
    return okJson({ pageTitle: "ГдеБЕНЗ", pageText: "станции", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  runner.networkControlsStatus = "DEGRADED";
  const first = runner.namespace;
  await runner.open("https://gdebenz.ru/");
  assert.deepEqual(opens, [false, false]);
  assert.notEqual(runner.namespace, first);
  assert.equal(runner.runtimeWarnings.length, 0);
});

test("an agent-browser without --allowed-domains falls back instead of failing every source", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) {
      opens.push(args.includes("--allowed-domains"));
      if (args.includes("--allowed-domains")) return { exitCode: 1, stdout: JSON.stringify({ error: "Unknown command: --allowed-domains", success: false, type: "unknown_command" }), stderr: "" };
      return okJson({ url: "https://benzonavt.ru/" });
    }
    if (args.includes("url")) return okJson({ url: "https://benzonavt.ru/" });
    return okJson({ pageTitle: "Бензонавт", pageText: "АЗС", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  const opened = await runner.open("https://benzonavt.ru/");
  assert.equal(opened.finalUrl, "https://benzonavt.ru/");
  assert.deepEqual(opens, [true, false]);
  assert.equal(runner.networkControlsStatus, "DEGRADED");
});

// agent-browser does not name the blocked URL, so a block cannot be told apart from a redirect to an unlisted host.
test("a block under network controls is never attributed to them", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens.push(args.includes("--allowed-domains")); return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_BLOCKED_BY_CLIENT" }), stderr: "" }; }
    return okJson({ url: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://2gis.ru/volgograd"), error => error.code === "RESOURCE_BLOCKED");
  assert.deepEqual(opens, [true]);
  assert.notEqual(runner.networkControlsStatus, "DEGRADED");
});

test("an open that hangs under network controls is retried once without them", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) {
      opens.push(args.includes("--allowed-domains"));
      if (args.includes("--allowed-domains")) return { exitCode: 124, signal: "TIMEOUT", stdout: "", stderr: "" };
      return okJson({ url: "https://gdebenz.ru/" });
    }
    if (args.includes("url")) return okJson({ url: "https://gdebenz.ru/" });
    return okJson({ pageTitle: "ГдеБЕНЗ", pageText: "станции", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.open("https://gdebenz.ru/");
  assert.deepEqual(opens, [true, false]);
  assert.match(runner.runtimeWarnings[0], /open hung/);
});

test("a browser that keeps failing under network controls gets its last attempt without them", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) {
      opens.push(args.includes("--allowed-domains"));
      if (args.includes("--allowed-domains")) return { exitCode: 1, stdout: "", stderr: "daemon connection lost" };
      return okJson({ url: "https://gdebenz.ru/" });
    }
    if (args.includes("url")) return okJson({ url: "https://gdebenz.ru/" });
    return okJson({ pageTitle: "ГдеБЕНЗ", pageText: "станции", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.open("https://gdebenz.ru/");
  assert.deepEqual(opens, [true, true, false], "the first browser-level failure keeps the controls, a repeat drops them");
});

test("a degradation after the User-Agent retry still gets its own warning", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args, { input } = {}) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens.push(args.includes("--allowed-domains")); return okJson({ url: "https://yandex.ru/maps" }); }
    if (args.includes("url")) return okJson({ url: opens.length === 2 && opens[1] ? "about:blank" : "https://yandex.ru/maps" });
    if (input === "navigator.userAgent") return okJson({ result: "Mozilla/5.0 HeadlessChrome/140.0" });
    return okJson({ pageTitle: "Яндекс", pageText: "limited", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.open("https://yandex.ru/maps");
  assert.equal(await runner.useRealisticUserAgent(), true);
  await runner.open("https://yandex.ru/maps");
  assert.deepEqual(opens, [true, true, false]);
  assert.equal(runner.runtimeWarnings.length, 2);
  assert.ok(runner.runtimeWarnings.some(message => /network controls failed \(page became about:blank/.test(message)));
});

test("data read while the page navigated to another origin is discarded", async () => {
  const config = await loadConfig();
  let urlReads = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) return okJson({ url: "https://gdebenz.ru/" });
    if (args.includes("url")) return okJson({ url: ++urlReads <= 2 ? "https://gdebenz.ru/" : "https://evil.example/" });
    return okJson({ pageTitle: "ГдеБЕНЗ", pageText: "станции", selectorReady: false, stations: ["forged"] });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  runner.networkControlsStatus = "DEGRADED";
  await runner.open("https://gdebenz.ru/");
  await assert.rejects(() => runner.evalJson("collect()"), error => error.code === "PAGE_LOST");
});

test("an off-allowlist landing with only a generic return parameter is not mistaken for a sign-in gate", async () => {
  const config = await loadConfig();
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) return okJson({ url: `https://ads.example/click?next=${encodeURIComponent("https://2gis.ru/")}` });
    throw new Error(`the foreign page must never be inspected: ${args.join(" ")}`);
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://2gis.ru/volgograd"), error => error.code === "RESOURCE_BLOCKED");
});

// 2GIS answers agent-browser's Chrome (only it: a regular browser on the same IP gets the page) with a Sber ID
// sign-in that returns to 2gis.ru. That is a gate, and the skill never logs in, bypasses or retries it.
test("an external sign-in gate at landing is a challenge that is neither retried nor read", async () => {
  const config = await loadConfig();
  const target = "https://2gis.ru/volgograd/search/%D0%90%D0%97%D0%A1";
  const gate = `https://id.sber.ru/CSAFront/oidc/authorize.do?prompt=light&machineClick=aggressivelogin&client_type=PRIVATE&redirect_uri=${encodeURIComponent("https://2gis.ru/_/auth/sberid/code")}&state=x`;
  let opens = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens++; return okJson({ url: gate }); }
    throw new Error(`the foreign page must never be inspected: ${args.join(" ")}`);
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open(target), error => error.code === "CHALLENGE" && /id\.sber\.ru/.test(error.message));
  assert.equal(opens, 1);
  assert.equal(runner.expectedUrl, target, "a later probe must judge drift against the requested page, not the gate");
});

test("an external sign-in gate reached after open is still a challenge, never evaluated", async () => {
  const config = await loadConfig();
  const target = "https://2gis.ru/volgograd";
  const gate = `https://id.sber.ru/CSAFront/oidc/authorize.do?redirect_uri=${encodeURIComponent("https://2gis.ru/_/auth/sberid/code")}`;
  const evals = [];
  let urlReads = 0;
  const exec = async (command, args, { input } = {}) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) return okJson({ url: target });
    if (args.includes("url")) return okJson({ url: ++urlReads === 1 ? target : gate });
    evals.push(input);
    return okJson({ pageTitle: "2ГИС", pageText: "АЗС", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  runner.networkControlsStatus = "DEGRADED";
  await runner.open(target);
  const evalsBefore = evals.length;
  await assert.rejects(() => runner.waitReady({ anyOfSelectors: ["a"], urlRejectPatterns: [], timeoutMs: 1000 }), error => error.code === "CHALLENGE" && /id\.sber\.ru/.test(error.message));
  assert.equal(evals.length, evalsBefore, "the gate page is never evaluated");
});

test("a transient navigation error that repeats under network controls drops them for the last attempt", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) {
      opens.push(args.includes("--allowed-domains"));
      if (args.includes("--allowed-domains")) return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_CONNECTION_RESET" }), stderr: "" };
      return okJson({ url: "https://gdebenz.ru/" });
    }
    if (args.includes("url")) return okJson({ url: "https://gdebenz.ru/" });
    return okJson({ pageTitle: "ГдеБЕНЗ", pageText: "станции", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await runner.open("https://gdebenz.ru/");
  assert.deepEqual(opens, [true, true, false]);
  assert.match(runner.runtimeWarnings[0], /ERR_CONNECTION_RESET/);
});

test("an open that itself reports a blank landing under network controls is reopened without them", async () => {
  const config = await loadConfig();
  const opens = [];
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { const controls = args.includes("--allowed-domains"); opens.push(controls); return okJson({ url: controls ? "about:blank" : "https://gdebenz.ru/" }); }
    if (args.includes("url")) return okJson({ url: "https://gdebenz.ru/" });
    return okJson({ pageTitle: "ГдеБЕНЗ", pageText: "станции", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  const opened = await runner.open("https://gdebenz.ru/");
  assert.equal(opened.finalUrl, "https://gdebenz.ru/");
  assert.deepEqual(opens, [true, false]);
  assert.equal(runner.networkControlsStatus, "DEGRADED");
});

test("a manual handover cannot read an external gate page", async () => {
  const config = await loadConfig();
  const gate = `https://id.sber.ru/authorize?redirect_uri=${encodeURIComponent("https://2gis.ru/")}`;
  const evals = [];
  const exec = async (command, args, { input } = {}) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open") || args.includes("url")) return okJson({ url: gate });
    evals.push(input);
    return okJson({ pageTitle: "Сбер ID", pageText: "Войти", selectorReady: false });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://2gis.ru/volgograd"), error => error.code === "CHALLENGE");
  assert.equal(await runner.awaitManualChallengeResolution({ waitMs: 1000, pollMs: 10 }), "UNREADABLE");
  assert.equal(evals.length, 0);
});

test("an external landing without a way back stays a blocked-resource failure", async () => {
  const config = await loadConfig();
  let opens = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens++; return okJson({ url: `https://tracker.example/?redirect_uri=${encodeURIComponent("https://evil.example/")}` }); }
    throw new Error(`the foreign page must never be inspected: ${args.join(" ")}`);
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://2gis.ru/volgograd"), error => error.code === "RESOURCE_BLOCKED");
  assert.equal(opens, 1);
});

// Readiness polling used to spawn five CLI processes per iteration; title, text and readiness now share one eval.
test("readiness polling spends two CLI calls per iteration and never asks for title or text separately", async () => {
  const config = await loadConfig();
  const commands = [];
  let polls = 0;
  const exec = async (command, args) => {
    commands.push(args);
    if (args.includes("url")) return okJson({ url: "https://2gis.ru/volgograd/search/АЗС" });
    if (args.includes("eval")) return okJson({ pageTitle: "2GIS", pageText: "АЗС", selectorReady: polls++ > 0 });
    return okJson({ sessions: [] });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  runner.expectedUrl = "https://2gis.ru/volgograd/search/АЗС";
  await runner.waitReady({ anyOfSelectors: ["a[href*=firm]"], urlRejectPatterns: ["/captcha"], timeoutMs: 5000 });
  assert.equal(polls, 2);
  assert.equal(commands.filter(args => args.includes("get") && args.includes("url")).length, 2);
  assert.equal(commands.filter(args => args.includes("eval")).length, 2);
  assert.equal(commands.filter(args => args.includes("title") || args.includes("text")).length, 0);
  assert.equal(commands.length, 4);
});

// The page is untrusted data: if readiness carried the URL too, a page could redefine location and hide its drift.
test("page drift is judged by the browser's own URL, not by what the page reports", async () => {
  const config = await loadConfig();
  const exec = async (command, args) => {
    if (args.includes("url")) return okJson({ url: "https://evil.example/landing" });
    if (args.includes("eval")) return okJson({ pageTitle: "2GIS", pageText: "АЗС", selectorReady: true });
    return okJson({ sessions: [] });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  runner.expectedUrl = "https://2gis.ru/volgograd/search/АЗС";
  await assert.rejects(() => runner.waitReady({ anyOfSelectors: ["a[href*=firm]"], urlRejectPatterns: [], timeoutMs: 2000 }), error => error.code === "PAGE_LOST");
});

// Ownership must be namespace-scoped: a random agent-browser Chrome on this machine belongs to another session.
test("orphan reaping only signals daemons recorded under a namespace this runner created", async () => {
  const config = await loadConfig();
  const root = await mkdtemp(join(tmpdir(), "fuel-orphan-"));
  const write = async (namespace, pid) => { await mkdir(join(root, "namespaces", namespace, "run"), { recursive: true }); await writeFile(join(root, "namespaces", namespace, "run", "source.pid"), `${pid}\n`); };
  await write("fuel-watch-ours", 4242);
  await write("fuel-watch-rotated", 4243);
  await write("someone-elses-session", 4244);
  const signalled = [];
  const alive = new Set([4242, 4243, 4244, 4245]);
  const processControl = {
    args: async pid => alive.has(pid) ? (pid === 4245 ? "/usr/bin/something-else" : "/opt/agent-browser/bin/agent-browser-darwin-arm64") : undefined,
    terminate: (pid, signal) => { signalled.push([pid, signal]); alive.delete(pid); }
  };
  const runner = new BrowserRunner(config, { exec: async () => okJson({ sessions: [] }), command: process.execPath, namespace: "fuel-watch-ours", stateRoot: root, processControl });
  runner.namespaceHistory = ["fuel-watch-ours", "fuel-watch-rotated"];

  const reported = await runner.reapLeftoverProcesses({ terminate: false });
  assert.deepEqual(reported.map(value => value.pid).sort(), [4242, 4243]);
  assert.ok(reported.every(value => value.outcome === "REPORTED"));
  assert.equal(signalled.length, 0);

  const reaped = await runner.reapLeftoverProcesses({ terminate: true, graceMs: 200, pollMs: 10 });
  assert.deepEqual(reaped.map(value => [value.pid, value.outcome]), [[4242, "TERMINATED"], [4243, "TERMINATED"]]);
  assert.deepEqual(signalled, [[4242, "SIGTERM"], [4243, "SIGTERM"]]);
  assert.ok(alive.has(4244), "another session's daemon must never be signalled");
  await rm(root, { recursive: true, force: true });
});

test("a recycled or foreign pid under our namespace is never signalled", async () => {
  const config = await loadConfig();
  const root = await mkdtemp(join(tmpdir(), "fuel-orphan-pid-"));
  await mkdir(join(root, "namespaces", "fuel-watch-ours", "run"), { recursive: true });
  await writeFile(join(root, "namespaces", "fuel-watch-ours", "run", "source.pid"), "5555\n");
  const signalled = [];
  const runner = new BrowserRunner(config, { exec: async () => okJson({ sessions: [] }), command: process.execPath, namespace: "fuel-watch-ours", stateRoot: root, processControl: { args: async () => "/Applications/Safari.app/Contents/MacOS/Safari", terminate: (pid, signal) => signalled.push([pid, signal]) } });
  assert.deepEqual(await runner.reapLeftoverProcesses({ terminate: true }), []);
  assert.equal(signalled.length, 0);
  await rm(root, { recursive: true, force: true });
});

test("a stale pid file whose process is gone is not reported as an orphan", async () => {
  const config = await loadConfig();
  const root = await mkdtemp(join(tmpdir(), "fuel-orphan-stale-"));
  await mkdir(join(root, "namespaces", "fuel-watch-ours", "run"), { recursive: true });
  await writeFile(join(root, "namespaces", "fuel-watch-ours", "run", "source.pid"), "6666\n");
  const runner = new BrowserRunner(config, { exec: async () => okJson({ sessions: [] }), command: process.execPath, namespace: "fuel-watch-ours", stateRoot: root, processControl: { args: async () => undefined, terminate: () => { throw new Error("must not signal a dead pid"); } } });
  assert.deepEqual(await runner.leftoverProcesses(), []);
  await rm(root, { recursive: true, force: true });
});

// Ownership must survive pid reuse: a command line merely mentioning the string is not an agent-browser process,
// and a pid we never observed serving this namespace is not ours to signal.
test("orphan reaping refuses a pid we never observed and a process that only mentions agent-browser", async () => {
  const config = await loadConfig();
  const root = await mkdtemp(join(tmpdir(), "fuel-orphan-own-"));
  const pidPath = join(root, "namespaces", "fuel-watch-ours", "run", "source.pid");
  await mkdir(join(root, "namespaces", "fuel-watch-ours", "run"), { recursive: true });
  const signalled = [];
  const make = command => new BrowserRunner(config, { exec: async () => okJson({ sessions: [] }), command: process.execPath, namespace: "fuel-watch-ours", stateRoot: root, processControl: { args: async () => command, terminate: (pid, signal) => signalled.push([pid, signal]) } });

  await writeFile(pidPath, "7777\n");
  const mentions = make("tail -f /Users/alex/.agent-browser/namespaces/fuel-watch-ours/log");
  assert.deepEqual(await mentions.leftoverProcesses(), [], "a command line that only mentions the path is not our daemon");

  const daemon = make("/opt/homebrew/Cellar/agent-browser/0.38.1/libexec/bin/agent-browser-darwin-arm64");
  assert.equal((await daemon.leftoverProcesses()).length, 1, "the real daemon executable must still be recognised");

  // Record the pid while the session is ours, then let the file name a different one: that is pid reuse, not an orphan.
  const recycled = make("/opt/homebrew/Cellar/agent-browser/0.38.1/libexec/bin/agent-browser-darwin-arm64");
  await recycled.rememberDaemonPid();
  await writeFile(pidPath, "8888\n");
  assert.deepEqual(await recycled.reapLeftoverProcesses({ terminate: true }), [], "a pid we never observed must not be signalled");
  assert.deepEqual(signalled, []);
  await rm(root, { recursive: true, force: true });
});

// The ownership check is only worth anything if the pid is actually recorded during a real run. The daemon and its
// pid file come into existence with "open", so recording any earlier silently leaves the check with nothing.
test("the daemon pid is recorded by a real open, so a recycled pid is refused afterwards", async () => {
  const config = await loadConfig();
  const root = await mkdtemp(join(tmpdir(), "fuel-orphan-open-"));
  const namespace = "fuel-watch-open";
  const pidPath = join(root, "namespaces", namespace, "run", "source.pid");
  const exec = async (command, args) => {
    if (args.includes("open")) { await mkdir(dirname(pidPath), { recursive: true }); await writeFile(pidPath, "4242\n"); return okJson({ url: "https://2gis.ru/volgograd" }); }
    if (args.includes("url")) return okJson({ url: "https://2gis.ru/volgograd" });
    if (args.includes("eval")) return okJson({ pageTitle: "2GIS", pageText: "АЗС", selectorReady: true });
    return okJson({ sessions: [] });
  };
  const signalled = [];
  const daemon = "/opt/homebrew/Cellar/agent-browser/0.38.1/libexec/bin/agent-browser-darwin-arm64";
  const runner = new BrowserRunner(config, { exec, command: process.execPath, namespace, stateRoot: root, processControl: { args: async () => daemon, terminate: (pid, signal) => signalled.push([pid, signal]) } });
  await runner.open("https://2gis.ru/volgograd");
  assert.deepEqual([...runner.observedDaemonPids], [[namespace, 4242]], "open must record the pid it left behind");
  assert.deepEqual((await runner.leftoverProcesses()).map(value => value.pid), [4242]);
  await writeFile(pidPath, "9999\n");
  assert.deepEqual(await runner.reapLeftoverProcesses({ terminate: true }), [], "a pid that replaced the one we observed is not ours");
  assert.deepEqual(signalled, []);
  await rm(root, { recursive: true, force: true });
});

// Escalation happens after a wait, so the process must still be the very one we decided to reap; "some agent-browser"
// under the same pid can be a different invocation that inherited a recycled pid while we waited.
test("SIGKILL is withheld when the process under the pid changed while we waited", async () => {
  const config = await loadConfig();
  const root = await mkdtemp(join(tmpdir(), "fuel-orphan-escalate-"));
  await mkdir(join(root, "namespaces", "fuel-watch-ours", "run"), { recursive: true });
  await writeFile(join(root, "namespaces", "fuel-watch-ours", "run", "source.pid"), "4242\n");
  const signalled = [];
  let command = "/opt/agent-browser/bin/agent-browser-darwin-arm64 --session source";
  const runner = new BrowserRunner(config, { exec: async () => okJson({ sessions: [] }), command: process.execPath, namespace: "fuel-watch-ours", stateRoot: root, processControl: { args: async () => command, terminate: (pid, signal) => { signalled.push([pid, signal]); command = "/opt/agent-browser/bin/agent-browser-darwin-arm64 --session other"; } } });
  const reaped = await runner.reapLeftoverProcesses({ terminate: true, graceMs: 50, pollMs: 5 });
  assert.deepEqual(reaped.map(value => value.outcome), ["TERMINATED"]);
  assert.deepEqual(signalled, [[4242, "SIGTERM"]], "a different agent-browser invocation under the same pid must never be killed");
  await rm(root, { recursive: true, force: true });
});

// The initial probe failing costs nothing; losing the page after the window has been held for a while does not, and
// treating both as free would let four sources hold windows for the full wait each while the budget stays untouched.
test("a page lost during the hold is distinguished from one unreadable before it", async () => {
  const config = await loadConfig();
  let probes = 0;
  const exec = async (command, args) => {
    if (args.includes("url")) { probes += 1; return probes > 1 ? { exitCode: 1, stdout: "", stderr: "session gone" } : okJson({ url: "https://2gis.ru/captcha" }); }
    if (args.includes("eval")) return okJson({ pageTitle: "Проверка", pageText: "Подтвердите, что вы не робот", selectorReady: false });
    return okJson({ sessions: [] });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  runner.expectedUrl = "https://2gis.ru/captcha";
  assert.equal(await runner.awaitManualChallengeResolution({ waitMs: 60, pollMs: 10 }), "LOST_WHILE_HELD");
});

// A namespace abandoned by a retry can leave an orphan just like the last one, so its pid must be recorded before
// the session is closed: network-control degradation and the blank-tab retry both abandon a namespace mid-run.
test("a namespace abandoned by a retry still records its daemon pid", async () => {
  const config = await loadConfig();
  const root = await mkdtemp(join(tmpdir(), "fuel-orphan-rotate-"));
  const first = "fuel-watch-first";
  const pidPath = namespace => join(root, "namespaces", namespace, "run", "source.pid");
  let opens = 0;
  const exec = async (command, args) => {
    if (args.includes("open")) {
      opens += 1;
      const namespace = args[args.indexOf("--namespace") + 1] ?? first;
      await mkdir(dirname(pidPath(namespace)), { recursive: true });
      await writeFile(pidPath(namespace), `${4240 + opens}\n`);
      return opens === 1 ? { exitCode: 1, stdout: "", stderr: "failed to install browser network controls: CDP error (Page.enable)" } : okJson({ url: "https://2gis.ru/volgograd" });
    }
    if (args.includes("url")) return okJson({ url: "https://2gis.ru/volgograd" });
    if (args.includes("eval")) return okJson({ pageTitle: "2GIS", pageText: "АЗС", selectorReady: true });
    return okJson({ sessions: [] });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath, namespace: first, stateRoot: root, processControl: { args: async () => "/opt/agent-browser/bin/agent-browser-darwin-arm64", terminate: () => {} } });
  await runner.open("https://2gis.ru/volgograd");
  assert.equal(runner.networkControlsStatus, "DEGRADED", "the fixture must actually take the rotation path");
  assert.notEqual(runner.namespace, first, "the retry must run in a fresh namespace");
  assert.equal(runner.observedDaemonPids.get(first), 4241, "the abandoned namespace's pid must be recorded too");
  assert.equal(runner.observedDaemonPids.get(runner.namespace), 4242);
  await rm(root, { recursive: true, force: true });
});
