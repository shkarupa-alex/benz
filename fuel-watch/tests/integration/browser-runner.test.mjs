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

test("runner pins the skill-owned config file", async () => {
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
