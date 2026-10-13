#!/usr/bin/env node
import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  aggregateIdentityStations,
  forEachHistoryDay,
  isConfirmedPositive
} from "./chunks/chunk-KNPQEARR.mjs";
import {
  historyPath,
  userConfigPath
} from "./chunks/chunk-EMN4BFNA.mjs";
import {
  defaultConfigPath,
  isMainModule,
  loadConfig,
  stableJson
} from "./chunks/chunk-VLCMFCCN.mjs";
import "./chunks/chunk-IVODUSOD.mjs";
import {
  petrolOctaneKey
} from "./chunks/chunk-XKTP5TT3.mjs";

// scripts/history-stats.mjs
import { access } from "node:fs/promises";
import { resolve } from "node:path";

// scripts/lib/history-stats.mjs
var NEGATIVE = "NOT_AVAILABLE";
var POSITIVE = /* @__PURE__ */ new Set(["AVAILABLE", "LIKELY_AVAILABLE"]);
var ARRIVAL_STATUSES = /* @__PURE__ */ new Set(["IN_STOCK", "LIMITED"]);
var DEFAULT_ARRIVAL_CLUSTER_MINUTES = 120;
var MOSCOW_OFFSET_MS = 3 * 36e5;
var MIN_WINDOW_EPISODES = 3;
async function computeHistoryStats(path, { intervalMinutes, days, station, arrivalClusterMinutes = DEFAULT_ARRIVAL_CLUSTER_MINUTES, nowMs = Date.now() } = {}) {
  if (!(intervalMinutes > 0)) throw new Error("intervalMinutes is required");
  const sinceMs = Number.isFinite(days) ? nowMs - days * 864e5 : -Infinity;
  const gapMs = intervalMinutes * 3 * 6e4;
  const identity = unionFind();
  let latest;
  const firstPass = await forEachHistoryDay(path, { sinceMs }, (ticks) => {
    for (const tick of ticks) {
      if (!latest || tick.fetchedAt >= latest.fetchedAt) latest = tick;
      for (const value of tick.stations ?? []) {
        const tokens = identityTokens(value);
        for (const token of tokens) identity.unite(tokens[0], token);
      }
    }
  });
  if (!latest) return { empty: true, corruptLines: firstPass.corruptLines, intervalMinutes };
  const scope = { areaHash: latest.areaHash, queryHash: latest.queryHash };
  const stations = /* @__PURE__ */ new Map();
  const coverage = { ticks: 0, firstAt: void 0, lastAt: void 0, gaps: [], previousMs: void 0 };
  const sources = /* @__PURE__ */ new Map();
  let ticksWithHealth = 0, otherScopeTicks = 0;
  await forEachHistoryDay(path, { sinceMs }, (ticks) => {
    for (const tick of ticks) {
      if (tick.areaHash !== scope.areaHash || tick.queryHash !== scope.queryHash) otherScopeTicks += 1;
      if (tick.areaHash !== scope.areaHash || tick.queryHash !== scope.queryHash) continue;
      const atMs = Date.parse(tick.fetchedAt);
      if (!Number.isFinite(atMs)) continue;
      coverage.ticks += 1;
      coverage.firstAt ??= tick.fetchedAt;
      coverage.lastAt = tick.fetchedAt;
      if (coverage.previousMs !== void 0 && atMs - coverage.previousMs > gapMs) coverage.gaps.push({ from: new Date(coverage.previousMs).toISOString(), to: tick.fetchedAt, minutes: Math.round((atMs - coverage.previousMs) / 6e4) });
      coverage.previousMs = atMs;
      if (tick.sources) {
        ticksWithHealth += 1;
        for (const [source, status] of Object.entries(tick.sources)) {
          const counts = sources.get(source) ?? {};
          counts[status] = (counts[status] ?? 0) + 1;
          sources.set(source, counts);
        }
      }
      const grouped = /* @__PURE__ */ new Map();
      for (const value of tick.stations ?? []) {
        const id = identity.find(identityTokens(value)[0]);
        grouped.set(id, [...grouped.get(id) ?? [], value]);
      }
      for (const [id, members] of grouped) observe(stations, id, members, tick.fetchedAt, atMs, gapMs, Date.parse(coverage.firstAt));
    }
  });
  const query = station ? String(station).toLocaleLowerCase("ru") : void 0;
  const results = [...stations.values()].filter((value) => !query || [value.title, value.address, value.brand, ...value.keys].some((text) => String(text ?? "").toLocaleLowerCase("ru").includes(query))).map((value) => summarize(value, coverage.lastAt, arrivalClusterMinutes * 6e4)).sort((a, b) => b.outages.count - a.outages.count || a.shares.available - b.shares.available || String(a.title).localeCompare(String(b.title), "ru"));
  const spanMs = Date.parse(coverage.lastAt) - Date.parse(coverage.firstAt);
  return {
    generatedAt: new Date(nowMs).toISOString(),
    intervalMinutes,
    ...Number.isFinite(days) ? { days } : {},
    period: { firstAt: coverage.firstAt, lastAt: coverage.lastAt, days: Math.round(spanMs / 864e5 * 10) / 10 },
    coverage: { ticks: coverage.ticks, expectedTicks: Math.floor(spanMs / (intervalMinutes * 6e4)) + 1, otherScopeTicks, gapCount: coverage.gaps.length, longestGaps: [...coverage.gaps].sort((a, b) => b.minutes - a.minutes).slice(0, 5), corruptLines: firstPass.corruptLines },
    sources: { ticksWithHealth, statuses: Object.fromEntries([...sources].sort(([a], [b]) => a.localeCompare(b))) },
    stationCount: stations.size,
    matchedStationCount: results.length,
    stations: results
  };
}
function observe(stations, id, members, fetchedAt, atMs, gapMs, periodStartMs) {
  const state = stations.get(id) ?? { id, keys: /* @__PURE__ */ new Set(), samples: 0, positive: 0, negative: 0, unclear: 0, episodes: [], events: /* @__PURE__ */ new Map() };
  stations.set(id, state);
  const latestMember = members[0];
  state.title = latestMember.title ?? state.title;
  state.address = latestMember.address ?? state.address;
  state.brand = latestMember.brand ?? state.brand;
  for (const value of members) for (const key of identityTokens(value)) state.keys.add(key);
  const sample = aggregateIdentityStations(members);
  const kind = isConfirmedPositive(sample) ? "positive" : sample.verdict === NEGATIVE ? "negative" : "unclear";
  state.samples += 1;
  state[kind] += 1;
  const gap = state.previousMs !== void 0 && atMs - state.previousMs > gapMs;
  if (gap) state.negativeStart = void 0;
  if (sample.verdict === NEGATIVE) state.negativeStart ??= fetchedAt;
  else if (isConfirmedPositive(sample)) {
    if (state.negativeStart) state.episodes.push({ startedAt: state.negativeStart, restoredAt: fetchedAt, durationMinutes: (atMs - Date.parse(state.negativeStart)) / 6e4 });
    state.negativeStart = void 0;
  } else if (!POSITIVE.has(sample.verdict)) state.negativeStart = void 0;
  if (gap || state.runKind !== kind) state.runStart = fetchedAt;
  state.runKind = kind;
  state.previousMs = atMs;
  state.lastAt = fetchedAt;
  state.lastVerdict = sample.verdict;
  for (const value of members) for (const event of value.activity ?? []) {
    if (!event.gradeSpecific || petrolOctaneKey(event) !== "95") continue;
    if (event.kind !== "SOURCE_REPORTED_TRANSITION" || !(event.status == null || ARRIVAL_STATUSES.has(event.status))) continue;
    const ms = Date.parse(event.observedAt);
    if (!Number.isFinite(ms) || ms < periodStartMs || ms > atMs + 3e5) continue;
    const key = `${event.source}|${new Date(ms).toISOString()}`;
    if (!state.events.has(key)) state.events.set(key, { atMs: ms, source: event.source });
  }
}
function summarize(state, lastTickAt, clusterGapMs) {
  const durations = state.episodes.map((value) => value.durationMinutes).sort((a, b) => a - b);
  const restoredMinutes = state.episodes.map((value) => moscowMinute(value.restoredAt));
  const events = [];
  for (const value of [...state.events.values()].sort((a, b) => a.atMs - b.atMs)) {
    const current = events.at(-1);
    if (current && value.atMs - current.lastMs <= clusterGapMs) {
      current.lastMs = value.atMs;
      current.sources.add(value.source);
      current.reports += 1;
    } else events.push({ atMs: value.atMs, lastMs: value.atMs, sources: /* @__PURE__ */ new Set([value.source]), reports: 1 });
  }
  const eventMinutes = events.map((value) => moscowMinute(new Date(value.atMs).toISOString()));
  return {
    id: state.id,
    title: state.title,
    address: state.address,
    brand: state.brand,
    keys: [...state.keys].sort(),
    samples: state.samples,
    shares: { available: share(state.positive, state.samples), notAvailable: share(state.negative, state.samples), unclear: share(state.unclear, state.samples) },
    current: { visible: state.lastAt === lastTickAt, lastSeenAt: state.lastAt, verdict: state.lastVerdict, state: state.runKind, since: state.runStart },
    outages: {
      count: durations.length,
      durationMinutes: durations.length ? { p25: round(quantile(durations, 0.25)), median: round(quantile(durations, 0.5)), p75: round(quantile(durations, 0.75)), max: round(durations.at(-1)) } : void 0,
      restoredByMoscowHour: hourHistogram(restoredMinutes),
      restoredByMoscowWeekday: weekdayHistogram(state.episodes.map((value) => value.restoredAt)),
      typicalRestoreWindow: restoredMinutes.length >= MIN_WINDOW_EPISODES ? circularWindow(restoredMinutes) : void 0,
      recent: state.episodes.slice(-5).map((value) => ({ ...value, durationMinutes: round(value.durationMinutes) }))
    },
    sourceReportedArrivals: { count: events.length, byMoscowHour: hourHistogram(eventMinutes), typicalWindow: eventMinutes.length >= MIN_WINDOW_EPISODES ? circularWindow(eventMinutes) : void 0, recent: events.slice(-5).map((value) => ({ at: new Date(value.atMs).toISOString(), sources: [...value.sources].sort(), reports: value.reports })) }
  };
}
function renderHistoryStats(stats, { limit = 20 } = {}) {
  if (stats.empty) return "## \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0410\u0418-95 \u043F\u043E \u0438\u0441\u0442\u043E\u0440\u0438\u0438\n\n\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0439 \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u0430: \u0444\u043E\u043D\u043E\u0432\u044B\u0439 \u0441\u0431\u043E\u0440 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043B \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u043F\u0440\u043E\u0441\u0430.";
  const lines = ["## \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0410\u0418-95 \u043F\u043E \u0438\u0441\u0442\u043E\u0440\u0438\u0438", ""];
  const { coverage, period } = stats;
  const polls = coverage.ticks > coverage.expectedTicks ? `${coverage.ticks} (\u0447\u0430\u0449\u0435 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430 ${stats.intervalMinutes} \u043C\u0438\u043D \u2014 \u0431\u044B\u043B\u0438 \u0438 \u0440\u0443\u0447\u043D\u044B\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0438)` : `${coverage.ticks} \u0438\u0437 ~${coverage.expectedTicks} \u043E\u0436\u0438\u0434\u0430\u0435\u043C\u044B\u0445 \u043F\u0440\u0438 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0435 ${stats.intervalMinutes} \u043C\u0438\u043D (${Math.round(coverage.ticks / Math.max(1, coverage.expectedTicks) * 100)} %)`;
  lines.push(`\u041F\u0435\u0440\u0438\u043E\u0434: ${moscowDateTime(period.firstAt)} \u2013 ${moscowDateTime(period.lastAt)} \u041C\u0421\u041A (${period.days} \u0434\u043D.), \u043E\u043F\u0440\u043E\u0441\u043E\u0432: ${polls}.`);
  if (coverage.gapCount) lines.push(`\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0438 \u0441\u0431\u043E\u0440\u0430 \u0434\u043B\u0438\u043D\u043D\u0435\u0435 ${stats.intervalMinutes * 3} \u043C\u0438\u043D: ${coverage.gapCount}; \u0441\u0430\u043C\u044B\u0435 \u0434\u043B\u0438\u043D\u043D\u044B\u0435: ${coverage.longestGaps.slice(0, 3).map((gap) => `${moscowDateTime(gap.from)} \u2013 ${moscowDateTime(gap.to)} (${duration(gap.minutes)})`).join("; ")}.`);
  if (coverage.otherScopeTicks) lines.push(`\u041D\u0435 \u0443\u0447\u0442\u0435\u043D\u043E ${coverage.otherScopeTicks} ${plural(coverage.otherScopeTicks, "\u043E\u043F\u0440\u043E\u0441", "\u043E\u043F\u0440\u043E\u0441\u0430", "\u043E\u043F\u0440\u043E\u0441\u043E\u0432")} \u0441 \u0434\u0440\u0443\u0433\u043E\u0439 \u043E\u0431\u043B\u0430\u0441\u0442\u044C\u044E \u0438\u043B\u0438 \u043D\u0430\u0431\u043E\u0440\u043E\u043C \u0442\u043E\u043F\u043B\u0438\u0432\u0430 (\u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043C\u0435\u043D\u044F\u043B\u0438\u0441\u044C).`);
  if (coverage.corruptLines) lines.push(`\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u0441\u0442\u0440\u043E\u043A \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E: ${coverage.corruptLines}.`);
  if (stats.sources.ticksWithHealth) lines.push(`\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 (\u0434\u043E\u043B\u044F \u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u0441\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C OK): ${Object.entries(stats.sources.statuses).map(([source, counts]) => `${source} ${share(counts.OK ?? 0, stats.sources.ticksWithHealth)} %`).join(", ")}.`);
  lines.push("", `\u0412\u0440\u0435\u043C\u044F \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u044F \u0410\u0418-95 \u2014 \u043C\u043E\u043C\u0435\u043D\u0442 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u043E\u043F\u0440\u043E\u0441\u0430, \u0443\u0432\u0438\u0434\u0435\u0432\u0448\u0435\u0433\u043E \u0435\u0433\u043E, \u0441 \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C\u044E \u0434\u043E \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430 \u043E\u043F\u0440\u043E\u0441\u0430; \u043F\u0440\u043E\u043F\u0443\u0441\u043A \u0441\u0431\u043E\u0440\u0430 \u043E\u0431\u0440\u044B\u0432\u0430\u0435\u0442 \u043F\u0435\u0440\u0435\u0431\u043E\u0439, \u0438 \u043E\u043D \u043D\u0435 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F. \u041E\u043A\u043D\u043E \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u044F \u0434\u0430\u0451\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 ${MIN_WINDOW_EPISODES}+ \u043F\u0435\u0440\u0435\u0431\u043E\u044F\u0445.`);
  if (!stats.stations.length) {
    lines.push("", "\u041F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u0410\u0417\u0421 \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u043D\u0435\u0442.");
    return lines.join("\n");
  }
  const shown = stats.stations.slice(0, limit);
  for (const value of shown) {
    lines.push("", `### ${value.title ?? value.keys[0]}${value.address ? `, ${value.address}` : ""}`);
    lines.push(`- \u0421\u0435\u0439\u0447\u0430\u0441: ${currentText(value.current, period.lastAt)}.`);
    lines.push(`- \u0410\u0418-95 \u0431\u044B\u043B \u0432 ${value.shares.available} % \u043E\u043F\u0440\u043E\u0441\u043E\u0432, \u043D\u0435 \u0431\u044B\u043B\u043E \u2014 \u0432 ${value.shares.notAvailable} %, \u043D\u0435\u044F\u0441\u043D\u043E \u2014 \u0432 ${value.shares.unclear} % (\u043E\u043F\u0440\u043E\u0441\u043E\u0432: ${value.samples}).`);
    const outages = value.outages;
    if (!outages.count) lines.push("- \u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u044B\u0445 \u043F\u0435\u0440\u0435\u0431\u043E\u0435\u0432 \u043D\u0435 \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u043B\u043E\u0441\u044C.");
    else {
      lines.push(`- \u0417\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u044B\u0445 \u043F\u0435\u0440\u0435\u0431\u043E\u0435\u0432: ${outages.count}; \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C: \u043C\u0435\u0434\u0438\u0430\u043D\u0430 ${duration(outages.durationMinutes.median)}, \u043E\u0431\u044B\u0447\u043D\u043E ${duration(outages.durationMinutes.p25)} \u2013 ${duration(outages.durationMinutes.p75)}, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${duration(outages.durationMinutes.max)}.`);
      lines.push(`- \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435 \u0410\u0418-95: ${outages.typicalRestoreWindow ? `\u043E\u0431\u044B\u0447\u043D\u043E ${clock(outages.typicalRestoreWindow.start)}\u2013${clock(outages.typicalRestoreWindow.end)} \u041C\u0421\u041A (\u043C\u0435\u0434\u0438\u0430\u043D\u0430 ${clock(outages.typicalRestoreWindow.median)})` : `\u043C\u0430\u043B\u043E \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u043E\u043A\u043D\u0430 (\u043F\u0435\u0440\u0435\u0431\u043E\u0435\u0432: ${outages.count})`}; \u043F\u043E \u0447\u0430\u0441\u0430\u043C: ${hoursText(outages.restoredByMoscowHour)}.`);
    }
    const arrivals = value.sourceReportedArrivals;
    if (arrivals.count) lines.push(`- \u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u0441\u043E\u043E\u0431\u0449\u0430\u043B\u0438 \u043E \u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0438 \u0410\u0418-95: ${arrivals.count} ${plural(arrivals.count, "\u0440\u0430\u0437", "\u0440\u0430\u0437\u0430", "\u0440\u0430\u0437")}${arrivals.typicalWindow ? `, \u043E\u0431\u044B\u0447\u043D\u043E ${clock(arrivals.typicalWindow.start)}\u2013${clock(arrivals.typicalWindow.end)} \u041C\u0421\u041A` : ""}; \u043F\u043E \u0447\u0430\u0441\u0430\u043C: ${hoursText(arrivals.byMoscowHour)}.`);
  }
  if (stats.stations.length > shown.length) lines.push("", `\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E ${shown.length} \u0438\u0437 ${stats.stations.length} \u0410\u0417\u0421; \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u2014 \u0441 \u043C\u0435\u043D\u044C\u0448\u0438\u043C \u0447\u0438\u0441\u043B\u043E\u043C \u043F\u0435\u0440\u0435\u0431\u043E\u0435\u0432. \u041F\u043E\u043B\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A: \`--json\` \u0438\u043B\u0438 \`--limit\`.`);
  return lines.join("\n");
}
function currentText(current, lastTickAt) {
  if (!current.visible) return `\u0432 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0445 \u043E\u043F\u0440\u043E\u0441\u0430\u0445 \u043D\u0435 \u0432\u0438\u0434\u043D\u0430 (\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0440\u0430\u0437 ${moscowDateTime(current.lastSeenAt)} \u041C\u0421\u041A)`;
  const since = `\u0441 ${moscowDateTime(current.since)} \u041C\u0421\u041A (${duration((Date.parse(lastTickAt) - Date.parse(current.since)) / 6e4)})`;
  return current.state === "positive" ? `\u0410\u0418-95 \u0435\u0441\u0442\u044C ${since}` : current.state === "negative" ? `\u0410\u0418-95 \u043D\u0435\u0442 ${since}` : `\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043D\u0435\u044F\u0441\u043D\u043E (${current.verdict}) ${since}`;
}
function identityTokens(station) {
  return [...new Set([station.stationKey, ...station.memberKeys ?? []].filter(Boolean))];
}
function unionFind() {
  const parent = /* @__PURE__ */ new Map();
  const find = (key) => {
    let root = key;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root);
    while (key !== root) {
      const next = parent.get(key) ?? root;
      parent.set(key, root);
      key = next;
    }
    if (!parent.has(root)) parent.set(root, root);
    return root;
  };
  return { find, unite: (a, b) => {
    const left = find(a), right = find(b);
    if (left !== right) parent.set(right, left);
  } };
}
function plural(count, one, few, many) {
  const mod10 = count % 10, mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}
function share(part, total) {
  return total ? Math.round(part / total * 100) : 0;
}
function round(value) {
  return Math.round(value);
}
function quantile(values, q) {
  if (values.length === 1) return values[0];
  const index = (values.length - 1) * q;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}
function moscowMinute(value) {
  const shifted = new Date(Date.parse(value) + MOSCOW_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}
function hourHistogram(minutes) {
  const out = Array(24).fill(0);
  for (const value of minutes) out[Math.floor(value / 60)] += 1;
  return out;
}
function weekdayHistogram(values) {
  const out = Array(7).fill(0);
  for (const value of values) out[(new Date(Date.parse(value) + MOSCOW_OFFSET_MS).getUTCDay() + 6) % 7] += 1;
  return out;
}
function circularWindow(minutes) {
  const diff = (value, center2) => (value - center2 + 2160) % 1440 - 720;
  const cost = (center2) => minutes.reduce((sum, value) => sum + Math.abs(diff(value, center2)), 0);
  const center = minutes.reduce((best, candidate) => cost(candidate) < cost(best) ? candidate : best, minutes[0]);
  const offsets = minutes.map((value) => diff(value, center)).sort((a, b) => a - b);
  const wrap = (value) => (Math.round(center + value) % 1440 + 1440) % 1440;
  return { median: wrap(quantile(offsets, 0.5)), start: wrap(quantile(offsets, 0.25)), end: wrap(quantile(offsets, 0.75)), sampleSize: minutes.length };
}
function clock(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
function hoursText(histogram) {
  return histogram.map((count, hour) => count ? `${String(hour).padStart(2, "0")} \u0447 \u2014 ${count}` : "").filter(Boolean).join(", ");
}
function moscowDateTime(value) {
  const date = new Date(Date.parse(value) + MOSCOW_OFFSET_MS);
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
function duration(minutes) {
  const total = Math.round(minutes);
  const days = Math.floor(total / 1440), hours = Math.floor(total % 1440 / 60), rest = total % 60;
  return [days ? `${days} \u0434` : "", hours ? `${hours} \u0447` : "", rest || !days && !hours ? `${rest} \u043C\u0438\u043D` : ""].filter(Boolean).join(" ");
}

// scripts/history-stats.mjs
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config ?? await access(userConfigPath()).then(() => userConfigPath(), () => defaultConfigPath);
  const config = await loadConfig(configPath);
  const stats = await computeHistoryStats(args.history ?? historyPath(), { intervalMinutes: config.monitoring.intervalMinutes, arrivalClusterMinutes: Math.max(config.activity.resumeWindowMinutes, config.activity.quietGapMinutes * 2), days: args.days, station: args.station });
  process.stdout.write(args.json ? `${stableJson(stats)}
` : `${renderHistoryStats(stats, { limit: args.limit })}
`);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--config", "--history"].includes(arg)) out[arg.slice(2)] = resolve(requireValue(argv, ++i, arg));
    else if (arg === "--station") out.station = requireValue(argv, ++i, arg);
    else if (["--days", "--limit"].includes(arg)) {
      const value = Number(requireValue(argv, ++i, arg));
      if (!Number.isInteger(value) || value < 1) throw new Error(`${arg} must be a positive integer`);
      out[arg.slice(2)] = value;
    } else if (arg === "--json") out.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}
function requireValue(argv, index, arg) {
  if (index >= argv.length) throw new Error(`${arg} requires a value`);
  return argv[index];
}
if (isMainModule(import.meta.url)) main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}
`);
  process.exitCode = 2;
});
export {
  computeHistoryStats,
  renderHistoryStats
};
