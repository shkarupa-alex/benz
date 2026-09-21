import test from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../../scripts/report.mjs";

test("degraded report warns that empty evidence does not mean no petrol", () => {
  const {markdown}=renderReport({fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],sourceHealth:[{source:"yandex",status:"HTTP_ERROR"}],warnings:[],changes:[]});
  assert.match(markdown,/это не означает, что бензина нет/);
  assert.match(markdown,/могут запаздывать или быть неполными/);
});

test("report exposes complete optional-history loss without calling current data partial", () => {
  const {markdown}=renderReport({fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],sourceHealth:[{source:"benzonavt",status:"OK",code:"ACTIVITY_HISTORY_UNAVAILABLE"}],warnings:[],changes:[]});
  assert.match(markdown,/benzonavt: OK \(ACTIVITY_HISTORY_UNAVAILABLE\)/);
  assert.doesNotMatch(markdown,/benzonavt: PARTIAL/);
});

test("report renders one octane-level assessment, approximate age, activity and run confidence", () => {
  const item={stationKey:"s",title:"АЗС",address:"ул. Рокоссовского, 175",coordinate:[44.525837,48.748086],verdict:"AVAILABLE",confidence:"MEDIUM",observations:[{source:"gdebenz",status:"IN_STOCK",ageMinutes:10,approximate:true,expired:false,product:{specificity:"FAMILY_ONLY"}}],activity:[{kind:"TRANSACTIONS_RESUMED",latestEventAt:"2026-08-30T09:55:00Z",product:{family:"AI_95",productKey:"AI95_BASE"}}],productAssessments:{AI95_BASE:{verdict:"AVAILABLE",confidence:"MEDIUM",approximate:true},AI95_PREMIUM_GENERIC:{verdict:"NOT_AVAILABLE",confidence:"MEDIUM"}},availabilityRun:{basis:"FIRST_SEEN",firstObservedAt:"2026-08-30T09:50:00Z",confidence:"MEDIUM"}};
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[{source:"gdebenz",status:"OK"}],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.equal(markdown.match(/^\s*АИ-95:/gm)?.length,1);
  assert.doesNotMatch(markdown,/^\s*95(?:\+)?\s*:/m);
  assert.match(markdown,/Настроенные варианты и брендовые названия объединены в АИ-95/);
  assert.match(markdown,/последний подтверждающий сигнал: ≈10 мин назад/);
  assert.match(markdown,/Активность АИ-95: возобновилась \(эвристический сигнал\)/);
  assert.match(markdown,/уверенность нашей оценки: средняя/);
  assert.match(markdown,/\[ул\. Рокоссовского, 175\]\(https:\/\/yandex\.ru\/maps\/\?ll=44\.525837%2C48\.748086&z=17&pt=44\.525837%2C48\.748086%2Cpm2rdm\)/);
});

test("report excludes catalog and expired observations from supporting sources", () => {
  const item={stationKey:"s",title:"АЗС",verdict:"LIKELY_AVAILABLE",confidence:"LOW",observations:[{source:"2gis",status:"IN_STOCK",ageMinutes:1,expired:false,product:{specificity:"CATALOG_ONLY"}},{source:"gdebenz",status:"IN_STOCK",ageMinutes:10,expired:false,product:{specificity:"FAMILY_ONLY"}},{source:"yandex",status:"IN_STOCK",ageMinutes:500,expired:true,product:{specificity:"EXACT_VARIANT"}}],activity:[],productAssessments:{},availabilityRun:{basis:"FIRST_SEEN",verdict:"LIKELY_AVAILABLE",firstObservedAt:"2026-08-30T09:50:00Z",confidence:"LOW"}};
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/Источники текущей оценки: gdebenz/);
  assert.doesNotMatch(markdown,/Источники текущей оценки:.*2gis/);
  assert.doesNotMatch(markdown,/Источники текущей оценки:.*yandex/);
  assert.match(markdown,/Первый вероятный сигнал/);
  assert.match(markdown,/уверенность нашей оценки: низкая · последний подтверждающий сигнал: 10 мин назад/);
  assert.doesNotMatch(markdown,/последний подтверждающий сигнал: 1 мин назад/);
});

test("report always includes the seven-day forecast section with timing and uncertainty", () => {
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],sourceHealth:[],warnings:[],changes:[],forecast:{retentionDays:7,items:[{stationKey:"s",title:"АЗС",address:"Адрес",expectedAt:"2026-08-30T12:00:00Z",windowStartAt:"2026-08-30T11:30:00Z",windowEndAt:"2026-08-30T12:30:00Z",confidence:"LOW",basis:"AREA",signalBasis:"ROLLING_ACTIVITY",sampleSize:2}]}};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/Прогноз ближайшего появления \(история 7 дней\)/);
  assert.match(markdown,/АЗС · \[Адрес\]\(https:\/\/yandex\.ru\/maps\/38\/volgograd\/search\/%D0%90%D0%B4%D1%80%D0%B5%D1%81%2C%20%D0%92%D0%BE%D0%BB%D0%B3%D0%BE%D0%B3%D1%80%D0%B0%D0%B4\/\) — около/);
  assert.match(markdown,/основа: прошлые периоды в зоне, 2 эп\./);
  assert.match(markdown,/rolling-count сигналов по октановым маркам/);
  assert.match(markdown,/До трёх прогнозов пока не хватает/);
});

test("search fallback percent-encodes markdown-significant parentheses", () => {
  const item={stationKey:"s",title:"АЗС",address:"ул. Мира (у рынка), 5",verdict:"AVAILABLE",confidence:"MEDIUM",observations:[],activity:[],productAssessments:{}};
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/\[ул\. Мира \(у рынка\), 5\]\(https:\/\/yandex\.ru\/maps\/38\/volgograd\/search\/[^\s()]*%28[^\s()]*%29[^\s()]*\/\)/);
});

test("report renders an AI-95 source-reported transition when monitor state is absent", () => {
  const item={stationKey:"s",title:"Лукойл",address:"ул. Рокоссовского, 1Р",coordinate:[44.4897613,48.7095778],verdict:"AVAILABLE",confidence:"LOW",observations:[{source:"benzonavt",status:"IN_STOCK",ageMinutes:30,expired:false,product:{family:"AI_95",specificity:"EXACT_VARIANT"}}],activity:[{source:"gdebenz",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-31T09:41:06Z",gradeLabel:"95",product:{family:"AI_95"}},{source:"2gis",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-31T10:36:58Z",gradeLabel:"95",product:{family:"AI_95"}}],productAssessments:{}};
  const snapshot={fetchedAt:"2026-08-31T11:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[{source:"gdebenz",status:"OK"}],warnings:[],changes:[],forecast:{retentionDays:7,items:[]},runtime:{browserMode:"HEADED"}};
  const markdown = renderReport(snapshot).markdown;
  assert.match(markdown,/Переход к наличию по истории источников: gdebenz — около .*12:41; 2gis — около .*13:36\. Уверенность времени перехода: низкая/);
  assert.match(markdown,/Источники текущей оценки: benzonavt\./);
});

test("report ignores stale and cross-octane activity on the AI-95 line", () => {
  const activity=[
    {source:"2gis",kind:"TRANSACTIONS_RESUMED",latestEventAt:"2026-08-31T10:55:00Z",gradeLabel:"92"},
    {source:"gdebenz",kind:"SOURCE_REPORTED_TRANSITION",observedAt:"2026-08-30T09:41:06Z",gradeLabel:"95"}
  ];
  const item={stationKey:"s",title:"АЗС",verdict:"AVAILABLE",confidence:"LOW",observations:[],activity,productAssessments:{}};
  const snapshot={fetchedAt:"2026-08-31T11:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[],freshnessPolicy:{expireMinutes:360,futureSkewSeconds:120}};
  const {markdown}=renderReport(snapshot);
  assert.doesNotMatch(markdown,/активность возобновилась/);
  assert.match(markdown,/Время появления: неизвестно/);
});

test("an unavailable source is named in plain language and the rest still carry the verdict", async () => {
  const snapshot = {
    fetchedAt: "2026-09-21T12:00:00Z",
    areaLabel: "Тестовая зона",
    freshnessPolicy: { expireMinutes: 360, futureSkewSeconds: 120 },
    runtime: { browserMode: "HEADED" },
    sourceHealth: [
      { source: "yandex", status: "HTTP_ERROR", code: "HTTP_429_LIMITED" },
      { source: "gdebenz", status: "OK" },
      { source: "2gis", status: "PARTIAL", code: "PAGE_LOST" },
      { source: "benzonavt", status: "OK" }
    ],
    sourceCoverage: { gdebenz: { stationCount: 4 }, benzonavt: { stationCount: 5 } },
    warnings: [],
    changes: [],
    assessments: [{
      stationKey: "s1", title: "Лукойл", address: "Ангарская ул., 131Б", coordinate: [44.44, 48.71],
      verdict: "AVAILABLE", confidence: "MEDIUM", activity: [], queue: { displayText: "нет данных" },
      observations: [{ source: "gdebenz", status: "IN_STOCK", product: { specificity: "FAMILY_ONLY" }, expired: false, ageMinutes: 12 }]
    }],
    rankedStationKeys: ["s1"],
    forecast: { retentionDays: 7, items: [] }
  };
  const { markdown } = renderReport(snapshot);
  assert.match(markdown, /Недоступные источники: yandex — ограничил частоту запросов; 2gis — страница не открылась\./);
  assert.match(markdown, /Оценка ниже построена только по оставшимся: gdebenz, benzonavt\./);
  assert.match(markdown, /АИ-95: ЕСТЬ/);
  assert.match(markdown, /Источники текущей оценки: gdebenz\./);
});

test("losing every source is stated without implying that there is no fuel", async () => {
  const snapshot = {
    fetchedAt: "2026-09-21T12:00:00Z",
    areaLabel: "Тестовая зона",
    freshnessPolicy: { expireMinutes: 360, futureSkewSeconds: 120 },
    runtime: { browserMode: "HEADED" },
    sourceHealth: [
      { source: "yandex", status: "CHALLENGE", code: "CHALLENGE" },
      { source: "gdebenz", status: "HTTP_ERROR", code: "HTTP_ERROR_PAGE" },
      { source: "2gis", status: "TIMEOUT", code: "TIMEOUT" },
      { source: "benzonavt", status: "PARTIAL", code: "INTERNAL_ADAPTER_ERROR" }
    ],
    sourceCoverage: {},
    warnings: [],
    changes: [],
    assessments: [],
    rankedStationKeys: [],
    forecast: { retentionDays: 7, items: [] }
  };
  const { markdown } = renderReport(snapshot);
  assert.match(markdown, /Недоступны все источники:/);
  assert.match(markdown, /это не означает, что бензина нет/);
  assert.doesNotMatch(markdown, /АИ-95: НЕТ/);
});

// The canonical Markdown is what a human reads before driving; CDP and cleanup plumbing belongs in diagnostics only.
test("recovered browser plumbing stays out of the report while unrecovered limits are stated plainly", () => {
  const snapshot={fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],sourceHealth:[{source:"gdebenz",status:"OK"}],sourceCoverage:{gdebenz:{stationCount:5}},changes:[],warnings:[
    {code:"BROWSER_NETWORK_CONTROLS_DEGRADED",message:"gdebenz: agent-browser network controls failed during adapter execution; retried once"},
    {code:"CLEANUP_FAILED",message:"1 browser session(s) remain"},
    {code:"PARTIAL_COVERAGE",message:"At least one source did not provide complete evidence."},
    {code:"HISTORY_UNAVAILABLE",message:"7-day history could not be updated (HISTORY_LOCK_TIMEOUT): timed out"}
  ]};
  const {markdown,diagnostics}=renderReport(snapshot);
  assert.doesNotMatch(markdown,/BROWSER_NETWORK_CONTROLS_DEGRADED|CDP|agent-browser|CLEANUP_FAILED|PARTIAL_COVERAGE/);
  assert.match(markdown,/⚠ История за 7 дней не обновилась/);
  assert.doesNotMatch(markdown,/HISTORY_LOCK_TIMEOUT/);
  assert.equal(diagnostics.agentOnly,true);
  assert.deepEqual(diagnostics.warnings.map(w=>w.code),["BROWSER_NETWORK_CONTROLS_DEGRADED","CLEANUP_FAILED","PARTIAL_COVERAGE","HISTORY_UNAVAILABLE"]);
});

test("an unrecognised warning keeps its wording rather than disappearing from the report", () => {
  const snapshot={fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],sourceHealth:[],changes:[],warnings:[{code:"SOMETHING_NEW",message:"an unmapped limitation"}]};
  assert.match(renderReport(snapshot).markdown,/⚠ SOMETHING_NEW: an unmapped limitation/);
});

test("report shows the tightest known litre limit for AI-95 and ignores other grades", () => {
  const item={stationKey:"s",title:"АЗС",verdict:"AVAILABLE",confidence:"MEDIUM",observations:[{source:"2gis",status:"IN_STOCK",ageMinutes:5,expired:false,product:{specificity:"EXACT_VARIANT"}}],activity:[],productAssessments:{},limits:[{gradeLabel:"AI_95",liters:40,source:"2gis"},{gradeLabel:"95",liters:20,source:"benzonavt"},{gradeLabel:"dt",liters:10,source:"benzonavt"}]};
  const snapshot={fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/очередь: нет данных · лимит: 20 л/);
});

// A litre cap is a claim about right now. An expired one taken into the minimum would be printed as the current cap.
test("an expired litre limit is dropped and an ageing one is printed with its age", () => {
  const freshnessPolicy={freshMinutes:30,recentMinutes:120,staleMinutes:240,expireMinutes:360,futureSkewSeconds:120};
  const render=limits=>{
    const item={stationKey:"s",title:"АЗС",verdict:"AVAILABLE",confidence:"MEDIUM",observations:[{source:"2gis",status:"IN_STOCK",ageMinutes:5,expired:false,product:{specificity:"EXACT_VARIANT"}}],activity:[],productAssessments:{},limits};
    return renderReport({fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[],freshnessPolicy}).markdown;
  };
  const stale=render([{gradeLabel:"95",liters:20,source:"benzonavt",observedAt:"2026-09-17T10:00:00Z"},{gradeLabel:"95",liters:40,source:"2gis",observedAt:"2026-09-21T09:50:00Z"}]);
  assert.match(stale,/лимит: 40 л/);
  assert.doesNotMatch(stale,/лимит: 20 л/,"a four-day-old cap must not win the minimum as if it were current");
  assert.doesNotMatch(stale,/40 л \(/,"a cap observed ten minutes ago needs no age note");
  const ageing=render([{gradeLabel:"95",liters:20,source:"benzonavt",observedAt:"2026-09-21T07:00:00Z"}]);
  assert.match(ageing,/лимит: 20 л \(3 ч назад\)/);
  const undated=render([{gradeLabel:"95",liters:20,source:"2gis"}]);
  assert.match(undated,/лимит: 20 л$/m,"a source that never dates its caps still shows one, without inventing an age");
  const allExpired=render([{gradeLabel:"95",liters:20,source:"benzonavt",observedAt:"2026-09-17T10:00:00Z"}]);
  assert.doesNotMatch(allExpired,/лимит/,"nothing usable means no cap is claimed at all");
});

// "In force since" is not an observation age: Benzonavt returns caps that started applying days apart in one current
// response, and all of them are being enforced. Ageing them out would print a looser cap than the station enforces.
test("a cap the source says is in force is never aged out, however old its start date", () => {
  const freshnessPolicy={freshMinutes:30,recentMinutes:120,staleMinutes:240,expireMinutes:360,futureSkewSeconds:120};
  const render=limits=>{
    const item={stationKey:"s",title:"АЗС",verdict:"AVAILABLE",confidence:"MEDIUM",observations:[{source:"2gis",status:"IN_STOCK",ageMinutes:5,expired:false,product:{specificity:"EXACT_VARIANT"}}],activity:[],productAssessments:{},limits};
    return renderReport({fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[],freshnessPolicy}).markdown;
  };
  const longStanding=render([{gradeLabel:"95",liters:20,source:"benzonavt",inForceSince:"2026-09-17T19:05:30Z"}]);
  assert.match(longStanding,/лимит: 20 л$/m,"a cap in force since four days ago is still the cap");
  const against=render([
    {gradeLabel:"95",liters:20,source:"benzonavt",inForceSince:"2026-09-20T19:05:30Z"},
    {gradeLabel:"AI_95",liters:40,source:"2gis",observedAt:"2026-09-21T09:50:00Z"}
  ]);
  assert.match(against,/лимит: 20 л/,"the tighter in-force cap must not lose to a fresher, looser one");
});

// A station whose own catalogue has no AI-95 has nothing to run out of; counting it as a negative read as a shortage.
test("a station that does not sell AI-95 is counted apart from stations that ran out", () => {
  const notSold={stationKey:"a",title:"Дизельная",verdict:"NO_FRESH_DATA",confidence:"NONE",observations:[],activity:[],productAssessments:{},assortment:["92"],sellsRequestedFamily:false};
  const ranOut={stationKey:"b",title:"АЗС",verdict:"NOT_AVAILABLE",confidence:"MEDIUM",observations:[],activity:[],productAssessments:{},assortment:["92","95"],sellsRequestedFamily:true};
  const snapshot={fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[notSold,ranOut],sourceHealth:[],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/отрицательные — 1, без свежих данных — 0, не продают АИ-95 — 1\./);
});

test("the not-sold bucket disappears when every station sells AI-95", () => {
  const item={stationKey:"b",title:"АЗС",verdict:"NOT_AVAILABLE",confidence:"MEDIUM",observations:[],activity:[],productAssessments:{},sellsRequestedFamily:true};
  const snapshot={fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[item],sourceHealth:[],warnings:[],changes:[]};
  assert.doesNotMatch(renderReport(snapshot).markdown,/не продают АИ-95/);
});

// The catalogue is a union over only the sources that publish one, so a live positive must outrank a partial catalogue.
test("a station we can currently see selling AI-95 is never filed under does not sell it", () => {
  const item={stationKey:"s",title:"АЗС",verdict:"AVAILABLE",confidence:"HIGH",observations:[{source:"yandex",status:"IN_STOCK",ageMinutes:3,expired:false,product:{specificity:"EXACT_VARIANT"}}],activity:[],productAssessments:{},assortment:["92"],sellsRequestedFamily:false};
  const snapshot={fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/АИ-95: ЕСТЬ/);
  assert.doesNotMatch(markdown,/не продают АИ-95/);
});

// A source that answered but only partly is neither "all fine" nor "unavailable"; the report must say so in Russian.
test("a source that answered incompletely is named in plain language rather than only as an enum", () => {
  const snapshot={fetchedAt:"2026-09-21T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],changes:[],warnings:[],
    sourceHealth:[{source:"gdebenz",status:"PARTIAL",code:"TRUNCATED"},{source:"2gis",status:"OK"}],
    sourceCoverage:{gdebenz:{stationCount:3},"2gis":{stationCount:9}}};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/Неполно ответили: gdebenz — часть данных могла не попасть в оценку\./);
});
