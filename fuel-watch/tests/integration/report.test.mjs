import test from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../../scripts/report.mjs";

test("degraded report warns that empty evidence does not mean no petrol", () => {
  const {markdown}=renderReport({fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",rankedStationKeys:[],assessments:[],sourceHealth:[{source:"yandex",status:"HTTP_ERROR"}],warnings:[],changes:[]});
  assert.match(markdown,/это не означает, что бензина нет/);
  assert.match(markdown,/могут запаздывать или быть неполными/);
});

test("report renders grades, approximate age, activity and run confidence", () => {
  const item={stationKey:"s",title:"АЗС",verdict:"AVAILABLE",confidence:"MEDIUM",observations:[{source:"gdebenz",status:"IN_STOCK",ageMinutes:10,approximate:true}],activity:[{kind:"TRANSACTIONS_RESUMED"}],productAssessments:{AI95_BASE:{verdict:"AVAILABLE",confidence:"MEDIUM",approximate:true},AI95_PREMIUM_GENERIC:{verdict:"NOT_AVAILABLE",confidence:"MEDIUM"}},availabilityRun:{basis:"FIRST_SEEN",firstObservedAt:"2026-08-30T09:50:00Z",confidence:"MEDIUM"}};
  const snapshot={fetchedAt:"2026-08-30T10:00:00Z",areaLabel:"fixture",requestedProducts:[{productKey:"AI95_BASE"},{productKey:"AI95_PREMIUM_GENERIC"}],rankedStationKeys:["s"],assessments:[item],sourceHealth:[{source:"gdebenz",status:"OK"}],warnings:[],changes:[]};
  const {markdown}=renderReport(snapshot);
  assert.match(markdown,/95: ЕСТЬ/);
  assert.match(markdown,/95\+: НЕТ/);
  assert.match(markdown,/≈10 мин/);
  assert.match(markdown,/активность возобновилась \(эвристика\)/);
  assert.match(markdown,/средняя/);
});
