import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
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

test("a permanent navigation error is not retried as if it were transient", async () => {
  const config = await loadConfig();
  let opens = 0;
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) { opens++; return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_SSL_PROTOCOL_ERROR" }), stderr: "" }; }
    return okJson({ url: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://yandex.ru/maps"), error => error.code === "NAVIGATION_FAILED" && /ERR_SSL_PROTOCOL_ERROR/.test(error.message));
  assert.equal(opens, 1);
});

test("a navigation the allowlist blocked stays a blocked-resource failure", async () => {
  const config = await loadConfig();
  const exec = async (command, args) => {
    if (args.includes("session")) return okJson({ sessions: [] });
    if (args.includes("close")) return okJson({ closed: true });
    if (args.includes("open")) return { exitCode: 1, stdout: JSON.stringify({ success: false, data: null, error: "Navigation failed: net::ERR_BLOCKED_BY_CLIENT" }), stderr: "" };
    return okJson({ url: "" });
  };
  const runner = new BrowserRunner(config, { exec, command: process.execPath });
  await assert.rejects(() => runner.open("https://tracker.example/"), error => error.code === "RESOURCE_BLOCKED");
});
