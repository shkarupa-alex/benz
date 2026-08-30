import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, isAbsolute } from "node:path";
import { clampText, uniqueId } from "./util.mjs";

const SAFE_ENV = ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "SHELL", "USER", "LOGNAME", "XDG_RUNTIME_DIR", "DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY"];

export class BrowserRunner {
  constructor(config, options = {}) {
    this.config = config;
    this.namespace = options.namespace ?? uniqueId("fuel-watch");
    this.namespaceHistory = [this.namespace];
    this.sessionName = options.sessionName ?? "source";
    this.command = options.command ?? config.browser.executable;
    this.exec = options.exec ?? execute;
    this.started = false;
    this.probed = false;
    this.networkControlsStatus = "PENDING";
    this.runtimeWarnings = [];
    this.cleanupWarningsByNamespace = new Map([[this.namespace, []]]);
    this.expectedUrl = undefined;
  }

  async probe() {
    await resolveExecutable(this.command, this.environment());
    const result = await this.commandJson(["session", "list", "--json"], { timeoutMs: 10000 });
    if (result.exitCode !== 0) throw new BrowserError("BROWSER_UNAVAILABLE", result.stderr || result.stdout);
    this.probed = true;
    return result.json;
  }

  async ensureRunSession() {
    if (!this.probed) await this.probe();
    return { namespace: this.namespace, sessionName: this.sessionName };
  }

  async open(url, attempt = 0) {
    await this.ensureRunSession();
    const networkControls = this.started || this.networkControlsStatus === "DEGRADED" ? [] : ["--allowed-domains", this.config.browser.allowedDomains.join(",")];
    const result = await this.commandJson([...networkControls, "open", url, "--json"], { timeoutMs: this.config.browser.adapterTimeoutMs });
    if (result.exitCode !== 0) {
      if (attempt < 2 && isNetworkControlsFailure(result) && this.networkControlsStatus !== "DEGRADED") {
        await this.degradeNetworkControls();
        return this.open(url, attempt + 1);
      }
      if (attempt < 2 && isBrowserLevelFailure(result)) {
        await this.closeSessionBestEffort();
        this.rotateNamespace();
        this.started = false;
        this.expectedUrl = undefined;
        return this.open(url, attempt + 1);
      }
      throw classifyCommandFailure(result, "open");
    }
    this.started = true;
    if (networkControls.length) this.networkControlsStatus = "ACTIVE";
    const opened = commandPayload(result.json);
    const reportedUrl = String(opened?.url ?? opened?.finalUrl ?? "");
    this.expectedUrl = reportedUrl || url;
    if (reportedUrl) assertAllowedLanding(reportedUrl, this.config.browser.allowedDomains);
    let snapshot;
    try {
      snapshot = await this.snapshot();
    } catch (error) {
      if (attempt < 2 && this.networkControlsStatus !== "DEGRADED" && isNetworkControlsFailureText(error.message)) {
        await this.degradeNetworkControls();
        return this.open(url, attempt + 1);
      }
      throw error;
    }
    return { finalUrl: snapshot.url, pageTitle: snapshot.title, pageTextPrefix: snapshot.textPrefix };
  }

  async degradeNetworkControls() {
    this.networkControlsStatus = "DEGRADED";
    if (!this.runtimeWarnings.length) this.runtimeWarnings.push("agent-browser network controls failed; using exact-URL navigation with fail-closed final-host and page-drift checks");
    await this.closeSessionBestEffort();
    this.rotateNamespace();
    this.started = false;
    this.expectedUrl = undefined;
  }

  rotateNamespace() {
    this.namespace = uniqueId("fuel-watch");
    this.namespaceHistory.push(this.namespace);
    this.cleanupWarningsByNamespace.set(this.namespace, []);
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
    const url = await this.commandJson(["get", "url", "--json"], { timeoutMs: 10000 });
    const title = await this.commandJson(["get", "title", "--json"], { timeoutMs: 10000 });
    const text = await this.commandJson(["get", "text", "body", "--json"], { timeoutMs: 10000 });
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
    const namespaces = [];
    for (const namespace of [...new Set(this.namespaceHistory)]) {
      const warnings = [...this.cleanupWarningsFor(namespace)];
      await this.closeSessionBestEffort(warnings, namespace);
      const startedAt = Date.now();
      let remaining = await this.waitForNoSessions(startedAt + this.config.browser.cleanupReserveMs / 2, namespace);
      if (remaining > 0) {
        const fallback = await this.commandJson(["close", "--all", "--json"], { timeoutMs: this.config.browser.cleanupReserveMs, namespace });
        if (fallback.exitCode !== 0) warnings.push(`namespace close --all failed: ${clampText(fallback.stderr || fallback.stdout)}`);
        remaining = await this.waitForNoSessions(startedAt + this.config.browser.cleanupReserveMs, namespace);
      }
      if (remaining > 0) warnings.push(`${remaining} owned session(s) remain`);
      namespaces.push({ namespace, sessionsRemaining: remaining, warnings: [...new Set(warnings)] });
    }
    this.started = false;
    return { sessionsRemaining: namespaces.reduce((sum, value) => sum + value.sessionsRemaining, 0), warnings: namespaces.flatMap(value => value.warnings.map(message => `${value.namespace}: ${message}`)), namespaces };
  }

  cleanupWarningsFor(namespace) {
    if (!this.cleanupWarningsByNamespace.has(namespace)) this.cleanupWarningsByNamespace.set(namespace, []);
    return this.cleanupWarningsByNamespace.get(namespace);
  }

  async closeSessionBestEffort(warnings, namespace = this.namespace) {
    warnings ??= this.cleanupWarningsFor(namespace);
    const result = await this.commandJson(["close", "--json"], { timeoutMs: this.config.browser.cleanupReserveMs, namespace });
    if (result.exitCode !== 0 && !/no active|not found|not running/i.test(`${result.stderr} ${result.stdout}`)) warnings.push(`session close failed: ${clampText(result.stderr || result.stdout)}`);
  }

  async sessionsRemaining(namespace = this.namespace) {
    const result = await this.commandJson(["session", "list", "--json"], { timeoutMs: this.config.browser.cleanupReserveMs, namespace });
    if (result.exitCode !== 0) return 1;
    const value = unwrapJson(result.json);
    const sessions = Array.isArray(value) ? value : value?.sessions ?? value?.data?.sessions ?? [];
    return sessions.length;
  }

  async waitForNoSessions(deadline, namespace = this.namespace) {
    let remaining = await this.sessionsRemaining(namespace);
    while (remaining > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, Math.min(100, Math.max(0, deadline - Date.now()))));
      remaining = await this.sessionsRemaining(namespace);
    }
    return remaining;
  }

  environment(namespace = this.namespace) {
    const env = {};
    for (const key of SAFE_ENV) if (process.env[key]) env[key] = process.env[key];
    env.AGENT_BROWSER_NAMESPACE = namespace;
    env.AGENT_BROWSER_SESSION = this.sessionName;
    env.AGENT_BROWSER_IDLE_TIMEOUT_MS = String(this.config.browser.idleTimeoutMs);
    return env;
  }

  async commandJson(args, options = {}) {
    const launchMode = this.config.browser.headed ? ["--headed"] : [];
    const namespace = options.namespace ?? this.namespace;
    const result = await this.exec(this.command, ["--config", this.config.browser.configPath, ...launchMode, "--namespace", namespace, "--session", this.sessionName, ...args], { env: this.environment(namespace), timeoutMs: options.timeoutMs, input: options.input });
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
function assertAllowedLanding(actual, allowedDomains) {
  try {
    const url = new URL(actual);
    if (!["http:", "https:"].includes(url.protocol) || !allowedDomains.some(pattern => domainMatches(url.hostname, pattern))) throw new Error();
  } catch { throw new BrowserError("RESOURCE_BLOCKED", `Browser landed outside allowed domains: ${actual || "empty URL"}`); }
}
function domainMatches(hostname, pattern) { const host = hostname.toLowerCase(), allowed = pattern.toLowerCase(); return allowed.startsWith("*.") ? host.endsWith(allowed.slice(1)) && host !== allowed.slice(2) : host === allowed; }
function isNetworkControlsFailure(result) { return isNetworkControlsFailureText(`${result.stderr} ${result.stdout}`); }
function isNetworkControlsFailureText(text) { return /failed to install browser network controls:[\s\S]*CDP error \((?:Runtime\.evaluate|Page\.enable)\)/i.test(String(text)); }
function isBrowserLevelFailure(result) { return /daemon|connection|failed to connect|browser.*closed|target.*closed|session with given id not found|no session with given id|cannot find default execution context|execution context.*(?:destroyed|not found)|socket|econn/i.test(`${result.stderr} ${result.stdout}`); }
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
