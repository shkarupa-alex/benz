import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, isAbsolute } from "node:path";
import { clampText, uniqueId } from "./util.mjs";

const SAFE_ENV = ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "SHELL", "USER", "LOGNAME", "XDG_RUNTIME_DIR"];

export class BrowserRunner {
  constructor(config, options = {}) {
    this.config = config;
    this.namespace = options.namespace ?? uniqueId("fuel-watch");
    this.sessionName = options.sessionName ?? "source";
    this.command = options.command ?? config.browser.executable;
    this.exec = options.exec ?? execute;
    this.started = false;
    this.recreated = false;
    this.expectedUrl = undefined;
  }

  async probe() {
    await resolveExecutable(this.command, this.environment());
    const result = await this.commandJson(["session", "list", "--json"], { timeoutMs: 10000 });
    if (result.exitCode !== 0) throw new BrowserError("BROWSER_UNAVAILABLE", result.stderr || result.stdout);
    return result.json;
  }

  async ensureRunSession() {
    if (!this.started) await this.probe();
    return { namespace: this.namespace, sessionName: this.sessionName };
  }

  async open(url) {
    await this.ensureRunSession();
    const result = await this.commandJson(["--allowed-domains", this.config.browser.allowedDomains.join(","), "open", url, "--json"], { timeoutMs: this.config.browser.adapterTimeoutMs });
    if (result.exitCode !== 0) {
      if (!this.recreated && isBrowserLevelFailure(result)) {
        this.recreated = true;
        await this.closeSessionBestEffort();
        return this.open(url);
      }
      throw classifyCommandFailure(result, "open");
    }
    this.started = true;
    const opened = commandPayload(result.json);
    const reportedUrl = String(opened?.url ?? opened?.finalUrl ?? "");
    this.expectedUrl = reportedUrl || url;
    if (reportedUrl) assertSameOrigin(url, reportedUrl);
    const snapshot = await this.snapshot();
    return { finalUrl: snapshot.url, pageTextPrefix: snapshot.textPrefix };
  }

  async waitReady(condition) {
    const deadline = Date.now() + condition.timeoutMs;
    let last;
    while (Date.now() < deadline) {
      const snapshot = await this.snapshot();
      last = snapshot;
      if (condition.urlRejectPatterns.some(pattern => new RegExp(pattern, "i").test(snapshot.url))) throw new BrowserError("CHALLENGE", `Rejected URL: ${snapshot.url}`);
      const selectorResult = await this.evalJson(`(${JSON.stringify(condition.anyOfSelectors)}).some(s => document.querySelector(s))`);
      if (selectorResult) return;
      await new Promise(resolve => setTimeout(resolve, Math.min(500, deadline - Date.now())));
    }
    throw new BrowserError("TIMEOUT", `Page did not become ready: ${last?.url ?? "unknown URL"}`);
  }

  async evalJson(expression) {
    await this.assertCurrentPage();
    return this.evalJsonUnchecked(expression);
  }

  async evalJsonUnchecked(expression) {
    const result = await this.commandJson(["eval", "--stdin", "--json"], { input: expression, timeoutMs: this.config.browser.adapterTimeoutMs });
    if (result.exitCode !== 0) throw classifyCommandFailure(result, "eval");
    return unwrapJson(result.json);
  }

  async snapshot() {
    const [url, title, text] = await Promise.all([
      this.commandJson(["get", "url", "--json"], { timeoutMs: 10000 }),
      this.commandJson(["get", "title", "--json"], { timeoutMs: 10000 }),
      this.commandJson(["get", "text", "body", "--json"], { timeoutMs: 10000 })
    ]);
    for (const part of [url, title, text]) if (part.exitCode !== 0) throw classifyCommandFailure(part, "snapshot");
    const snapshot = { url: String(unwrapJson(url.json) ?? ""), title: String(unwrapJson(title.json) ?? ""), textPrefix: clampText(unwrapJson(text.json), 1000) };
    if (this.expectedUrl) assertSameOrigin(this.expectedUrl, snapshot.url);
    return snapshot;
  }

  async assertCurrentPage() {
    if (!this.expectedUrl) return;
    const result = await this.commandJson(["get", "url", "--json"], { timeoutMs: 10000 });
    if (result.exitCode !== 0) throw classifyCommandFailure(result, "page check");
    assertSameOrigin(this.expectedUrl, String(unwrapJson(result.json) ?? ""));
  }

  async close() {
    const warnings = [];
    await this.closeSessionBestEffort(warnings);
    let remaining = await this.sessionsRemaining();
    if (remaining > 0) {
      const fallback = await this.commandJson(["close", "--all", "--json"], { timeoutMs: this.config.browser.cleanupReserveMs });
      if (fallback.exitCode !== 0) warnings.push(`namespace close --all failed: ${clampText(fallback.stderr || fallback.stdout)}`);
      remaining = await this.sessionsRemaining();
    }
    this.started = false;
    if (remaining > 0) warnings.push(`${remaining} owned session(s) remain`);
    return { sessionsRemaining: remaining, warnings };
  }

  async closeSessionBestEffort(warnings = []) {
    const result = await this.commandJson(["close", "--json"], { timeoutMs: this.config.browser.cleanupReserveMs });
    if (result.exitCode !== 0 && !/no active|not found|not running/i.test(`${result.stderr} ${result.stdout}`)) warnings.push(`session close failed: ${clampText(result.stderr || result.stdout)}`);
  }

  async sessionsRemaining() {
    const result = await this.commandJson(["session", "list", "--json"], { timeoutMs: this.config.browser.cleanupReserveMs });
    if (result.exitCode !== 0) return 1;
    const value = unwrapJson(result.json);
    const sessions = Array.isArray(value) ? value : value?.sessions ?? value?.data?.sessions ?? [];
    return sessions.length;
  }

  environment() {
    const env = {};
    for (const key of SAFE_ENV) if (process.env[key]) env[key] = process.env[key];
    env.AGENT_BROWSER_NAMESPACE = this.namespace;
    env.AGENT_BROWSER_SESSION = this.sessionName;
    env.AGENT_BROWSER_IDLE_TIMEOUT_MS = String(this.config.browser.idleTimeoutMs);
    return env;
  }

  async commandJson(args, options = {}) {
    const result = await this.exec(this.command, ["--config", this.config.browser.configPath, "--namespace", this.namespace, "--session", this.sessionName, ...args], { env: this.environment(), timeoutMs: options.timeoutMs, input: options.input });
    let json;
    try { json = result.stdout.trim() ? JSON.parse(result.stdout) : null; } catch { json = null; }
    return { ...result, json };
  }
}

export class BrowserError extends Error { constructor(code, message, details) { super(message); this.name = "BrowserError"; this.code = code; this.details = details; } }

export async function execute(command, args, { env, timeoutMs = 25000, input } = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", settled = false;
    const finish = (exitCode, signal) => { if (settled) return; settled = true; clearTimeout(timer); resolve({ exitCode, signal, stdout, stderr }); };
    const timer = setTimeout(() => { child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 1000).unref(); finish(124, "TIMEOUT"); }, timeoutMs);
    child.stdout.on("data", data => { stdout += data; });
    child.stderr.on("data", data => { stderr += data; });
    child.on("error", error => { stderr += error.message; finish(127, null); });
    child.on("close", (code, signal) => finish(code ?? 1, signal));
    if (input != null) child.stdin.end(input); else child.stdin.end();
  });
}

function unwrapJson(json) {
  if (json == null) return null;
  const value = Object.hasOwn(json, "data") ? json.data : json;
  return value?.result ?? value?.value ?? value?.text ?? value?.url ?? value?.title ?? value;
}
function commandPayload(json) { return json && Object.hasOwn(json, "data") ? json.data : json; }
function assertSameOrigin(expected, actual) {
  try {
    const expectedUrl = new URL(expected), actualUrl = new URL(actual);
    if (actualUrl.protocol === "about:" || expectedUrl.origin !== actualUrl.origin) throw new Error();
  } catch { throw new BrowserError("PAGE_LOST", `Browser page changed unexpectedly: expected ${expected}, got ${actual || "empty URL"}`); }
}
function isBrowserLevelFailure(result) { return /daemon|connection|browser.*closed|target.*closed|socket|econn/i.test(`${result.stderr} ${result.stdout}`); }
function classifyCommandFailure(result, operation) {
  const text = `${result.stderr} ${result.stdout}`;
  if (result.exitCode === 124) return new BrowserError("TIMEOUT", `${operation} timed out`);
  if (/captcha|recaptcha|challenge/i.test(text)) return new BrowserError("CHALLENGE", clampText(text));
  if (/allowed.?domain|blocked/i.test(text)) return new BrowserError("RESOURCE_BLOCKED", clampText(text));
  return new BrowserError(isBrowserLevelFailure(result) ? "BROWSER_UNAVAILABLE" : "INTERNAL_ADAPTER_ERROR", clampText(text) || `${operation} failed with ${result.exitCode}`);
}
async function resolveExecutable(command, env) {
  if (isAbsolute(command)) { await access(command, constants.X_OK); return command; }
  for (const base of String(env.PATH ?? "").split(delimiter)) {
    const path = `${base}/${command}`;
    try { await access(path, constants.X_OK); return path; } catch {}
  }
  throw new BrowserError("BROWSER_UNAVAILABLE", `Executable not found: ${command}`);
}
