import { isCurrentPositiveObservation, isFreshActivity } from "./evidence.mjs";
import { petrolOctaneKey } from "./fuels.mjs";
import { sha256 } from "./util.mjs";
const VERDICT = { AVAILABLE: "ЕСТЬ", LIKELY_AVAILABLE: "СКОРЕЕ ЕСТЬ", CONFLICTING: "ПРОТИВОРЕЧИВО", INDIRECT: "КОСВЕННО", NOT_AVAILABLE: "НЕТ", NO_FRESH_DATA: "НЕТ СВЕЖИХ ДАННЫХ" };
const CONFIDENCE = { HIGH: "высокая", MEDIUM: "средняя", LOW: "низкая", NONE: "нет" };

export function renderReport(snapshot, { monitorId, generation = 0, recovered = false, compact = false } = {}) {
  const snapshotHash = sha256(snapshot);
  const reportId = monitorId ? sha256(`${monitorId}${generation}${snapshotHash}`) : sha256(snapshotHash);
  const ranked = snapshot.rankedStationKeys.map(key => snapshot.assessments.find(a => a.stationKey === key)).filter(Boolean);
  const lines = [`## Наличие АИ-95 — ${formatTime(snapshot.fetchedAt)}`, `Зона: ${snapshot.areaLabel}. Настроенные варианты и брендовые названия объединены в АИ-95.`, "", `Браузер: ${snapshot.runtime?.browserMode ?? "режим неизвестен"}. Источники: ${snapshot.sourceHealth.map(healthText).join("; ")}.`];
  lines.push(sourceAvailabilityText(snapshot));
  if (recovered) lines.push(`Повтор после восстановления · reportId: ${reportId.slice(0, 12)}.`);
  for (const warning of userWarnings(snapshot.warnings)) lines.push(`⚠ ${warning}`);
  if (!compact && snapshot.changes?.length) {
    lines.push("", "Изменения:");
    for (const change of snapshot.changes) lines.push(`- ${changeText(change)}`);
  }
  lines.push("", "Куда ехать:");
  if (!ranked.length) lines.push("Свежих положительных данных нет; это не означает, что бензина нет во всей зоне.");
  for (const [index, item] of ranked.slice(0, compact ? 3 : 5).entries()) {
    lines.push(`${index + 1}. ${stationHeading(item)}`);
    lines.push(`   АИ-95: ${VERDICT[item.verdict]} · уверенность нашей оценки: ${CONFIDENCE[item.confidence]} · последний подтверждающий сигнал: ${freshnessText(item.observations)} · очередь: ${item.queue?.displayText ?? "нет данных"}${limitText(item, snapshot.fetchedAt, snapshot.freshnessPolicy)}`);
    const activity = activityText(item.activity, snapshot.fetchedAt, snapshot.freshnessPolicy);
    if (activity) lines.push(`   ${activity}`);
    lines.push(`   ${runText(item.availabilityRun, item.activity, item.verdict, snapshot.fetchedAt, snapshot.freshnessPolicy)}`);
    lines.push(`   Источники текущей оценки: ${supportingSources(item)}.`);
  }
  lines.push("", `Прогноз ближайшего появления (история ${snapshot.forecast?.retentionDays ?? 7} дней):`);
  const forecasts = snapshot.forecast?.items ?? [];
  if (!forecasts.length) lines.push("Пока недостаточно повторных наблюдений массового возобновления сигналов или подтверждённых переходов статуса; история продолжает накапливаться.");
  for (const [index, forecast] of forecasts.slice(0, 3).entries()) {
    lines.push(`${index + 1}. ${stationHeading(forecast)} — около ${formatTime(forecast.expectedAt)}`);
    lines.push(`   окно ${formatTime(forecast.windowStartAt)} — ${formatTime(forecast.windowEndAt)} · уверенность ${CONFIDENCE[forecast.confidence]} · сигнал: ${forecastSignalBasis(forecast.signalBasis)} · основа: ${forecastBasis(forecast.basis)}, ${forecast.sampleSize} эп.`);
  }
  if (forecasts.length > 0 && forecasts.length < 3) lines.push("До трёх прогнозов пока не хватает 7-дневной статистики.");
  // A station whose own grade catalogue has no AI-95 is not out of AI-95; counting it as a negative read as a shortage.
  // A live positive still wins: the catalogue is a union over only the sources that publish one, so a station we
  // can currently see selling AI-95 is never filed under "does not sell it".
  const graded = snapshot.assessments.filter(a => a.sellsRequestedFamily !== false || ["AVAILABLE", "LIKELY_AVAILABLE"].includes(a.verdict));
  const notSoldCount = snapshot.assessments.length - graded.length;
  const conflictCount = graded.filter(a => ["CONFLICTING", "INDIRECT"].includes(a.verdict)).length;
  const negativeCount = graded.filter(a => a.verdict === "NOT_AVAILABLE").length;
  const emptyCount = graded.filter(a => a.verdict === "NO_FRESH_DATA").length;
  lines.push("", `Остальные: конфликтные/косвенные — ${conflictCount}, отрицательные — ${negativeCount}, без свежих данных — ${emptyCount}${notSoldCount ? `, не продают АИ-95 — ${notSoldCount}` : ""}.`);
  lines.push("", "Данные получены из краудсорсинговых и страничных представлений, могут запаздывать или быть неполными. Перед поездкой перепроверьте ситуацию.");
  return { reportId, markdown: lines.join("\n"), diagnostics: { agentOnly: true, warnings: snapshot.warnings ?? [], sourceHealth: snapshot.sourceHealth ?? [], runtime: snapshot.runtime ?? {} } };
}

// The canonical Markdown carries only limitations that change a trip decision. Internal browser plumbing and failures
// we already recovered from belong to the structured diagnostics field instead, which is for the agent, not the user.
const TECHNICAL_WARNING_CODES = new Set(["BROWSER_NETWORK_CONTROLS_DEGRADED", "CLEANUP_FAILED", "PARTIAL_COVERAGE"]);
const USER_WARNING = {
  BROWSER_RUNTIME_FAILED: "Браузер не запустился, источники в этом прогоне не опрашивались.",
  HISTORY_UNAVAILABLE: "История за 7 дней не обновилась, поэтому прогноз появления может отсутствовать или быть хуже обычного.",
  COMPLETENESS_INVARIANT: "Один из источников отдал заметно меньше данных, чем обычно: покрытие зоны в этом прогоне неполное.",
  STATION_COUNT_REGRESSION: "Один из источников показал заметно меньше АЗС, чем обычно: часть станций могла не попасть в оценку."
};
// An unrecognised code keeps its raw wording rather than disappearing: hiding an unknown limitation is the worse failure.
function userWarnings(warnings = []) {
  return [...new Set(warnings.filter(w => !TECHNICAL_WARNING_CODES.has(w.code)).map(w => USER_WARNING[w.code] ?? `${w.code}: ${w.message}`))];
}
// Several sources may cap litres differently; the smallest known cap is the one that decides whether the trip is
// worth it. Only an observation age expires: a cap last *seen* long ago may well be gone, and letting it win the
// minimum would print it as the current cap. A cap the source says is *in force since* some date, or publishes with
// no date at all, is a current statement however old that date is — dropping those would understate the constraint,
// which is the worse error of the two. A stale-ish observation is printed with its age instead of silently.
function limitText(item, fetchedAt, freshness = {}) {
  const relevant = (item.limits ?? []).filter(limit => !limit.gradeLabel || petrolOctaneKey({ gradeLabel: limit.gradeLabel }) === "95");
  const usable = relevant.filter(limit => Number.isFinite(limit.liters) && (limit.observedAt === undefined || isFreshActivity({ observedAt: limit.observedAt }, fetchedAt, freshness)));
  if (!usable.length) return "";
  const chosen = usable.reduce((best, limit) => limit.liters < best.liters ? limit : best);
  return ` · лимит: ${chosen.liters} л${limitAgeText(chosen, fetchedAt, freshness)}`;
}
function limitAgeText(limit, fetchedAt, freshness) {
  const ageMinutes = (new Date(fetchedAt).getTime() - new Date(limit.observedAt ?? NaN).getTime()) / 60000;
  // Sources that publish a cap without a timestamp state it as current alongside their current status; the line
  // already carries the age of the confirming signal, so an invented "unknown time" note would only add noise.
  if (!Number.isFinite(ageMinutes)) return "";
  if (ageMinutes <= Number(freshness.freshMinutes ?? 0)) return "";
  return ageMinutes < 90 ? ` (${Math.max(1, Math.round(ageMinutes))} мин назад)` : ` (${Math.round(ageMinutes / 60)} ч назад)`;
}

function healthText(h) { return `${h.source}: ${h.status}${h.code && h.code !== h.status ? ` (${h.code})` : ""}`; }
const SOURCE_FAILURE = {
  CHALLENGE: "показал проверку на робота",
  HTTP_429_LIMITED: "ограничил частоту запросов",
  HTTP_ERROR_PAGE: "ответил страницей ошибки",
  HTTP_ERROR: "ответил ошибкой",
  TIMEOUT: "не ответил вовремя",
  PAGE_LOST: "страница не открылась",
  NAVIGATION_FAILED: "браузер не смог загрузить страницу",
  RESOURCE_BLOCKED: "увёл за пределы разрешённых доменов",
  SCHEMA_CHANGED: "изменил структуру данных",
  NOT_ATTEMPTED: "не опрашивался из-за общего сбоя браузера",
  BROWSER_UNAVAILABLE: "браузер оказался недоступен",
  INTERNAL_ADAPTER_ERROR: "не удалось прочитать"
};
// A source counts as contributing only when it produced coverage metrics, which happens solely on a successful read.
function sourceAvailabilityText(snapshot) {
  const attempted = (snapshot.sourceHealth ?? []).filter(h => h.status !== "DISABLED");
  const contributing = attempted.filter(h => snapshot.sourceCoverage?.[h.source]);
  const unavailable = attempted.filter(h => !snapshot.sourceCoverage?.[h.source]);
  const degraded = contributing.filter(h => h.status !== "OK");
  const partialText = degraded.length ? ` Неполно ответили: ${degraded.map(h => h.source).join(", ")} — часть данных могла не попасть в оценку.` : "";
  if (!unavailable.length) return `Все ${attempted.length} источник(ов) ответили.${partialText}`;
  const reasons = unavailable.map(h => `${h.source} — ${SOURCE_FAILURE[h.code] ?? SOURCE_FAILURE[h.status] ?? "не ответил"}`).join("; ");
  if (!contributing.length) return `Недоступны все источники: ${reasons}. Данных для оценки наличия нет; это не означает, что бензина нет.`;
  return `Недоступные источники: ${reasons}. Оценка ниже построена только по оставшимся: ${contributing.map(h => h.source).join(", ")}.${partialText}`;
}
function changeText(c) { if (c.type === "SCOPE_CHANGED") return c.message; if (c.type === "ADDED") return `${stationHeading(c.current)}: появилась в выборке`; if (c.type === "REMOVED") return `${stationHeading(c.previous)}: исчезла из выборки`; return `${stationHeading(c.current)}: ${VERDICT[c.previous.verdict]} → ${VERDICT[c.current.verdict]}${c.previous.confidence !== c.current.confidence ? `, уверенность нашей оценки ${CONFIDENCE[c.previous.confidence]} → ${CONFIDENCE[c.current.confidence]}` : ""}`; }
function stationHeading(station) { return `${station.title}${station.address ? ` · [${escapeMarkdown(station.address)}](${yandexMapsUrl(station)})` : ""}`; }
function yandexMapsUrl(station) {
  const coordinate = Array.isArray(station.coordinate) && station.coordinate.length === 2 && station.coordinate.every(Number.isFinite) ? station.coordinate : undefined;
  if (coordinate) { const point = `${coordinate[0]},${coordinate[1]}`; return `https://yandex.ru/maps/?ll=${encodeUrlComponent(point)}&z=17&pt=${encodeUrlComponent(`${point},pm2rdm`)}`; }
  return `https://yandex.ru/maps/38/volgograd/search/${encodeUrlComponent(`${station.address}, Волгоград`)}/`;
}
function escapeMarkdown(value) { return String(value).replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]"); }
function encodeUrlComponent(value) { return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }
function formatTime(value) { return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function freshnessText(observations = []) { const usable = observations.filter(isCurrentPositiveObservation); if (!usable.length) return "время неизвестно"; const freshest = [...usable].sort((a, b) => a.ageMinutes - b.ageMinutes)[0]; const min = Math.round(freshest.ageMinutes); return min < 1 ? "только что" : `${freshest.approximate ? "≈" : ""}${min} мин назад`; }
function supportingSources(item) { const values = [...new Set((item.observations ?? []).filter(isCurrentPositiveObservation).map(o => o.source))]; return values.length ? values.join(", ") : "нет свежей текущей поддержки"; }
function runText(run, activity = [], verdict, fetchedAt, freshness) {
  if (!run) {
    if (!["AVAILABLE", "LIKELY_AVAILABLE"].includes(verdict)) return "Время появления: неизвестно.";
    const sourceTransitions = sourceTransitionCluster(activity, fetchedAt, freshness);
    if (!sourceTransitions.length) return "Время появления: неизвестно.";
    const evidence = sourceTransitions.map(value => `${value.source} — около ${formatTime(value.observedAt)}`).join("; ");
    return `Переход к наличию по истории источников: ${evidence}. Уверенность времени перехода: низкая.`;
  }
  const confidence = CONFIDENCE[run.confidence] ?? "неизвестна";
  if (run.basis === "OBSERVED_TRANSITION" && run.transitionWindow) return `Появление: между ${formatTime(run.transitionWindow.after)} и ${formatTime(run.transitionWindow.atOrBefore)}. Уверенность времени перехода: ${confidence}.`;
  if (run.basis === "FIRST_SEEN" && run.verdict === "LIKELY_AVAILABLE") return `Первый вероятный сигнал: ${formatTime(run.firstObservedAt)}. Уверенность времени первого сигнала: ${confidence}.`;
  if (run.basis === "FIRST_SEEN") return `Впервые увидели в наличии: ${formatTime(run.firstObservedAt)}. Уверенность времени первого сигнала: ${confidence}.`;
  return `Наблюдаем в наличии с ${formatTime(run.firstObservedAt)}. Уверенность начала наблюдения: ${confidence}.`;
}
function sourceTransitionCluster(activity, fetchedAt, freshness) { const values = [...activity].filter(value => value.kind === "SOURCE_REPORTED_TRANSITION" && value.observedAt && isAi95Activity(value) && isFreshActivity(value, fetchedAt, freshness)).sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt)); const clusters = []; for (const value of values) { const current = clusters.at(-1); if (!current || new Date(value.observedAt) - new Date(current.at(-1).observedAt) > 120 * 60000) clusters.push([value]); else current.push(value); } return clusters.at(-1) ?? []; }
function activityText(activity = [], fetchedAt, freshness) { const current = activity.filter(value => isAi95Activity(value) && isFreshActivity(value, fetchedAt, freshness)); if (current.some(value => value.kind === "TRANSACTIONS_RESUMED")) return "Активность АИ-95: возобновилась (эвристический сигнал)."; if (current.some(value => value.kind === "TRANSACTIONS_ONGOING")) return "Активность АИ-95: продолжается (эвристический сигнал)."; return ""; }
function isAi95Activity(value) { return petrolOctaneKey(value) === "95"; }
function forecastBasis(value) { return ({ STATION: "прошлые периоды этой АЗС", BRAND: "прошлые периоды этого бренда", AREA: "прошлые периоды в зоне" })[value] ?? "история зоны"; }
function forecastSignalBasis(value) { if (value === "ROLLING_ACTIVITY") return "rolling-count сигналов по октановым маркам"; if (value === "SOURCE_ACTIVITY_TIMELINE") return "история возобновления активности у источника"; if (value === "SOURCE_REPORTED_STATUS") return "история переходов статуса у источника"; if (value === "PETROL_STATUS_PATTERN") return "синхронные переходы статусов бензиновых марок"; return "переходы АИ-95 отсутствовало → появилось"; }
