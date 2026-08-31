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

for (const [label, yandexCoordinate] of [["nearby", [44.52583, 48.74810]], ["same pin", [44.5259038, 48.7481603]]]) {
  test(`merges four corroborating sources when Yandex is ${label}`, async () => {
    const config = await loadConfig();
    const stations = [
      { source: "gdebenz", sourceStationId: "1721722173", title: "Роснефть", brand: "Роснефть", address: "улица Рокоссовского, 175", coordinate: [44.5259038, 48.7481603] },
      { source: "2gis", sourceStationId: "4644865396813243", title: "Роснефть", brand: { name: "Роснефть" }, address: "улица им. Рокоссовского, 175", coordinate: [44.525849, 48.748048] },
      { source: "benzonavt", sourceStationId: "6948", title: "РН-Ростовнефтепродукт", brand: "Роснефть", address: "Волгоградская обл., г. Волгоград, ул. Рокоссовского, 175", coordinate: [44.5259038, 48.7481603] },
      { source: "yandex", sourceStationId: "ya-175", title: "Роснефть", brand: "Роснефть", address: "ул. Рокоссовского, 175", coordinate: yandexCoordinate }
    ];
    const values = reconcileStations(stations, config);
    assert.equal(values.length, 1);
    assert.deepEqual(values[0].members.map(member => member.source).sort(), ["2gis", "benzonavt", "gdebenz", "yandex"]);
  });
}

test("never merges two station IDs from the same source into one group", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "gdebenz", sourceStationId: "g", title: "АЗС", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "x", title: "АЗС", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "y", title: "АЗС", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.50001, 48.7] }
  ], config);

  assert.equal(values.length, 3);
  for (const value of values) assert.equal(new Set(value.members.map(member => member.source)).size, value.members.length);
});

test("pairs two nearby same-address stations one-to-one instead of cross-contaminating them", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "north-y", title: "Лукойл", brand: "Лукойл", address: "Ангарская, 131", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "north-g", title: "Лукойл", brand: "Лукойл", address: "ул. Ангарская, 131", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "south-g", title: "Лукойл", brand: "Лукойл", address: "ул. Ангарская, 131", coordinate: [44.5007, 48.7] },
    { source: "yandex", sourceStationId: "south-y", title: "Лукойл", brand: "Лукойл", address: "Ангарская, 131", coordinate: [44.5007, 48.7] }
  ], config);

  assert.equal(values.length, 2);
  assert.deepEqual(values.map(value => value.members.map(member => member.sourceStationId).sort()).sort(), [["north-g", "north-y"], ["south-g", "south-y"]]);
});

test("structured alias brands still enforce conflicting-brand rejection", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "r", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "l", brand: { id: "lukoil", alias: "Лукойл" }, address: "ул. Мира, 1", coordinate: [44.5, 48.7] }
  ], config);
  assert.equal(values.length, 2);
});

test("opaque structured brands block automatic merging", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "r", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "opaque", brand: { id: 42 }, address: "ул. Мира, 1", coordinate: [44.5, 48.7] }
  ], config);
  assert.equal(values.length, 2);
});

test("a house-letter g is not discarded as a city abbreviation", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "27", title: "АЗС 1", brand: "Лукойл", address: "ул. Землячки, 27", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "27g", title: "АЗС 2", brand: "Лукойл", address: "ул. Землячки, 27 г", coordinate: [44.5006, 48.7] }
  ], config);
  assert.equal(values.length, 2);
});

test("a house-letter g remains distinct when followed by a city name", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "city", title: "АЗС 1", brand: "Лукойл", address: "ул. Землячки, 27, г. Волгоград", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "house-g", title: "АЗС 2", brand: "Лукойл", address: "ул. Землячки, 27 г, Волгоград", coordinate: [44.5001, 48.7] }
  ], config);
  assert.equal(values.length, 2);
});

test("attached and separated spellings of the same house letter merge", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "attached", title: "АЗС", brand: "Лукойл", address: "ул. Землячки, 27Г", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "separated", title: "АЗС", brand: "Лукойл", address: "ул. Землячки, 27 г", coordinate: [44.5001, 48.7] }
  ], config);
  assert.equal(values.length, 1);
});

for (const unit of ["корпус 1", "к 1"]) {
  test(`main house number is not replaced by ${unit}`, async () => {
    const config = await loadConfig();
    const values = reconcileStations([
      { source: "yandex", sourceStationId: "10", title: "АЗС", brand: "Лукойл", address: `ул. Мира, 10, ${unit}`, coordinate: [44.5, 48.7] },
      { source: "2gis", sourceStationId: "11", title: "АЗС", brand: "Лукойл", address: `ул. Мира, 11, ${unit}`, coordinate: [44.5, 48.7] }
    ], config);
    assert.equal(values.length, 2);
  });
}

test("corpus abbreviations normalize without changing the main house number", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "long", title: "АЗС", brand: "Лукойл", address: "ул. Мира, 10, корпус 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "short", title: "АЗС", brand: "Лукойл", address: "ул. Мира, 10, к 1", coordinate: [44.5001, 48.7] }
  ], config);
  assert.equal(values.length, 1);
});

test("different known corpus numbers remain separate", async () => {
  const config = await loadConfig();
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "c1", title: "АЗС", brand: "Лукойл", address: "ул. Мира, 10, корпус 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "c2", title: "АЗС", brand: "Лукойл", address: "ул. Мира, 10, корпус 2", coordinate: [44.5, 48.7] }
  ], config);
  assert.equal(values.length, 2);
});

test("configured brand aliases and street dictionary participate in matching", async () => {
  const config = await loadConfig();
  config.identity.brandAliases = { "лукойл": ["lukoil"] };
  config.identity.streetDictionary = { "рокоссовского": ["маршала рокоссовского"] };
  const values = reconcileStations([
    { source: "yandex", sourceStationId: "a", title: "Lukoil", brand: "lukoil", address: "ул. Маршала Рокоссовского, 10", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "b", title: "Лукойл", brand: "Лукойл", address: "ул. Рокоссовского, 10", coordinate: [44.5003, 48.7] }
  ], config);
  assert.equal(values.length, 1);
});

test("automatic members attached to a manual group preserve its key", async () => {
  const config = await loadConfig();
  config.identity.manualOverrides = [{ stationKey: "pinned", members: [{ source: "yandex", sourceStationId: "y" }] }];
  const [value] = reconcileStations([
    { source: "yandex", sourceStationId: "y", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "g", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] }
  ], config);
  assert.equal(value.stationKey, "manual:pinned");
  assert.equal(value.matchConfidence, "MANUAL");
});

test("a manual key wins over continuity inherited from a previous snapshot", async () => {
  const config = await loadConfig();
  config.identity.manualOverrides = [{ stationKey: "pinned", members: [{ source: "yandex", sourceStationId: "y" }] }];
  const [value] = reconcileStations([
    { source: "yandex", sourceStationId: "y", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] },
    { source: "2gis", sourceStationId: "g", brand: "Роснефть", address: "ул. Мира, 1", coordinate: [44.5, 48.7] }
  ], config, { assessments: [{ stationKey: "merged:old", members: [{ source: "yandex", sourceStationId: "y" }, { source: "2gis", sourceStationId: "g" }] }] });
  assert.equal(value.stationKey, "manual:pinned");
  assert.equal(value.matchConfidence, "MANUAL");
});

test("rejects a manual group containing two stations from one source", async () => {
  const config = await loadConfig();
  config.identity.manualOverrides = [{ stationKey: "bad", members: [{ source: "2gis", sourceStationId: "a" }, { source: "2gis", sourceStationId: "b" }] }];
  assert.throws(() => reconcileStations([], config), /multiple 2gis stations/u);
});
