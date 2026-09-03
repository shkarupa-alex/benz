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
