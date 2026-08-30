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

test("cleanup never invokes close --all outside owned namespace", async () => {
  const config = await loadConfig();
  let listCount = 0;
  const calls = [];
  const exec = async (command, args) => { calls.push(args); if (args.includes("list")) return { exitCode:0,stdout:JSON.stringify({data:{sessions:listCount++ === 0 ? [{name:"source"}] : []}}),stderr:""}; return {exitCode:0,stdout:"{}",stderr:""}; };
  const runner = new BrowserRunner(config,{exec,command:process.execPath,namespace:"owned",sessionName:"source"});
  await runner.close();
  const fallback = calls.find(args => args.includes("--all"));
  assert.ok(fallback);
  assert.equal(fallback[fallback.indexOf("--namespace") + 1], "owned");
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
