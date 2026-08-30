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
