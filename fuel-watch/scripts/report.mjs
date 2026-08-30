#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readJson, sha256, stableJson } from "./lib/util.mjs";
import { updateAvailabilityRuns } from "./lib/state.mjs";

const VERDICT = { AVAILABLE: "ЕСТЬ", LIKELY_AVAILABLE: "СКОРЕЕ ЕСТЬ", CONFLICTING: "ПРОТИВОРЕЧИВО", INDIRECT: "КОСВЕННО", NOT_AVAILABLE: "НЕТ", NO_FRESH_DATA: "НЕТ СВЕЖИХ ДАННЫХ" };
const CONFIDENCE = { HIGH: "высокая", MEDIUM: "средняя", LOW: "низкая", NONE: "нет" };

export function renderReport(snapshot, { monitorId, generation = 0, recovered = false, compact = false } = {}) {
  const snapshotHash = sha256(snapshot);
  const reportId = monitorId ? sha256(`${monitorId}${generation}${snapshotHash}`) : sha256(snapshotHash);
  const ranked = snapshot.rankedStationKeys.map(key => snapshot.assessments.find(a => a.stationKey === key)).filter(Boolean);
  const lines = [`## Наличие АИ-95 — ${formatTime(snapshot.fetchedAt)}`, `Зона: ${snapshot.areaLabel}. Запрошены базовый АИ-95 и настроенные премиальные варианты.`, "", `Источники: ${snapshot.sourceHealth.map(healthText).join("; ")}.`];
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
    lines.push(`   ${runText(item.availabilityRun)}источники: ${supportingSources(item)}`);
  }
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
function freshnessText(observations = []) { const ages = observations.map(o => o.ageMinutes).filter(Number.isFinite); if (!ages.length) return "возраст неизвестен"; const min = Math.round(Math.min(...ages)); return min < 1 ? "только что" : `${min} мин`; }
function supportingSources(item) { const values = [...new Set((item.observations ?? []).filter(o => ["IN_STOCK", "LIMITED"].includes(o.status)).map(o => o.source))]; return values.length ? values.join(", ") : "нет прямой поддержки"; }
function runText(run) { if (!run) return "время появления неизвестно · "; if (run.basis === "OBSERVED_TRANSITION" && run.transitionWindow) return `появился между ${formatTime(run.transitionWindow.after)} и ${formatTime(run.transitionWindow.atOrBefore)} (${CONFIDENCE[run.confidence] ?? "текущая уверенность"}) · `; if (run.basis === "FIRST_SEEN") return `впервые увидели в наличии ${formatTime(run.firstObservedAt)} · `; return `наблюдаем с ${formatTime(run.firstObservedAt)} · `; }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = args.snapshot ? await readJson(args.snapshot) : JSON.parse(await readStdin());
  let state;
  if (args["state-dir"]) state = await readJson(resolve(args["state-dir"], "state.json"));
  if (state) {
    const runs = updateAvailabilityRuns(state.availabilityRuns, snapshot.assessments, state.previous, snapshot.fetchedAt);
    for (const assessment of snapshot.assessments) assessment.availabilityRun = runs.find(run => run.stationKey === assessment.stationKey && run.productKey === "AI95_UNION");
  }
  const result = renderReport(snapshot, { monitorId: state?.monitorId, generation: state?.generation, recovered: args.recovered, compact: args.compact });
  process.stdout.write(args.json ? `${stableJson(result)}\n` : `${result.markdown}\n`);
}
function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i++) { const arg = argv[i]; if (["--snapshot", "--state-dir"].includes(arg)) out[arg.slice(2)] = resolve(argv[++i]); else if (["--json", "--recovered", "--compact"].includes(arg)) out[arg.slice(2)] = true; else throw new Error(`Unknown argument: ${arg}`); } return out; }
async function readStdin() { let data = ""; for await (const chunk of process.stdin) data += chunk; return data; }
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 2; });
