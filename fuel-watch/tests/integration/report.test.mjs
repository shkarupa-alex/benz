import test from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../../scripts/report.mjs";

test("degraded report warns that empty evidence does not mean no petrol", () => {
  const {markdown}=renderReport({fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],sourceHealth:[{source:"yandex",status:"HTTP_ERROR"}],warnings:[],changes:[]});
  assert.match(markdown,/это не означает, что бензина нет/);
  assert.match(markdown,/могут запаздывать или быть неполными/);
});

test("report renders grades, approximate age, activity and run confidence", () => {
  const item={stationKey:"s",title:"АЗС",address:"ул. Рокоссовского, 175",coordinate:[44.525837,48.748086],verdict:"AVAILABLE",confidence:"MEDIUM",observations:[{source:"gdebenz",status:"IN_STOCK",ageMinutes:10,approximate:true,expired:false,product:{specificity:"FAMILY_ONLY"}}],activity:[{kind:"TRANSACTIONS_RESUMED"}],productAssessments:{AI95_BASE:{verdict:"AVAILABLE",confidence:"MEDIUM",approximate:true},AI95_PREMIUM_GENERIC:{verdict:"NOT_AVAILABLE",confidence:"MEDIUM"}},availabilityRun:{basis:"FIRST_SEEN",firstObservedAt:"2026-08-30T09:50:00Z",confidence:"MEDIUM"}};
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",requestedProducts:[{productKey:"AI95_BASE"},{productKey:"AI95_PREMIUM_GENERIC"}],rankedStationKeys:["s"],assessments:[item],sourceHealth:[{source:"gdebenz",status:"OK"}],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/95: ЕСТЬ/);
  assert.match(markdown,/95\+: НЕТ/);
  assert.match(markdown,/≈10 мин/);
  assert.match(markdown,/активность возобновилась \(эвристика\)/);
  assert.match(markdown,/средняя/);
  assert.match(markdown,/\[ул\. Рокоссовского, 175\]\(https:\/\/yandex\.ru\/maps\/\?ll=44\.525837%2C48\.748086&z=17&pt=44\.525837%2C48\.748086%2Cpm2rdm\)/);
});

test("report excludes catalog and expired observations from supporting sources", () => {
  const item={stationKey:"s",title:"АЗС",verdict:"LIKELY_AVAILABLE",confidence:"LOW",observations:[{source:"2gis",status:"IN_STOCK",ageMinutes:1,expired:false,product:{specificity:"CATALOG_ONLY"}},{source:"gdebenz",status:"IN_STOCK",ageMinutes:10,expired:false,product:{specificity:"FAMILY_ONLY"}},{source:"yandex",status:"IN_STOCK",ageMinutes:500,expired:true,product:{specificity:"EXACT_VARIANT"}}],activity:[],productAssessments:{},availabilityRun:{basis:"FIRST_SEEN",verdict:"LIKELY_AVAILABLE",firstObservedAt:"2026-08-30T09:50:00Z",confidence:"LOW"}};
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",requestedProducts:[],rankedStationKeys:["s"],assessments:[item],sourceHealth:[],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/источники: gdebenz/);
  assert.doesNotMatch(markdown,/источники:.*2gis/);
  assert.doesNotMatch(markdown,/источники:.*yandex/);
  assert.match(markdown,/впервые увидели вероятный сигнал/);
  assert.match(markdown,/низкая, 10 мин/);
  assert.doesNotMatch(markdown,/низкая, 1 мин/);
});

test("report always includes the seven-day forecast section with timing and uncertainty", () => {
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",requestedProducts:[],rankedStationKeys:[],assessments:[],sourceHealth:[],warnings:[],changes:[],forecast:{retentionDays:7,items:[{stationKey:"s",title:"АЗС",address:"Адрес",expectedAt:"2026-08-30T12:00:00Z",windowStartAt:"2026-08-30T11:30:00Z",windowEndAt:"2026-08-30T12:30:00Z",confidence:"LOW",basis:"AREA",signalBasis:"ROLLING_ACTIVITY",sampleSize:2}]}};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/Прогноз ближайшего появления \(история 7 дней\)/);
  assert.match(markdown,/АЗС · \[Адрес\]\(https:\/\/yandex\.ru\/maps\/38\/volgograd\/search\/%D0%90%D0%B4%D1%80%D0%B5%D1%81%2C%20%D0%92%D0%BE%D0%BB%D0%B3%D0%BE%D0%B3%D1%80%D0%B0%D0%B4\/\) — около/);
  assert.match(markdown,/основа: прошлые периоды в зоне, 2 эп\./);
  assert.match(markdown,/per-grade rolling-count бензиновых сигналов/);
  assert.match(markdown,/До трёх прогнозов пока не хватает/);
});
