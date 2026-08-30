export function diffSnapshots(previous, current) {
  if (!previous) return [];
  if (previous.areaHash !== current.areaHash || previous.queryHash !== current.queryHash) return [{ type: "SCOPE_CHANGED", message: "Зона или набор топлива изменились; сравнение подавлено." }];
  const before = new Map(previous.assessments.map(a => [a.stationKey, a]));
  const changes = [];
  for (const item of current.assessments) {
    const old = before.get(item.stationKey);
    if (!old) { changes.push({ type: "ADDED", stationKey: item.stationKey, current: item }); continue; }
    if (old.verdict !== item.verdict || old.confidence !== item.confidence || queueValue(old.queue) !== queueValue(item.queue)) changes.push({ type: "CHANGED", stationKey: item.stationKey, previous: old, current: item });
    before.delete(item.stationKey);
  }
  for (const old of before.values()) changes.push({ type: "REMOVED", stationKey: old.stationKey, previous: old });
  return changes;
}
function queueValue(queue) { return queue?.vehicleCount ?? queue?.ordinal ?? queue?.displayText ?? "unknown"; }
