import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  clampText,
  uniqueId
} from "./chunk-Q2QRNGMD.mjs";

// scripts/lib/browser-runner.mjs
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join, resolve } from "node:path";
var SAFE_ENV = ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "SHELL", "USER", "LOGNAME", "XDG_RUNTIME_DIR", "DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY"];
var BrowserRunner = class {
  constructor(config, options = {}) {
    this.config = config;
    this.namespace = options.namespace ?? uniqueId("fuel-watch");
    this.namespaceHistory = [this.namespace];
    this.sessionName = options.sessionName ?? "source";
    this.command = options.command ?? config.browser.executable;
    this.exec = options.exec ?? execute;
    this.now = options.now ?? Date.now;
    this.started = false;
    this.probed = false;
    this.networkControlsStatus = "PENDING";
    this.userAgent = config.browser.userAgent || void 0;
    this.userAgentStatus = this.userAgent ? "CONFIGURED" : "BROWSER_DEFAULT";
    this.runtimeWarnings = [];
    this.cleanupWarningsByNamespace = /* @__PURE__ */ new Map([[this.namespace, []]]);
    this.expectedUrl = void 0;
    this.stateRoot = options.stateRoot ?? agentBrowserStateRoot();
    this.processControl = options.processControl ?? defaultProcessControl;
    this.observedDaemonPids = /* @__PURE__ */ new Map();
  }
  // Recorded while the session is demonstrably ours, so reaping can require that the pid left behind is the very
  // one we saw serving this namespace. Without it a recycled pid landing on another session's daemon would pass.
  async rememberDaemonPid(namespace = this.namespace) {
    if (this.observedDaemonPids.has(namespace)) return;
    const pid = await this.readDaemonPid(namespace);
    if (pid) this.observedDaemonPids.set(namespace, pid);
  }
  async readDaemonPid(namespace) {
    try {
      const pid = Number(String(await readFile(join(this.stateRoot, "namespaces", namespace, "run", `${this.sessionName}.pid`), "utf8")).trim());
      return Number.isInteger(pid) && pid > 1 && pid !== process.pid ? pid : void 0;
    } catch {
      return void 0;
    }
  }
  // agent-browser leaves a per-namespace daemon pid file and removes it on a clean close, so a pid file that
  // still names a live agent-browser process after our own close is an orphan of a namespace we created. That
  // file is the only namespace-scoped ownership evidence there is: Chrome's command line carries a random
  // user-data-dir UUID and the daemon's carries no namespace, so a scan of running browsers would also match
  // other sessions' browsers. Anything not tied to one of our namespaces is someone else's and is left alone.
  async leftoverProcesses() {
    const out = [];
    for (const namespace of this.namespaceHistory) {
      const pid = await this.readDaemonPid(namespace);
      if (!pid) continue;
      const observed = this.observedDaemonPids.get(namespace);
      if (observed !== void 0 && observed !== pid) continue;
      const command = await this.processControl.args(pid);
      if (!isAgentBrowserProcess(command)) continue;
      out.push({ namespace, sessionName: this.sessionName, pid, command: clampText(command, 200) });
    }
    return out;
  }
  async reapLeftoverProcesses({ terminate = false, graceMs = 3e3, pollMs = 150 } = {}) {
    const leftovers = await this.leftoverProcesses();
    if (!terminate) return leftovers.map((value) => ({ ...value, outcome: "REPORTED" }));
    const out = [];
    for (const leftover of leftovers) {
      const stillOurs = async () => {
        const command = await this.processControl.args(leftover.pid);
        return isAgentBrowserProcess(command) && clampText(command, 200) === leftover.command;
      };
      let outcome;
      try {
        this.processControl.terminate(leftover.pid, "SIGTERM");
        const deadline = this.now() + graceMs;
        while (this.now() < deadline && await stillOurs()) await new Promise((value) => setTimeout(value, pollMs));
        if (await stillOurs()) {
          this.processControl.terminate(leftover.pid, "SIGKILL");
          outcome = await stillOurs() ? "SURVIVED" : "KILLED";
        } else outcome = "TERMINATED";
      } catch (error) {
        outcome = `FAILED: ${error.message}`;
      }
      out.push({ ...leftover, outcome });
    }
    return out;
  }
  async probe() {
    await resolveExecutable(this.command, this.environment());
    const result = await this.commandJson(["session", "list", "--json"], { timeoutMs: 1e4 });
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
    if (attempt === 0) this.lastCommandFailure = void 0;
    const controlsRequested = !this.started && this.networkControlsStatus !== "DEGRADED";
    const networkControls = controlsRequested ? ["--allowed-domains", this.config.browser.allowedDomains.join(",")] : [];
    const result = await this.commandJson([...networkControls, "open", url, "--json"], { timeoutMs: this.config.browser.adapterTimeoutMs });
    if (result.exitCode !== 0) {
      if (attempt < 2 && controlsRequested && isNetworkControlsFailure(result)) {
        await this.degradeNetworkControls("CDP error while installing them");
        return this.open(url, attempt + 1);
      }
      if (attempt < 2 && isTransientNavigationFailure(result)) {
        if (controlsRequested && attempt > 0) await this.degradeNetworkControls(`navigation kept failing: ${navigationErrorCode(`${result.stderr} ${result.stdout}`)}`);
        else await this.freshSession();
        return this.open(url, attempt + 1);
      }
      const controlsFailure = controlsRequested ? networkControlsOpenFailure(result, attempt) : void 0;
      if (attempt < 2 && controlsFailure) {
        await this.degradeNetworkControls(controlsFailure);
        return this.open(url, attempt + 1);
      }
      if (attempt < 2 && isBrowserLevelFailure(result) && !navigationErrorCode(`${result.stderr} ${result.stdout}`)) {
        await this.freshSession();
        return this.open(url, attempt + 1);
      }
      throw this.commandFailure(result, "open");
    }
    this.started = true;
    await this.rememberDaemonPid();
    if (networkControls.length) this.networkControlsStatus = "ACTIVE";
    const opened = commandPayload(result.json);
    const reportedUrl = String(opened?.url ?? opened?.finalUrl ?? "");
    this.expectedUrl = reportedUrl || url;
    if (attempt < 2 && reportedUrl && isUnusableLandingUrl(reportedUrl)) {
      if (controlsRequested) await this.degradeNetworkControls(`open landed on ${reportedUrl}`);
      else await this.freshSession();
      return this.open(url, attempt + 1);
    }
    if (reportedUrl && !isAllowedUrl(reportedUrl, this.config.browser.allowedDomains)) {
      this.expectedUrl = url;
      if (isExternalGate(reportedUrl, this.config.browser.allowedDomains)) throw new BrowserError("CHALLENGE", `Source routed the browser through an external sign-in/verification page at ${new URL(reportedUrl).hostname}; not attempted`);
      assertAllowedLanding(reportedUrl, this.config.browser.allowedDomains);
    }
    let snapshot;
    try {
      snapshot = await this.snapshot();
    } catch (error) {
      if (attempt < 2 && controlsRequested && isNetworkControlsFailureText(error.message)) {
        await this.degradeNetworkControls("network controls lost the page's execution context");
        return this.open(url, attempt + 1);
      }
      if (attempt < 2 && error.code === "PAGE_LOST" && isUnusableLandingUrl(error.details?.actual)) {
        if (controlsRequested) await this.degradeNetworkControls(`page became ${error.details.actual || "empty"} right after open`);
        else await this.freshSession();
        return this.open(url, attempt + 1);
      }
      throw error;
    }
    return { finalUrl: snapshot.url, pageTitle: snapshot.title, pageTextPrefix: snapshot.textPrefix };
  }
  // Reached at most once per runner: afterwards controls are no longer requested. The warning is pushed even when an
  // unrelated one (the User-Agent retry) came first, so the degradation can never hide behind it.
  async degradeNetworkControls(reason = "network controls failed") {
    this.networkControlsStatus = "DEGRADED";
    this.runtimeWarnings.push(`agent-browser network controls failed (${reason}); using exact-URL navigation with fail-closed final-host and page-drift checks`);
    await this.freshSession();
  }
  // Remembered so collect can tell a failed agent-browser command apart from what the source or the adapter did.
  commandFailure(result, operation) {
    this.lastCommandFailure = classifyCommandFailure(result, operation);
    return this.lastCommandFailure;
  }
  async freshSession() {
    this.lastCommandFailure = void 0;
    await this.closeSessionBestEffort();
    this.rotateNamespace();
    this.started = false;
    this.expectedUrl = void 0;
  }
  // Some sources answer a headless-signalling User-Agent with an automation rate-limit page instead of content.
  // Reuse the real browser identity with the "Headless" token removed rather than inventing a different browser.
  async useRealisticUserAgent() {
    if (this.userAgentStatus !== "BROWSER_DEFAULT") return false;
    let reported;
    try {
      reported = String(await this.evalJsonUnchecked("navigator.userAgent") ?? "");
    } catch {
      return false;
    }
    const realistic = reported.replace(/Headless/g, "").replace(/\s{2,}/g, " ").trim();
    if (!realistic || realistic === reported) {
      this.userAgentStatus = "NOT_HEADLESS";
      return false;
    }
    this.userAgent = realistic;
    this.userAgentStatus = "DEHEADLESSED";
    this.runtimeWarnings.push(`User-Agent adjusted: browser reported a headless User-Agent and the source answered with its automation rate-limit page; retried once with the same browser identity without the "Headless" token`);
    await this.freshSession();
    return true;
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
      const probe = await this.probePage(condition.anyOfSelectors);
      last = probe;
      if (condition.urlRejectPatterns.some((pattern) => new RegExp(pattern, "i").test(probe.url))) throw new BrowserError("CHALLENGE", `Rejected URL: ${probe.url}`);
      if (probe.ready) return;
      await new Promise((resolve2) => setTimeout(resolve2, Math.min(500, deadline - Date.now())));
    }
    throw new BrowserError("TIMEOUT", `Page did not become ready: ${last?.url ?? "unknown URL"}`);
  }
  // The skill never solves, clicks through or bypasses a challenge. It only keeps the visible session open while a
  // person deals with it in the browser window, re-reads the page, and gives up when the budget runs out. Read-only
  // by construction: nothing here types, clicks or submits, and a failing read ends the wait instead of retrying.
  async awaitManualChallengeResolution({ waitMs, pollMs = 5e3, challengePattern = CHALLENGE_PATTERN } = {}) {
    const visible = async () => {
      let probe;
      try {
        probe = await this.probePage();
      } catch {
        return void 0;
      }
      return challengePattern.test(`${probe.url} ${probe.textPrefix}`);
    };
    const initial = await visible();
    if (initial === void 0) return "UNREADABLE";
    if (!initial) return "NOT_OBSERVABLE";
    const deadline = Date.now() + Math.max(0, Number(waitMs) || 0);
    while (Date.now() < deadline) {
      await new Promise((resolve2) => setTimeout(resolve2, Math.max(0, Math.min(pollMs, deadline - Date.now()))));
      const still = await visible();
      if (still === void 0) return "LOST_WHILE_HELD";
      if (!still) return "CLEARED";
    }
    return "TIMED_OUT";
  }
  // Checked on both sides: a page can navigate to another origin while the expression runs, and a value read
  // across that navigation is not trusted. This matters most without network controls.
  async evalJson(expression) {
    await this.assertCurrentPage();
    const value = await this.evalJsonUnchecked(expression);
    await this.assertCurrentPage();
    return value;
  }
  async evalJsonUnchecked(expression) {
    const result = await this.commandJson(["eval", "--stdin", "--json"], { input: expression, timeoutMs: this.config.browser.adapterTimeoutMs });
    if (result.exitCode !== 0) throw this.commandFailure(result, "eval");
    return unwrapJson(result.json);
  }
  // Readiness polling used to spend five CLI processes per iteration on url, title, text and a selector check.
  // Title, text and readiness now come from one evaluation, but the URL still comes from the browser rather than
  // from the page: an in-page location.href is page-controlled and would let a drifted page hide the drift.
  async probePage(anyOfSelectors) {
    const url = await this.commandJson(["get", "url", "--json"], { timeoutMs: 1e4 });
    if (url.exitCode !== 0) throw this.commandFailure(url, "snapshot");
    const currentUrl = String(unwrapJson(url.json) ?? "");
    if (this.expectedUrl) this.assertOnExpectedPage(currentUrl);
    const page = await this.evalJsonUnchecked(`(() => ({ pageTitle: document.title ?? "", pageText: String(document.body?.innerText ?? "").slice(0, 1000), selectorReady: ${JSON.stringify(anyOfSelectors ?? [])}.some(selector => document.querySelector(selector)) }))()`);
    return { url: currentUrl, title: String(page?.pageTitle ?? ""), textPrefix: clampText(page?.pageText, 1e3), ready: page?.selectorReady === true };
  }
  async snapshot() {
    const { url, title, textPrefix } = await this.probePage();
    return { url, title, textPrefix };
  }
  async assertCurrentPage() {
    if (!this.expectedUrl) return;
    const result = await this.commandJson(["get", "url", "--json"], { timeoutMs: 1e4 });
    if (result.exitCode !== 0) throw this.commandFailure(result, "page check");
    this.assertOnExpectedPage(String(unwrapJson(result.json) ?? ""));
  }
  // A source script can also hop to the external sign-in gate after open returned (2GIS's Sber ID redirect is
  // client-side). That is still a challenge rather than drift, and it is raised before anything on it is evaluated.
  assertOnExpectedPage(actual) {
    try {
      assertSameOrigin(this.expectedUrl, actual);
    } catch (error) {
      if (isExternalGate(actual, this.config.browser.allowedDomains)) throw new BrowserError("CHALLENGE", `Source routed the browser through an external sign-in/verification page at ${new URL(actual).hostname}; not attempted`, { actual });
      throw error;
    }
  }
  async close(cleanupDeadline = this.now() + this.config.browser.cleanupReserveMs) {
    const namespaces = [];
    const ownedNamespaces = [...new Set(this.namespaceHistory)];
    for (const [index, namespace] of ownedNamespaces.entries()) {
      const warnings = [...this.cleanupWarningsFor(namespace)];
      const namespaceCountRemaining = ownedNamespaces.length - index;
      const namespaceBudget = Math.floor(this.remainingCleanupMs(cleanupDeadline) / namespaceCountRemaining);
      const namespaceDeadline = Math.min(cleanupDeadline, this.now() + namespaceBudget);
      if (namespaceBudget <= 0) {
        warnings.push("cleanup deadline exhausted before namespace verification");
        namespaces.push({ namespace, sessionsRemaining: 1, warnings: [...new Set(warnings)] });
        continue;
      }
      await this.closeSessionBestEffort(warnings, namespace, namespaceDeadline);
      const naturalWaitDeadline = Math.min(namespaceDeadline, this.now() + Math.floor(this.remainingCleanupMs(namespaceDeadline) / 2));
      let remaining = await this.waitForNoSessions(naturalWaitDeadline, namespace);
      if (remaining > 0 && this.remainingCleanupMs(namespaceDeadline) > 0) {
        const fallback = await this.commandJson(["close", "--all", "--json"], { timeoutMs: this.remainingCleanupMs(namespaceDeadline), namespace });
        if (fallback.exitCode !== 0) warnings.push(`namespace close --all failed: ${clampText(fallback.stderr || fallback.stdout)}`);
        remaining = await this.waitForNoSessions(namespaceDeadline, namespace);
      }
      if (remaining > 0 && this.remainingCleanupMs(namespaceDeadline) <= 0) warnings.push("cleanup deadline exhausted before namespace became empty");
      if (remaining > 0) warnings.push(`${remaining} owned session(s) remain`);
      namespaces.push({ namespace, sessionsRemaining: remaining, warnings: [...new Set(warnings)] });
    }
    this.started = false;
    return { sessionsRemaining: namespaces.reduce((sum, value) => sum + value.sessionsRemaining, 0), warnings: namespaces.flatMap((value) => value.warnings.map((message) => `${value.namespace}: ${message}`)), namespaces };
  }
  cleanupWarningsFor(namespace) {
    if (!this.cleanupWarningsByNamespace.has(namespace)) this.cleanupWarningsByNamespace.set(namespace, []);
    return this.cleanupWarningsByNamespace.get(namespace);
  }
  remainingCleanupMs(deadline) {
    return Math.max(0, deadline - this.now());
  }
  async closeSessionBestEffort(warnings, namespace = this.namespace, deadline) {
    warnings ??= this.cleanupWarningsFor(namespace);
    await this.rememberDaemonPid(namespace);
    const timeoutMs = deadline == null ? this.config.browser.cleanupReserveMs : this.remainingCleanupMs(deadline);
    if (timeoutMs <= 0) {
      warnings.push("cleanup deadline exhausted before session close");
      return;
    }
    const result = await this.commandJson(["close", "--json"], { timeoutMs, namespace });
    if (result.exitCode !== 0 && !/no active|not found|not running/i.test(`${result.stderr} ${result.stdout}`)) warnings.push(`session close failed: ${clampText(result.stderr || result.stdout)}`);
  }
  async sessionsRemaining(namespace = this.namespace, deadline) {
    const timeoutMs = deadline == null ? this.config.browser.cleanupReserveMs : this.remainingCleanupMs(deadline);
    if (timeoutMs <= 0) return 1;
    const result = await this.commandJson(["session", "list", "--json"], { timeoutMs, namespace });
    if (result.exitCode !== 0) return 1;
    const value = unwrapJson(result.json);
    const sessions = Array.isArray(value) ? value : value?.sessions ?? value?.data?.sessions ?? [];
    return sessions.length;
  }
  async waitForNoSessions(deadline, namespace = this.namespace) {
    let remaining = await this.sessionsRemaining(namespace, deadline);
    while (remaining > 0 && this.now() < deadline) {
      const waitBudget = deadline - this.now();
      await new Promise((resolve2) => setTimeout(resolve2, Math.min(100, Math.max(1, Math.floor(waitBudget / 2)))));
      remaining = await this.sessionsRemaining(namespace, deadline);
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
    const userAgent = this.userAgent ? ["--user-agent", this.userAgent] : [];
    const namespace = options.namespace ?? this.namespace;
    const result = await this.exec(this.command, ["--config", this.config.browser.configPath, ...launchMode, ...userAgent, "--namespace", namespace, "--session", this.sessionName, ...args], { env: this.environment(namespace), timeoutMs: options.timeoutMs, input: options.input });
    let json;
    try {
      json = result.stdout.trim() ? JSON.parse(result.stdout) : null;
    } catch {
      json = null;
    }
    return { ...result, json };
  }
};
var BrowserError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "BrowserError";
    this.code = code;
    this.details = details;
  }
};
async function execute(command, args, { env, timeoutMs = 25e3, input } = {}) {
  return new Promise((resolve2) => {
    const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", settled = false;
    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve2({ exitCode, signal, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1e3).unref();
      finish(124, "TIMEOUT");
    }, timeoutMs);
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", (error) => {
      stderr += error.message;
      finish(127, null);
    });
    child.on("close", (code, signal) => finish(code ?? 1, signal));
    if (input != null) child.stdin.end(input);
    else child.stdin.end();
  });
}
function agentBrowserStateRoot(env = process.env) {
  return env.AGENT_BROWSER_HOME ? resolve(env.AGENT_BROWSER_HOME) : join(env.HOME || homedir(), ".agent-browser");
}
function isAgentBrowserProcess(command) {
  return String(command ?? "").trim().split(/\s+/).some((token) => /(?:^|\/)agent-browser(?:-[\w.-]+)?$/.test(token));
}
var defaultProcessControl = {
  args: (pid) => new Promise((resolvePromise) => {
    const child = spawn("ps", ["-o", "args=", "-p", String(pid)], { stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (value) => {
      stdout += value;
    });
    child.on("error", () => resolvePromise(void 0));
    child.on("close", (code) => resolvePromise(code === 0 && stdout.trim() ? stdout.trim() : void 0));
  }),
  terminate: (pid, signal) => {
    process.kill(pid, signal);
  }
};
var CHALLENGE_PATTERN = /captcha|showcaptcha|challenge|\/museum|музей\s+роботов|подтвердите,? что вы не робот|провер.{0,20}(?:робот|человек)/iu;
function unwrapJson(json) {
  if (json == null) return null;
  const value = Object.hasOwn(json, "data") ? json.data : json;
  return value?.result ?? value?.value ?? value?.text ?? value?.url ?? value?.title ?? value;
}
function commandPayload(json) {
  return json && Object.hasOwn(json, "data") ? json.data : json;
}
function assertSameOrigin(expected, actual) {
  try {
    const expectedUrl = new URL(expected), actualUrl = new URL(actual);
    if (actualUrl.protocol === "about:" || expectedUrl.origin !== actualUrl.origin) throw new Error();
  } catch {
    throw new BrowserError("PAGE_LOST", `Browser page changed unexpectedly: expected ${expected}, got ${actual || "empty URL"}`, { expected, actual: String(actual ?? "") });
  }
}
function isUnusableLandingUrl(value) {
  const text = String(value ?? "").trim();
  return text === "" || /^(?:about:|chrome-error:)/i.test(text);
}
function assertAllowedLanding(actual, allowedDomains) {
  try {
    const url = new URL(actual);
    if (!["http:", "https:"].includes(url.protocol) || !allowedDomains.some((pattern) => domainMatches(url.hostname, pattern))) throw new Error();
  } catch {
    throw new BrowserError("RESOURCE_BLOCKED", `Browser landed outside allowed domains: ${actual || "empty URL"}`);
  }
}
function domainMatches(hostname, pattern) {
  const host = hostname.toLowerCase(), allowed = pattern.toLowerCase();
  return allowed.startsWith("*.") ? host.endsWith(allowed.slice(1)) && host !== allowed.slice(2) : host === allowed;
}
function isNetworkControlsFailure(result) {
  return isNetworkControlsFailureText(`${result.stderr} ${result.stdout}`);
}
function isNetworkControlsFailureText(text) {
  return /failed to install browser network controls:[\s\S]*CDP error \((?:Runtime\.evaluate|Page\.enable)\)/i.test(String(text));
}
function networkControlsOpenFailure(result, attempt) {
  const text = `${result.stderr} ${result.stdout}`;
  if (/unknown (?:command|option|flag|argument)\b[^\n]*allowed-domains/i.test(text)) return "this agent-browser does not support --allowed-domains";
  const failure = classifyCommandFailure(result, "open");
  if (failure.code === "NAVIGATION_FAILED") return `navigation failed: ${navigationErrorCode(text)}`;
  if (failure.code === "TIMEOUT") return "open hung";
  if (attempt > 0 && isBrowserLevelFailure(result)) return "the browser kept failing";
  return void 0;
}
function isAllowedUrl(value, allowedDomains) {
  try {
    assertAllowedLanding(value, allowedDomains);
    return true;
  } catch {
    return false;
  }
}
var GATE_RETURN_PARAMS = ["redirect_uri", "return_url", "return_to", "retpath"];
function isExternalGate(value, allowedDomains) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return [...url.searchParams].some(([key, target]) => GATE_RETURN_PARAMS.includes(key.toLowerCase()) && isAllowedUrl(target, allowedDomains));
  } catch {
    return false;
  }
}
function isBrowserLevelFailure(result) {
  return /daemon|connection|failed to connect|browser.*closed|target.*closed|session with given id not found|no session with given id|cannot find default execution context|execution context.*(?:destroyed|not found)|socket|econn/i.test(`${result.stderr} ${result.stdout}`);
}
var TRANSIENT_NAVIGATION_ERRORS = /net::ERR_(?:CERT_AUTHORITY_INVALID|CERT_COMMON_NAME_INVALID|CERT_DATE_INVALID|NETWORK_CHANGED|TIMED_OUT|CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_ABORTED|EMPTY_RESPONSE|SOCKET_NOT_CONNECTED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE)\b/i;
function isTransientNavigationFailure(result) {
  const text = `${result.stderr} ${result.stdout}`;
  return /navigation failed/i.test(text) && TRANSIENT_NAVIGATION_ERRORS.test(text);
}
function navigationErrorCode(text) {
  return String(text).match(/net::(ERR_[A-Z0-9_]+)/)?.[1];
}
function classifyCommandFailure(result, operation) {
  const text = `${result.stderr} ${result.stdout}`;
  if (result.exitCode === 124 || /\boperation timed out\b/i.test(text)) return new BrowserError("TIMEOUT", `${operation} timed out`);
  if (/captcha|recaptcha|challenge/i.test(text)) return new BrowserError("CHALLENGE", clampText(text));
  if (/allowed.?domain|blocked/i.test(text)) return new BrowserError("RESOURCE_BLOCKED", clampText(text));
  const navigationError = /navigation failed/i.test(text) ? navigationErrorCode(text) : void 0;
  if (navigationError) return new BrowserError("NAVIGATION_FAILED", `${operation} could not load the page (${navigationError})`);
  return new BrowserError(isBrowserLevelFailure(result) ? "BROWSER_UNAVAILABLE" : "INTERNAL_ADAPTER_ERROR", clampText(text) || `${operation} failed with ${result.exitCode}`);
}
async function resolveExecutable(command, env) {
  if (isAbsolute(command)) {
    await access(command, constants.X_OK);
    return command;
  }
  for (const base of String(env.PATH ?? "").split(delimiter)) {
    const path = `${base}/${command}`;
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
    }
  }
  throw new BrowserError("BROWSER_UNAVAILABLE", `Executable not found: ${command}`);
}

export {
  BrowserRunner
};
