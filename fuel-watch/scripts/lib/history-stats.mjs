import { petrolOctaneKey } from "./fuels.mjs";
import { aggregateIdentityStations, forEachHistoryDay, isConfirmedPositive } from "./history.mjs";

const NEGATIVE = "NOT_AVAILABLE";
const POSITIVE = new Set(["AVAILABLE", "LIKELY_AVAILABLE"]);
const ARRIVAL_STATUSES = new Set(["IN_STOCK", "LIMITED"]);
// Reports of one delivery by several sources or users within this gap are one arrival, as in the forecast's
// source timeline (max(resumeWindowMinutes, 2 × quietGapMinutes) with the default config).
const DEFAULT_ARRIVAL_CLUSTER_MINUTES = 120;
const TIMELINE_ROWS = 60;
const VERDICT_LABELS = { AVAILABLE: "ЕСТЬ", LIKELY_AVAILABLE: "СКОРЕЕ ЕСТЬ", NOT_AVAILABLE: "НЕТ" };
const CONFIDENCE_LABELS = { LOW: "низкая", MEDIUM: "средняя", HIGH: "высокая" };
const MOSCOW_OFFSET_MS = 3 * 3600000;
const MIN_WINDOW_EPISODES = 3;

// Long-range AI-95 statistics per physical station over the whole retained history. Two streaming passes keep one
// day of ticks in memory: the first links station keys that ever appeared together (the same union the forecast
// uses) and finds the current area and query; the second walks each station's samples in time order.
// `timeline` adds every observation of a station (time, verdict, the sources that listed this station in that tick,
// and the sources that failed in it): the answer to "did the data show it at the time?". With `station` the rows are
// kept only for the stations that match it, so a 90-day timeline stays small.
export async function computeHistoryStats(path, { intervalMinutes, days, station, timeline = false, arrivalClusterMinutes = DEFAULT_ARRIVAL_CLUSTER_MINUTES, nowMs = Date.now() } = {}) {
  if (!(intervalMinutes > 0)) throw new Error("intervalMinutes is required");
  const sinceMs = Number.isFinite(days) ? nowMs - days * 86400000 : -Infinity;
  const gapMs = intervalMinutes * 3 * 60000;
  const identity = unionFind();
  const query = station ? String(station).toLocaleLowerCase("ru") : undefined;
  const matches = matchesQuery(query);
  const matchedTokens = new Set();
  let latest;
  const firstPass = await forEachHistoryDay(path, { sinceMs }, ticks => {
    for (const tick of ticks) {
      if (!latest || tick.fetchedAt >= latest.fetchedAt) latest = tick;
      for (const value of tick.stations ?? []) {
        const tokens = identityTokens(value);
        for (const token of tokens) identity.unite(tokens[0], token);
        if (timeline && query && matches([value.title, value.address, value.brand, ...tokens])) matchedTokens.add(tokens[0]);
      }
    }
  });
  if (!latest) return { empty: true, corruptLines: firstPass.corruptLines, intervalMinutes };
  // Every record of a station that the final filter keeps was seen here, so its identity is among these.
  const timelineIds = timeline && query ? new Set([...matchedTokens].map(token => identity.find(token))) : undefined;
  const scope = { areaHash: latest.areaHash, queryHash: latest.queryHash };
  const stations = new Map();
  const coverage = { ticks: 0, firstAt: undefined, lastAt: undefined, gaps: [], previousMs: undefined };
  const sources = new Map();
  const tickSources = new Map();
  let ticksWithHealth = 0, otherScopeTicks = 0;
  await forEachHistoryDay(path, { sinceMs }, ticks => {
    for (const tick of ticks) {
      if (tick.areaHash !== scope.areaHash || tick.queryHash !== scope.queryHash) otherScopeTicks += 1;
      if (tick.areaHash !== scope.areaHash || tick.queryHash !== scope.queryHash) continue;
      const atMs = Date.parse(tick.fetchedAt);
      if (!Number.isFinite(atMs)) continue;
      coverage.ticks += 1;
      coverage.firstAt ??= tick.fetchedAt;
      coverage.lastAt = tick.fetchedAt;
      if (coverage.previousMs !== undefined && atMs - coverage.previousMs > gapMs) coverage.gaps.push({ from: new Date(coverage.previousMs).toISOString(), to: tick.fetchedAt, minutes: Math.round((atMs - coverage.previousMs) / 60000) });
      coverage.previousMs = atMs;
      if (tick.sources) {
        ticksWithHealth += 1;
        for (const [source, status] of Object.entries(tick.sources)) { const counts = sources.get(source) ?? {}; counts[status] = (counts[status] ?? 0) + 1; sources.set(source, counts); }
        if (timeline) tickSources.set(atMs, Object.fromEntries(Object.entries(tick.sources).filter(([, status]) => status !== "OK" && status !== "DISABLED").sort(([a], [b]) => a.localeCompare(b))));
      }
      const grouped = new Map();
      for (const value of tick.stations ?? []) { const id = identity.find(identityTokens(value)[0]); grouped.set(id, [...(grouped.get(id) ?? []), value]); }
      for (const [id, members] of grouped) observe(stations, id, members, tick.fetchedAt, atMs, gapMs, Date.parse(coverage.firstAt), timeline && (!timelineIds || timelineIds.has(id)));
    }
  });
  const results = [...stations.values()]
    .filter(value => matches([value.title, value.address, value.brand, ...value.keys]))
    .map(value => ({ ...summarize(value, coverage.lastAt, arrivalClusterMinutes * 60000), ...(timeline ? { timeline: value.timeline.map(([atMs, verdict, confidence, stationSources]) => ({ at: new Date(atMs).toISOString(), verdict, confidence, stationSources, ...(tickSources.has(atMs) ? { failedSources: tickSources.get(atMs) } : {}) })) } : {}) }))
    .sort((a, b) => b.outages.count - a.outages.count || a.shares.available - b.shares.available || String(a.title).localeCompare(String(b.title), "ru"));
  const spanMs = Date.parse(coverage.lastAt) - Date.parse(coverage.firstAt);
  return {
    generatedAt: new Date(nowMs).toISOString(), intervalMinutes, ...(Number.isFinite(days) ? { days } : {}),
    period: { firstAt: coverage.firstAt, lastAt: coverage.lastAt, days: Math.round(spanMs / 86400000 * 10) / 10 },
    coverage: { ticks: coverage.ticks, expectedTicks: Math.floor(spanMs / (intervalMinutes * 60000)) + 1, otherScopeTicks, gapCount: coverage.gaps.length, longestGaps: [...coverage.gaps].sort((a, b) => b.minutes - a.minutes).slice(0, 5), corruptLines: firstPass.corruptLines },
    sources: { ticksWithHealth, statuses: Object.fromEntries([...sources].sort(([a], [b]) => a.localeCompare(b))) },
    stationCount: stations.size, matchedStationCount: results.length, stations: results
  };
}

function observe(stations, id, members, fetchedAt, atMs, gapMs, periodStartMs, timeline) {
  const state = stations.get(id) ?? { id, keys: new Set(), samples: 0, positive: 0, negative: 0, unclear: 0, episodes: [], events: new Map(), timeline: [] };
  stations.set(id, state);
  const latestMember = members[0];
  state.title = latestMember.title ?? state.title; state.address = latestMember.address ?? state.address; state.brand = latestMember.brand ?? state.brand;
  for (const value of members) for (const key of identityTokens(value)) state.keys.add(key);
  const sample = aggregateIdentityStations(members);
  const kind = isConfirmedPositive(sample) ? "positive" : sample.verdict === NEGATIVE ? "negative" : "unclear";
  state.samples += 1;
  state[kind] += 1;
  // Member keys are "<source>:<id>", so they say which sources listed this station in this tick.
  if (timeline) state.timeline.push([atMs, sample.verdict, sample.confidence, [...new Set(members.flatMap(value => (value.memberKeys ?? []).map(key => key.slice(0, key.indexOf(":")))).filter(Boolean))].sort()]);
  const gap = state.previousMs !== undefined && atMs - state.previousMs > gapMs;
  // Same episode rules as the forecast: a gap in observation ends it, a low-confidence "likely" neither ends nor
  // breaks it, and anything else that is not a confirmed positive breaks it.
  if (gap) state.negativeStart = undefined;
  if (sample.verdict === NEGATIVE) state.negativeStart ??= fetchedAt;
  else if (isConfirmedPositive(sample)) {
    if (state.negativeStart) state.episodes.push({ startedAt: state.negativeStart, restoredAt: fetchedAt, durationMinutes: (atMs - Date.parse(state.negativeStart)) / 60000 });
    state.negativeStart = undefined;
  } else if (!POSITIVE.has(sample.verdict)) state.negativeStart = undefined;
  if (gap || state.runKind !== kind) state.runStart = fetchedAt;
  state.runKind = kind;
  state.previousMs = atMs;
  state.lastAt = fetchedAt;
  state.lastVerdict = sample.verdict;
  for (const value of members) for (const event of value.activity ?? []) {
    if (!event.gradeSpecific || petrolOctaneKey(event) !== "95") continue;
    // Only what a source itself reported: adapters emit a transition for OUT_OF_STOCK → IN_STOCK and leave status
    // unset (a status, when present, must still be an arrival). TRANSACTIONS_RESUMED is our own inference from
    // reports resuming after a quiet gap, mostly the morning start of reporting, so it is not counted as an arrival.
    if (event.kind !== "SOURCE_REPORTED_TRANSITION" || !(event.status == null || ARRIVAL_STATUSES.has(event.status))) continue;
    const ms = Date.parse(event.observedAt);
    // Sources keep old reports on the page; one older than the period would be an arrival the period never saw.
    if (!Number.isFinite(ms) || ms < periodStartMs || ms > atMs + 300000) continue;
    const key = `${event.source}|${new Date(ms).toISOString()}`;
    if (!state.events.has(key)) state.events.set(key, { atMs: ms, source: event.source });
  }
}

function summarize(state, lastTickAt, clusterGapMs) {
  const durations = state.episodes.map(value => value.durationMinutes).sort((a, b) => a - b);
  const restoredMinutes = state.episodes.map(value => moscowMinute(value.restoredAt));
  const events = [];
  for (const value of [...state.events.values()].sort((a, b) => a.atMs - b.atMs)) {
    const current = events.at(-1);
    if (current && value.atMs - current.lastMs <= clusterGapMs) { current.lastMs = value.atMs; current.sources.add(value.source); current.reports += 1; }
    else events.push({ atMs: value.atMs, lastMs: value.atMs, sources: new Set([value.source]), reports: 1 });
  }
  const eventMinutes = events.map(value => moscowMinute(new Date(value.atMs).toISOString()));
  return {
    id: state.id, title: state.title, address: state.address, brand: state.brand, keys: [...state.keys].sort(),
    samples: state.samples,
    shares: { available: share(state.positive, state.samples), notAvailable: share(state.negative, state.samples), unclear: share(state.unclear, state.samples) },
    current: { visible: state.lastAt === lastTickAt, lastSeenAt: state.lastAt, verdict: state.lastVerdict, state: state.runKind, since: state.runStart },
    outages: {
      count: durations.length,
      durationMinutes: durations.length ? { p25: round(quantile(durations, 0.25)), median: round(quantile(durations, 0.5)), p75: round(quantile(durations, 0.75)), max: round(durations.at(-1)) } : undefined,
      restoredByMoscowHour: hourHistogram(restoredMinutes),
      restoredByMoscowWeekday: weekdayHistogram(state.episodes.map(value => value.restoredAt)),
      typicalRestoreWindow: restoredMinutes.length >= MIN_WINDOW_EPISODES ? circularWindow(restoredMinutes) : undefined,
      recent: state.episodes.slice(-5).map(value => ({ ...value, durationMinutes: round(value.durationMinutes) }))
    },
    sourceReportedArrivals: { count: events.length, byMoscowHour: hourHistogram(eventMinutes), typicalWindow: eventMinutes.length >= MIN_WINDOW_EPISODES ? circularWindow(eventMinutes) : undefined, recent: events.slice(-5).map(value => ({ at: new Date(value.atMs).toISOString(), sources: [...value.sources].sort(), reports: value.reports })) }
  };
}

export function renderHistoryStats(stats, { limit = 20 } = {}) {
  if (stats.empty) return "## Статистика АИ-95 по истории\n\nИстория наблюдений пока пуста: фоновый сбор ещё не записал ни одного опроса.";
  const lines = ["## Статистика АИ-95 по истории", ""];
  const { coverage, period } = stats;
  // Runs outside the timer (one-off checks, monitoring) can exceed the interval-based expectation; a ratio over
  // 100 % would be meaningless, so the count is then shown on its own.
  const polls = coverage.ticks > coverage.expectedTicks ? `${coverage.ticks} (чаще интервала ${stats.intervalMinutes} мин — были и ручные запуски)` : `${coverage.ticks} из ~${coverage.expectedTicks} ожидаемых при интервале ${stats.intervalMinutes} мин (${Math.round(coverage.ticks / Math.max(1, coverage.expectedTicks) * 100)} %)`;
  lines.push(`Период: ${moscowDateTime(period.firstAt)} – ${moscowDateTime(period.lastAt)} МСК (${period.days} дн.), опросов: ${polls}.`);
  if (coverage.gapCount) lines.push(`Пропуски сбора длиннее ${stats.intervalMinutes * 3} мин: ${coverage.gapCount}; самые длинные: ${coverage.longestGaps.slice(0, 3).map(gap => `${moscowDateTime(gap.from)} – ${moscowDateTime(gap.to)} (${duration(gap.minutes)})`).join("; ")}. Если фоновый сбор идёт по расписанию с ночной паузой (например, шесть раз в день), каждая ночь — такой пропуск, а «ожидаемых» опросов выходит больше реальных: это устройство расписания, а не сбой.`);
  if (coverage.otherScopeTicks) lines.push(`Не учтено ${coverage.otherScopeTicks} ${plural(coverage.otherScopeTicks, "опрос", "опроса", "опросов")} с другой областью или набором топлива (настройки менялись).`);
  if (coverage.corruptLines) lines.push(`Повреждённых строк истории пропущено: ${coverage.corruptLines}.`);
  if (stats.sources.ticksWithHealth) lines.push(`Источники (доля опросов со статусом OK): ${Object.entries(stats.sources.statuses).map(([source, counts]) => `${source} ${share(counts.OK ?? 0, stats.sources.ticksWithHealth)} %`).join(", ")}.`);
  lines.push("", `Время возвращения АИ-95 — момент первого опроса, увидевшего его, с точностью до интервала опроса; пропуск сбора обрывает перебой, и он не считается. Окно возвращения даётся только при ${MIN_WINDOW_EPISODES}+ перебоях.`);
  if (!stats.stations.length) { lines.push("", "Подходящих АЗС в истории нет."); return lines.join("\n"); }
  const shown = stats.stations.slice(0, limit);
  for (const value of shown) {
    lines.push("", `### ${value.title ?? value.keys[0]}${value.address ? `, ${value.address}` : ""}`);
    lines.push(`- Сейчас: ${currentText(value.current, period.lastAt)}.`);
    lines.push(`- АИ-95 был в ${value.shares.available} % опросов, не было — в ${value.shares.notAvailable} %, неясно — в ${value.shares.unclear} % (опросов: ${value.samples}).`);
    const outages = value.outages;
    if (!outages.count) lines.push("- Завершённых перебоев не наблюдалось.");
    else {
      lines.push(`- Завершённых перебоев: ${outages.count}; длительность: медиана ${duration(outages.durationMinutes.median)}, обычно ${duration(outages.durationMinutes.p25)} – ${duration(outages.durationMinutes.p75)}, максимум ${duration(outages.durationMinutes.max)}.`);
      lines.push(`- Возвращение АИ-95: ${outages.typicalRestoreWindow ? `обычно ${clock(outages.typicalRestoreWindow.start)}–${clock(outages.typicalRestoreWindow.end)} МСК (медиана ${clock(outages.typicalRestoreWindow.median)})` : `мало данных для окна (перебоев: ${outages.count})`}; по часам: ${hoursText(outages.restoredByMoscowHour)}.`);
    }
    const arrivals = value.sourceReportedArrivals;
    if (arrivals.count) lines.push(`- Источники сообщали о поступлении АИ-95: ${arrivals.count} ${plural(arrivals.count, "раз", "раза", "раз")}${arrivals.typicalWindow ? `, обычно ${clock(arrivals.typicalWindow.start)}–${clock(arrivals.typicalWindow.end)} МСК` : ""}; по часам: ${hoursText(arrivals.byMoscowHour)}.`);
    if (value.timeline) {
      const rows = value.timeline.slice(-TIMELINE_ROWS);
      lines.push(`- Хронология опросов (МСК${value.timeline.length > rows.length ? `, последние ${rows.length} из ${value.timeline.length}` : ""}):`);
      for (const row of rows) lines.push(`  - ${moscowDateTime(row.at)} — ${VERDICT_LABELS[row.verdict] ?? `неясно (${row.verdict})`}${CONFIDENCE_LABELS[row.confidence] ? `, уверенность ${CONFIDENCE_LABELS[row.confidence]}` : ""}; данные об АЗС: ${row.stationSources.join(", ") || "нет"}${row.failedSources && Object.keys(row.failedSources).length ? `; не ответили полностью: ${Object.entries(row.failedSources).map(([source, status]) => `${source} (${status})`).join(", ")}` : ""}`);
    }
  }
  if (stats.stations.length > shown.length) lines.push("", `Показано ${shown.length} из ${stats.stations.length} АЗС; остальные — с меньшим числом перебоев. Полный список: \`--json\` или \`--limit\`.`);
  return lines.join("\n");
}

function currentText(current, lastTickAt) {
  if (!current.visible) return `в последних опросах не видна (последний раз ${moscowDateTime(current.lastSeenAt)} МСК)`;
  const since = `с ${moscowDateTime(current.since)} МСК (${duration((Date.parse(lastTickAt) - Date.parse(current.since)) / 60000)})`;
  return current.state === "positive" ? `АИ-95 есть ${since}` : current.state === "negative" ? `АИ-95 нет ${since}` : `состояние неясно (${current.verdict}) ${since}`;
}

function identityTokens(station) { return [...new Set([station.stationKey, ...(station.memberKeys ?? [])].filter(Boolean))]; }
function matchesQuery(query) { return texts => !query || texts.some(text => String(text ?? "").toLocaleLowerCase("ru").includes(query)); }
function unionFind() {
  const parent = new Map();
  const find = key => { let root = key; while (parent.has(root) && parent.get(root) !== root) root = parent.get(root); while (key !== root) { const next = parent.get(key) ?? root; parent.set(key, root); key = next; } if (!parent.has(root)) parent.set(root, root); return root; };
  return { find, unite: (a, b) => { const left = find(a), right = find(b); if (left !== right) parent.set(right, left); } };
}
function plural(count, one, few, many) { const mod10 = count % 10, mod100 = count % 100; return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many; }
function share(part, total) { return total ? Math.round(part / total * 100) : 0; }
function round(value) { return Math.round(value); }
function quantile(values, q) { if (values.length === 1) return values[0]; const index = (values.length - 1) * q; const lower = Math.floor(index), upper = Math.ceil(index); return values[lower] + (values[upper] - values[lower]) * (index - lower); }
function moscowMinute(value) { const shifted = new Date(Date.parse(value) + MOSCOW_OFFSET_MS); return shifted.getUTCHours() * 60 + shifted.getUTCMinutes(); }
function hourHistogram(minutes) { const out = Array(24).fill(0); for (const value of minutes) out[Math.floor(value / 60)] += 1; return out; }
function weekdayHistogram(values) { const out = Array(7).fill(0); for (const value of values) out[(new Date(Date.parse(value) + MOSCOW_OFFSET_MS).getUTCDay() + 6) % 7] += 1; return out; }
// Times of day wrap at midnight, so the centre is the observed minute with the least circular distance to the
// others and the window is the interquartile range of offsets from it.
function circularWindow(minutes) {
  const diff = (value, center) => ((value - center + 2160) % 1440) - 720;
  const cost = center => minutes.reduce((sum, value) => sum + Math.abs(diff(value, center)), 0);
  const center = minutes.reduce((best, candidate) => cost(candidate) < cost(best) ? candidate : best, minutes[0]);
  const offsets = minutes.map(value => diff(value, center)).sort((a, b) => a - b);
  const wrap = value => ((Math.round(center + value) % 1440) + 1440) % 1440;
  return { median: wrap(quantile(offsets, 0.5)), start: wrap(quantile(offsets, 0.25)), end: wrap(quantile(offsets, 0.75)), sampleSize: minutes.length };
}
function clock(minute) { return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; }
function hoursText(histogram) { return histogram.map((count, hour) => count ? `${String(hour).padStart(2, "0")} ч — ${count}` : "").filter(Boolean).join(", "); }
function moscowDateTime(value) { const date = new Date(Date.parse(value) + MOSCOW_OFFSET_MS); const pad = number => String(number).padStart(2, "0"); return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`; }
function duration(minutes) { const total = Math.round(minutes); const days = Math.floor(total / 1440), hours = Math.floor(total % 1440 / 60), rest = total % 60; return [days ? `${days} д` : "", hours ? `${hours} ч` : "", rest || (!days && !hours) ? `${rest} мин` : ""].filter(Boolean).join(" "); }
