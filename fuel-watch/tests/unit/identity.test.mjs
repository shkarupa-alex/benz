import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../scripts/lib/config.mjs";
import { reconcileStations } from "../../scripts/lib/identity.mjs";

test("manual override combines every configured member instead of overwriting", async () => {
  const config = await loadConfig();
  config.identity.manualOverrides = [{ stationKey: "known", members: [{source:"yandex",sourceStationId:"1"},{source:"2gis",sourceStationId:"2"}] }];
  const stations = [{source:"yandex",sourceStationId:"1",title:"АЗС",address:"ул. Мира, 1",coordinate:[44.5,48.7]},{source:"2gis",sourceStationId:"2",title:"АЗС",address:"ул. Мира, 1",coordinate:[44.5,48.7]}];
  const [merged] = reconcileStations(stations, config);
  assert.equal(merged.stationKey, "manual:known");
  assert.equal(merged.members.length, 2);
});

test("conflicting known brands never merge", async () => {
  const config=await loadConfig();
  const values=reconcileStations([{source:"yandex",sourceStationId:"1",brand:"A",address:"ул. Мира, 1",coordinate:[44.5,48.7]},{source:"2gis",sourceStationId:"2",brand:"B",address:"ул. Мира, 1",coordinate:[44.5,48.7]}],config);
  assert.equal(values.length,2);
});

test("a surviving member preserves merged station identity", async () => {
  const config = await loadConfig();
  const stations = [{source:"yandex",sourceStationId:"1",brand:"A",address:"ул. Мира, 1",coordinate:[44.5,48.7]},{source:"gdebenz",sourceStationId:"2",brand:"A",address:"ул. Мира, 1",coordinate:[44.5001,48.7001]}];
  const [both] = reconcileStations(stations, config);
  const previous = { assessments: [both] };
  const [current] = reconcileStations([stations[0]], config, previous);
  assert.equal(current.stationKey, both.stationKey);
});

test("merges the three live representations of Rosneft at Rokossovskogo 175", async () => {
  const config = await loadConfig();
  const stations = [
    { source: "gdebenz", sourceStationId: "1721722173", title: "Роснефть", brand: "Роснефть", address: "улица Рокоссовского, 175", coordinate: [44.5259038, 48.7481603] },
    { source: "2gis", sourceStationId: "4644865396813243", title: "Роснефть", brand: { branch_count: 11, extension: "АЗС", id: "70000001046307911", name: "Роснефть" }, address: "улица им. Рокоссовского, 175", coordinate: [44.525849, 48.748048] },
    { source: "benzonavt", sourceStationId: "6948", title: "РН-Ростовнефтепродукт", brand: "Роснефть", address: "Волгоградская обл., г. Волгоград, ул. Рокоссовского, 175", coordinate: [44.5259038, 48.7481603] }
  ];

  const values = reconcileStations(stations, config);

  assert.equal(values.length, 1);
  assert.equal(values[0].members.length, 3);
  assert.deepEqual(values[0].members.map(member => member.source).sort(), ["2gis", "benzonavt", "gdebenz"]);
  assert.equal(values[0].matchConfidence, "HIGH");
});
