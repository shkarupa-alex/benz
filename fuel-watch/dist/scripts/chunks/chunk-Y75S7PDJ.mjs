import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  isCurrentPositiveObservation,
  isFreshActivity,
  rankAssessments
} from "./chunk-WCGSC67K.mjs";
import {
  isMainModule,
  loadConfig,
  readJson,
  sha256,
  stableJson
} from "./chunk-GQHB3NSD.mjs";
import {
  petrolOctaneKey
} from "./chunk-XKTP5TT3.mjs";

// scripts/report.mjs
import { resolve } from "node:path";

// scripts/lib/state.mjs
function updateAvailabilityRuns(previousRuns = [], assessments, previousSnapshot, fetchedAt) {
  const runs = new Map(previousRuns.map((run) => [`${run.stationKey}:${run.productKey}`, { ...run }]));
  const prior = new Map((previousSnapshot?.assessments ?? []).map((a) => [a.stationKey, a]));
  for (const assessment of assessments) {
    const productKey = "AI95_UNION";
    const key = `${assessment.stationKey}:${productKey}`;
    const currentPositive = ["AVAILABLE", "LIKELY_AVAILABLE"].includes(assessment.verdict);
    const oldVerdict = prior.get(assessment.stationKey)?.verdict;
    const old = runs.get(key);
    if (currentPositive) {
      if (old?.state === "AVAILABLE") {
        old.lastConfirmedAt = fetchedAt;
        old.confidence = assessment.confidence;
        old.negativeTicks = 0;
        runs.set(key, old);
      } else {
        const mayOpenTransition = oldVerdict === "NOT_AVAILABLE" && (assessment.verdict === "AVAILABLE" || ["MEDIUM", "HIGH"].includes(assessment.confidence));
        runs.set(key, { stationKey: assessment.stationKey, productKey, state: "AVAILABLE", verdict: assessment.verdict, confidence: assessment.confidence, firstObservedAt: fetchedAt, lastConfirmedAt: fetchedAt, transitionWindow: mayOpenTransition ? { after: previousSnapshot.fetchedAt, atOrBefore: fetchedAt } : void 0, basis: mayOpenTransition ? "OBSERVED_TRANSITION" : "FIRST_SEEN", negativeTicks: 0 });
      }
    } else if (assessment.verdict === "NOT_AVAILABLE" && old?.state === "AVAILABLE") {
      old.negativeTicks = (old.negativeTicks ?? 0) + 1;
      if (old.negativeTicks >= 2) {
        old.state = "NOT_AVAILABLE";
        old.lastConfirmedAt = fetchedAt;
      }
      runs.set(key, old);
    }
  }
  return [...runs.values()];
}

// scripts/lib/prepare.mjs
function prepareMonitoringSnapshot(state, snapshot, config) {
  const prepared = structuredClone(snapshot);
  const availabilityRuns = updateAvailabilityRuns(state.availabilityRuns, prepared.assessments, state.previous, prepared.fetchedAt);
  for (const assessment of prepared.assessments) assessment.availabilityRun = availabilityRuns.find((run) => run.stationKey === assessment.stationKey && run.productKey === "AI95_UNION");
  prepared.rankedStationKeys = rankAssessments(prepared.assessments, prepared.rankingReferencePoint, new Date(prepared.fetchedAt)).map((item) => item.stationKey);
  return { snapshot: prepared, availabilityRuns };
}

// scripts/report.mjs
var VERDICT = { AVAILABLE: "\u0415\u0421\u0422\u042C", LIKELY_AVAILABLE: "\u0421\u041A\u041E\u0420\u0415\u0415 \u0415\u0421\u0422\u042C", CONFLICTING: "\u041F\u0420\u041E\u0422\u0418\u0412\u041E\u0420\u0415\u0427\u0418\u0412\u041E", INDIRECT: "\u041A\u041E\u0421\u0412\u0415\u041D\u041D\u041E", NOT_AVAILABLE: "\u041D\u0415\u0422", NO_FRESH_DATA: "\u041D\u0415\u0422 \u0421\u0412\u0415\u0416\u0418\u0425 \u0414\u0410\u041D\u041D\u042B\u0425" };
var CONFIDENCE = { HIGH: "\u0432\u044B\u0441\u043E\u043A\u0430\u044F", MEDIUM: "\u0441\u0440\u0435\u0434\u043D\u044F\u044F", LOW: "\u043D\u0438\u0437\u043A\u0430\u044F", NONE: "\u043D\u0435\u0442" };
function renderReport(snapshot, { monitorId, generation = 0, recovered = false, compact = false } = {}) {
  const snapshotHash = sha256(snapshot);
  const reportId = monitorId ? sha256(`${monitorId}${generation}${snapshotHash}`) : sha256(snapshotHash);
  const ranked = snapshot.rankedStationKeys.map((key) => snapshot.assessments.find((a) => a.stationKey === key)).filter(Boolean);
  const lines = [`## \u041D\u0430\u043B\u0438\u0447\u0438\u0435 \u0410\u0418-95 \u2014 ${formatTime(snapshot.fetchedAt)}`, `\u0417\u043E\u043D\u0430: ${snapshot.areaLabel}. \u041D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u0438 \u0431\u0440\u0435\u043D\u0434\u043E\u0432\u044B\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0435\u043D\u044B \u0432 \u0410\u0418-95.`, "", `\u0411\u0440\u0430\u0443\u0437\u0435\u0440: ${snapshot.runtime?.browserMode ?? "\u0440\u0435\u0436\u0438\u043C \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D"}. \u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438: ${snapshot.sourceHealth.map(healthText).join("; ")}.`];
  if (recovered) lines.push(`\u041F\u043E\u0432\u0442\u043E\u0440 \u043F\u043E\u0441\u043B\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \xB7 reportId: ${reportId.slice(0, 12)}.`);
  for (const warning of snapshot.warnings ?? []) lines.push(`\u26A0 ${warning.code}: ${warning.message}`);
  if (!compact && snapshot.changes?.length) {
    lines.push("", "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F:");
    for (const change of snapshot.changes) lines.push(`- ${changeText(change)}`);
  }
  lines.push("", "\u041A\u0443\u0434\u0430 \u0435\u0445\u0430\u0442\u044C:");
  if (!ranked.length) lines.push("\u0421\u0432\u0435\u0436\u0438\u0445 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0435\u0442; \u044D\u0442\u043E \u043D\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442, \u0447\u0442\u043E \u0431\u0435\u043D\u0437\u0438\u043D\u0430 \u043D\u0435\u0442 \u0432\u043E \u0432\u0441\u0435\u0439 \u0437\u043E\u043D\u0435.");
  for (const [index, item] of ranked.slice(0, compact ? 3 : 5).entries()) {
    lines.push(`${index + 1}. ${stationHeading(item)}`);
    lines.push(`   \u0410\u0418-95: ${VERDICT[item.verdict]} \xB7 \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u043D\u0430\u0448\u0435\u0439 \u043E\u0446\u0435\u043D\u043A\u0438: ${CONFIDENCE[item.confidence]} \xB7 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044E\u0449\u0438\u0439 \u0441\u0438\u0433\u043D\u0430\u043B: ${freshnessText(item.observations)} \xB7 \u043E\u0447\u0435\u0440\u0435\u0434\u044C: ${item.queue?.displayText ?? "\u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445"}`);
    const activity = activityText(item.activity, snapshot.fetchedAt, snapshot.freshnessPolicy);
    if (activity) lines.push(`   ${activity}`);
    lines.push(`   ${runText(item.availabilityRun, item.activity, item.verdict, snapshot.fetchedAt, snapshot.freshnessPolicy)}`);
    lines.push(`   \u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043E\u0446\u0435\u043D\u043A\u0438: ${supportingSources(item)}.`);
  }
  lines.push("", `\u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0435\u0433\u043E \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F (\u0438\u0441\u0442\u043E\u0440\u0438\u044F ${snapshot.forecast?.retentionDays ?? 7} \u0434\u043D\u0435\u0439):`);
  const forecasts = snapshot.forecast?.items ?? [];
  if (!forecasts.length) lines.push("\u041F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0445 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0439 \u043C\u0430\u0441\u0441\u043E\u0432\u043E\u0433\u043E \u0432\u043E\u0437\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0438\u0433\u043D\u0430\u043B\u043E\u0432 \u0438\u043B\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u043E\u0432 \u0441\u0442\u0430\u0442\u0443\u0441\u0430; \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u0442 \u043D\u0430\u043A\u0430\u043F\u043B\u0438\u0432\u0430\u0442\u044C\u0441\u044F.");
  for (const [index, forecast] of forecasts.slice(0, 3).entries()) {
    lines.push(`${index + 1}. ${stationHeading(forecast)} \u2014 \u043E\u043A\u043E\u043B\u043E ${formatTime(forecast.expectedAt)}`);
    lines.push(`   \u043E\u043A\u043D\u043E ${formatTime(forecast.windowStartAt)} \u2014 ${formatTime(forecast.windowEndAt)} \xB7 \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C ${CONFIDENCE[forecast.confidence]} \xB7 \u0441\u0438\u0433\u043D\u0430\u043B: ${forecastSignalBasis(forecast.signalBasis)} \xB7 \u043E\u0441\u043D\u043E\u0432\u0430: ${forecastBasis(forecast.basis)}, ${forecast.sampleSize} \u044D\u043F.`);
  }
  if (forecasts.length > 0 && forecasts.length < 3) lines.push("\u0414\u043E \u0442\u0440\u0451\u0445 \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 7-\u0434\u043D\u0435\u0432\u043D\u043E\u0439 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0438.");
  const conflictCount = snapshot.assessments.filter((a) => ["CONFLICTING", "INDIRECT"].includes(a.verdict)).length;
  const negativeCount = snapshot.assessments.filter((a) => a.verdict === "NOT_AVAILABLE").length;
  const emptyCount = snapshot.assessments.filter((a) => a.verdict === "NO_FRESH_DATA").length;
  lines.push("", `\u041E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435: \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u043D\u044B\u0435/\u043A\u043E\u0441\u0432\u0435\u043D\u043D\u044B\u0435 \u2014 ${conflictCount}, \u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u2014 ${negativeCount}, \u0431\u0435\u0437 \u0441\u0432\u0435\u0436\u0438\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u2014 ${emptyCount}.`);
  lines.push("", "\u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u044B \u0438\u0437 \u043A\u0440\u0430\u0443\u0434\u0441\u043E\u0440\u0441\u0438\u043D\u0433\u043E\u0432\u044B\u0445 \u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0447\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0439, \u043C\u043E\u0433\u0443\u0442 \u0437\u0430\u043F\u0430\u0437\u0434\u044B\u0432\u0430\u0442\u044C \u0438\u043B\u0438 \u0431\u044B\u0442\u044C \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u043C\u0438. \u041F\u0435\u0440\u0435\u0434 \u043F\u043E\u0435\u0437\u0434\u043A\u043E\u0439 \u043F\u0435\u0440\u0435\u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044E.");
  return { reportId, markdown: lines.join("\n") };
}
function healthText(h) {
  return `${h.source}: ${h.status}${h.code && h.code !== h.status ? ` (${h.code})` : ""}`;
}
function changeText(c) {
  if (c.type === "SCOPE_CHANGED") return c.message;
  if (c.type === "ADDED") return `${stationHeading(c.current)}: \u043F\u043E\u044F\u0432\u0438\u043B\u0430\u0441\u044C \u0432 \u0432\u044B\u0431\u043E\u0440\u043A\u0435`;
  if (c.type === "REMOVED") return `${stationHeading(c.previous)}: \u0438\u0441\u0447\u0435\u0437\u043B\u0430 \u0438\u0437 \u0432\u044B\u0431\u043E\u0440\u043A\u0438`;
  return `${stationHeading(c.current)}: ${VERDICT[c.previous.verdict]} \u2192 ${VERDICT[c.current.verdict]}${c.previous.confidence !== c.current.confidence ? `, \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u043D\u0430\u0448\u0435\u0439 \u043E\u0446\u0435\u043D\u043A\u0438 ${CONFIDENCE[c.previous.confidence]} \u2192 ${CONFIDENCE[c.current.confidence]}` : ""}`;
}
function stationHeading(station) {
  return `${station.title}${station.address ? ` \xB7 [${escapeMarkdown(station.address)}](${yandexMapsUrl(station)})` : ""}`;
}
function yandexMapsUrl(station) {
  const coordinate = Array.isArray(station.coordinate) && station.coordinate.length === 2 && station.coordinate.every(Number.isFinite) ? station.coordinate : void 0;
  if (coordinate) {
    const point = `${coordinate[0]},${coordinate[1]}`;
    return `https://yandex.ru/maps/?ll=${encodeUrlComponent(point)}&z=17&pt=${encodeUrlComponent(`${point},pm2rdm`)}`;
  }
  return `https://yandex.ru/maps/38/volgograd/search/${encodeUrlComponent(`${station.address}, \u0412\u043E\u043B\u0433\u043E\u0433\u0440\u0430\u0434`)}/`;
}
function escapeMarkdown(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
}
function encodeUrlComponent(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
function formatTime(value) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function freshnessText(observations = []) {
  const usable = observations.filter(isCurrentPositiveObservation);
  if (!usable.length) return "\u0432\u0440\u0435\u043C\u044F \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E";
  const freshest = [...usable].sort((a, b) => a.ageMinutes - b.ageMinutes)[0];
  const min = Math.round(freshest.ageMinutes);
  return min < 1 ? "\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E" : `${freshest.approximate ? "\u2248" : ""}${min} \u043C\u0438\u043D \u043D\u0430\u0437\u0430\u0434`;
}
function supportingSources(item) {
  const values = [...new Set((item.observations ?? []).filter(isCurrentPositiveObservation).map((o) => o.source))];
  return values.length ? values.join(", ") : "\u043D\u0435\u0442 \u0441\u0432\u0435\u0436\u0435\u0439 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438";
}
function runText(run, activity = [], verdict, fetchedAt, freshness) {
  if (!run) {
    if (!["AVAILABLE", "LIKELY_AVAILABLE"].includes(verdict)) return "\u0412\u0440\u0435\u043C\u044F \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F: \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E.";
    const sourceTransitions = sourceTransitionCluster(activity, fetchedAt, freshness);
    if (!sourceTransitions.length) return "\u0412\u0440\u0435\u043C\u044F \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F: \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E.";
    const evidence = sourceTransitions.map((value) => `${value.source} \u2014 \u043E\u043A\u043E\u043B\u043E ${formatTime(value.observedAt)}`).join("; ");
    return `\u041F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u043D\u0430\u043B\u0438\u0447\u0438\u044E \u043F\u043E \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u043E\u0432: ${evidence}. \u0423\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430: \u043D\u0438\u0437\u043A\u0430\u044F.`;
  }
  const confidence = CONFIDENCE[run.confidence] ?? "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430";
  if (run.basis === "OBSERVED_TRANSITION" && run.transitionWindow) return `\u041F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u0435: \u043C\u0435\u0436\u0434\u0443 ${formatTime(run.transitionWindow.after)} \u0438 ${formatTime(run.transitionWindow.atOrBefore)}. \u0423\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430: ${confidence}.`;
  if (run.basis === "FIRST_SEEN" && run.verdict === "LIKELY_AVAILABLE") return `\u041F\u0435\u0440\u0432\u044B\u0439 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u044B\u0439 \u0441\u0438\u0433\u043D\u0430\u043B: ${formatTime(run.firstObservedAt)}. \u0423\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0441\u0438\u0433\u043D\u0430\u043B\u0430: ${confidence}.`;
  if (run.basis === "FIRST_SEEN") return `\u0412\u043F\u0435\u0440\u0432\u044B\u0435 \u0443\u0432\u0438\u0434\u0435\u043B\u0438 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438: ${formatTime(run.firstObservedAt)}. \u0423\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0441\u0438\u0433\u043D\u0430\u043B\u0430: ${confidence}.`;
  return `\u041D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u0441 ${formatTime(run.firstObservedAt)}. \u0423\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F: ${confidence}.`;
}
function sourceTransitionCluster(activity, fetchedAt, freshness) {
  const values = [...activity].filter((value) => value.kind === "SOURCE_REPORTED_TRANSITION" && value.observedAt && isAi95Activity(value) && isFreshActivity(value, fetchedAt, freshness)).sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
  const clusters = [];
  for (const value of values) {
    const current = clusters.at(-1);
    if (!current || new Date(value.observedAt) - new Date(current.at(-1).observedAt) > 120 * 6e4) clusters.push([value]);
    else current.push(value);
  }
  return clusters.at(-1) ?? [];
}
function activityText(activity = [], fetchedAt, freshness) {
  const current = activity.filter((value) => isAi95Activity(value) && isFreshActivity(value, fetchedAt, freshness));
  if (current.some((value) => value.kind === "TRANSACTIONS_RESUMED")) return "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0410\u0418-95: \u0432\u043E\u0437\u043E\u0431\u043D\u043E\u0432\u0438\u043B\u0430\u0441\u044C (\u044D\u0432\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u0438\u0433\u043D\u0430\u043B).";
  if (current.some((value) => value.kind === "TRANSACTIONS_ONGOING")) return "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0410\u0418-95: \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u0442\u0441\u044F (\u044D\u0432\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u0438\u0433\u043D\u0430\u043B).";
  return "";
}
function isAi95Activity(value) {
  return petrolOctaneKey(value) === "95";
}
function forecastBasis(value) {
  return { STATION: "\u043F\u0440\u043E\u0448\u043B\u044B\u0435 \u043F\u0435\u0440\u0438\u043E\u0434\u044B \u044D\u0442\u043E\u0439 \u0410\u0417\u0421", BRAND: "\u043F\u0440\u043E\u0448\u043B\u044B\u0435 \u043F\u0435\u0440\u0438\u043E\u0434\u044B \u044D\u0442\u043E\u0433\u043E \u0431\u0440\u0435\u043D\u0434\u0430", AREA: "\u043F\u0440\u043E\u0448\u043B\u044B\u0435 \u043F\u0435\u0440\u0438\u043E\u0434\u044B \u0432 \u0437\u043E\u043D\u0435" }[value] ?? "\u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0437\u043E\u043D\u044B";
}
function forecastSignalBasis(value) {
  if (value === "ROLLING_ACTIVITY") return "rolling-count \u0441\u0438\u0433\u043D\u0430\u043B\u043E\u0432 \u043F\u043E \u043E\u043A\u0442\u0430\u043D\u043E\u0432\u044B\u043C \u043C\u0430\u0440\u043A\u0430\u043C";
  if (value === "SOURCE_ACTIVITY_TIMELINE") return "\u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0432\u043E\u0437\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438 \u0443 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430";
  if (value === "SOURCE_REPORTED_STATUS") return "\u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u043E\u0432 \u0441\u0442\u0430\u0442\u0443\u0441\u0430 \u0443 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430";
  if (value === "PETROL_STATUS_PATTERN") return "\u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u044B\u0435 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u044B \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u0432 \u0431\u0435\u043D\u0437\u0438\u043D\u043E\u0432\u044B\u0445 \u043C\u0430\u0440\u043E\u043A";
  return "\u043F\u0435\u0440\u0435\u0445\u043E\u0434\u044B \u0410\u0418-95 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u043B\u043E \u2192 \u043F\u043E\u044F\u0432\u0438\u043B\u043E\u0441\u044C";
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  let snapshot = args.snapshot ? await readJson(args.snapshot) : JSON.parse(await readStdin());
  let state;
  if (args["state-dir"]) state = await readJson(resolve(args["state-dir"], "state.json"));
  if (state) {
    const config = await loadConfig(state.configPath);
    snapshot = prepareMonitoringSnapshot(state, snapshot, config).snapshot;
  }
  const result = renderReport(snapshot, { monitorId: state?.monitorId, generation: state?.generation, recovered: args.recovered, compact: args.compact });
  process.stdout.write(args.json ? `${stableJson(result)}
` : `${result.markdown}
`);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--snapshot", "--state-dir"].includes(arg)) out[arg.slice(2)] = resolve(argv[++i]);
    else if (["--json", "--recovered", "--compact"].includes(arg)) out[arg.slice(2)] = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}
async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}
if (isMainModule(import.meta.url)) main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}
`);
  process.exitCode = 2;
});

export {
  prepareMonitoringSnapshot,
  renderReport
};
