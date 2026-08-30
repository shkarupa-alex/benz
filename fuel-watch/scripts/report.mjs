#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { isCurrentPositiveObservation } from "./lib/evidence.mjs";
import { prepareMonitoringSnapshot } from "./lib/prepare.mjs";
import { readJson, sha256, stableJson } from "./lib/util.mjs";

const VERDICT = { AVAILABLE: "ЕСТЬ", LIKELY_AVAILABLE: "СКОРЕЕ ЕСТЬ", CONFLICTING: "ПРОТИВОРЕЧИВО", INDIRECT: "КОСВЕННО", NOT_AVAILABLE: "НЕТ", NO_FRESH_DATA: "НЕТ СВЕЖИХ ДАННЫХ" };
const CONFIDENCE = { HIGH: "высокая", MEDIUM: "средняя", LOW: "низкая", NONE: "нет" };

export function renderReport(snapshot, { monitorId, generation = 0, recovered = false, compact = false } = {}) {
  const snapshotHash = sha256(snapshot);
  const reportId = monitorId ? sha256(`${monitorId}${generation}${snapshotHash}`) : sha256(snapshotHash);
  const ranked = snapshot.rankedStationKeys.map(key => snapshot.assessments.find(a => a.stationKey === key)).filter(Boolean);
  const lines = [`## Наличие АИ-95 — ${formatTime(snapshot.fetchedAt)}`, `Зона: ${snapshot.areaLabel}. Запрошены базовый АИ-95 и настроенные премиальные варианты.`, "", `Браузер: ${snapshot.runtime?.browserMode ?? "режим неизвестен"}. Источники: ${snapshot.sourceHealth.map(healthText).join("; ")}.`];
  if (recovered) lines.push(`Повтор после восстановления · reportId: ${reportId.slice(0, 12)}.`);
  for (const warning of snapshot.warnings ?? []) lines.push(`⚠ ${warning.code}: ${warning.message}`);
  if (!compact && snapshot.changes?.length) {
    lines.push("", "Изменения:");
    for (const change of snapshot.changes) lines.push(`- ${changeText(change)}`);
  }
  lines.push("", "Куда ехать:");
  if (!ranked.length) lines.push("Свежих положительных данных нет; это не означает, что бензина нет во всей зоне.");
  for (const [index, item] of ranked.slice(0, compact ? 3 : 5).entries()) {
    lines.push(`${index + 1}. ${item.title}${item.address ? ` · ${item.address}` : ""}`);
    lines.push(`   АИ-95: ${VERDICT[item.verdict]} (${CONFIDENCE[item.confidence]}, ${freshnessText(item.observations)}) · очередь: ${item.queue?.displayText ?? "нет данных"}`);
    const grades = gradeText(item, snapshot.requestedProducts);
    if (grades) lines.push(`   ${grades}`);
    lines.push(`   ${activityText(item.activity)}${runText(item.availabilityRun)}источники: ${supportingSources(item)}`);
  }
  lines.push("", `Прогноз ближайшего появления (история ${snapshot.forecast?.retentionDays ?? 7} дней):`);
  const forecasts = snapshot.forecast?.items ?? [];
  if (!forecasts.length) lines.push("Пока недостаточно повторных наблюдений массового возобновления сигналов или подтверждённых переходов статуса; история продолжает накапливаться.");
  for (const [index, forecast] of forecasts.slice(0, 3).entries()) {
    lines.push(`${index + 1}. ${forecast.title}${forecast.address ? ` · ${forecast.address}` : ""} — около ${formatTime(forecast.expectedAt)}`);
    lines.push(`   окно ${formatTime(forecast.windowStartAt)} — ${formatTime(forecast.windowEndAt)} · уверенность ${CONFIDENCE[forecast.confidence]} · сигнал: ${forecastSignalBasis(forecast.signalBasis)} · основа: ${forecastBasis(forecast.basis)}, ${forecast.sampleSize} эп.`);
  }
  if (forecasts.length > 0 && forecasts.length < 3) lines.push("До трёх прогнозов пока не хватает 7-дневной статистики.");
  const conflictCount = snapshot.assessments.filter(a => ["CONFLICTING", "INDIRECT"].includes(a.verdict)).length;
  const negativeCount = snapshot.assessments.filter(a => a.verdict === "NOT_AVAILABLE").length;
  const emptyCount = snapshot.assessments.filter(a => a.verdict === "NO_FRESH_DATA").length;
  lines.push("", `Остальные: конфликтные/косвенные — ${conflictCount}, отрицательные — ${negativeCount}, без свежих данных — ${emptyCount}.`);
  lines.push("", "Данные получены из краудсорсинговых и страничных представлений, могут запаздывать или быть неполными. Перед поездкой перепроверьте ситуацию.");
  return { reportId, markdown: lines.join("\n") };
}

function healthText(h) { return `${h.source}: ${h.status}${h.code && h.code !== h.status ? ` (${h.code})` : ""}`; }
function changeText(c) { if (c.type === "SCOPE_CHANGED") return c.message; if (c.type === "ADDED") return `${c.current.title}: появилась в выборке`; if (c.type === "REMOVED") return `${c.previous.title}: исчезла из выборки`; return `${c.current.title}: ${VERDICT[c.previous.verdict]} → ${VERDICT[c.current.verdict]}${c.previous.confidence !== c.current.confidence ? `, уверенность ${CONFIDENCE[c.previous.confidence]} → ${CONFIDENCE[c.current.confidence]}` : ""}`; }
function formatTime(value) { return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function freshnessText(observations = []) { const usable = observations.filter(isCurrentPositiveObservation); if (!usable.length) return "возраст неизвестен"; const freshest = [...usable].sort((a, b) => a.ageMinutes - b.ageMinutes)[0]; const min = Math.round(freshest.ageMinutes); return `${freshest.approximate ? "≈" : ""}${min < 1 ? "только что" : `${min} мин`}`; }
function supportingSources(item) { const values = [...new Set((item.observations ?? []).filter(isCurrentPositiveObservation).map(o => o.source))]; return values.length ? values.join(", ") : "нет свежей текущей поддержки"; }
function runText(run) { if (!run) return "время появления неизвестно · "; const confidence = CONFIDENCE[run.confidence] ?? "уверенность неизвестна"; if (run.basis === "OBSERVED_TRANSITION" && run.transitionWindow) return `появился между ${formatTime(run.transitionWindow.after)} и ${formatTime(run.transitionWindow.atOrBefore)} (${confidence}) · `; if (run.basis === "FIRST_SEEN" && run.verdict === "LIKELY_AVAILABLE") return `впервые увидели вероятный сигнал ${formatTime(run.firstObservedAt)} (${confidence}) · `; if (run.basis === "FIRST_SEEN") return `впервые увидели в наличии ${formatTime(run.firstObservedAt)} (${confidence}) · `; return `наблюдаем с ${formatTime(run.firstObservedAt)} (${confidence}) · `; }
function activityText(activity = []) { if (activity.some(value => value.kind === "TRANSACTIONS_RESUMED")) return "активность возобновилась (эвристика) · "; if (activity.some(value => value.kind === "TRANSACTIONS_ONGOING")) return "активность продолжается (эвристика) · "; return ""; }
function forecastBasis(value) { return ({ STATION: "прошлые периоды этой АЗС", BRAND: "прошлые периоды этого бренда", AREA: "прошлые периоды в зоне" })[value] ?? "история зоны"; }
function forecastSignalBasis(value) { if (value === "ROLLING_ACTIVITY") return "per-grade rolling-count бензиновых сигналов"; if (value === "PETROL_STATUS_PATTERN") return "синхронные переходы статусов бензиновых марок"; return "переходы АИ-95 отсутствовало → появилось"; }
function gradeText(item, requested = []) {
  const assessments = item.productAssessments ?? {};
  const base = assessments.AI95_BASE;
  const premiums = requested.filter(product => product.productKey !== "AI95_BASE").map(product => assessments[product.productKey]).filter(Boolean);
  const premium = aggregateGrades(premiums);
  const parts = [];
  if (base) parts.push(`95: ${VERDICT[base.verdict]} (${CONFIDENCE[base.confidence]}${base.approximate ? ", ≈" : ""})`);
  if (premium) parts.push(`95+: ${VERDICT[premium.verdict]} (${CONFIDENCE[premium.confidence]}${premium.approximate ? ", ≈" : ""})`);
  return parts.join(" · ");
}
function aggregateGrades(values) { if (!values.length) return null; const order = ["AVAILABLE", "LIKELY_AVAILABLE", "CONFLICTING", "INDIRECT", "NO_FRESH_DATA", "NOT_AVAILABLE"]; const verdict = order.find(name => values.some(value => value.verdict === name)) ?? "NO_FRESH_DATA"; const matching = values.filter(value => value.verdict === verdict); const confidence = matching.sort((a, b) => ({ NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 })[b.confidence] - ({ NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 })[a.confidence])[0]?.confidence ?? "NONE"; return { verdict, confidence, approximate: matching.some(value => value.approximate) }; }

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
  process.stdout.write(args.json ? `${stableJson(result)}\n` : `${result.markdown}\n`);
}
function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i++) { const arg = argv[i]; if (["--snapshot", "--state-dir"].includes(arg)) out[arg.slice(2)] = resolve(argv[++i]); else if (["--json", "--recovered", "--compact"].includes(arg)) out[arg.slice(2)] = true; else throw new Error(`Unknown argument: ${arg}`); } return out; }
async function readStdin() { let data = ""; for await (const chunk of process.stdin) data += chunk; return data; }
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 2; });
