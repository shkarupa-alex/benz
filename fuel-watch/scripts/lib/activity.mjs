export function deriveActivityEvidence(records = [], config, fetchedAt) {
  const now = new Date(fetchedAt).getTime();
  return records.map(record => {
    if (record.kind === "PETROL_STATUS_SNAPSHOT") return { ...record, eventTimes: [] };
    if (record.kind === "SOURCE_REPORTED_TRANSITION") {
      const observed = new Date(record.observedAt ?? record.latestEventAt).getTime();
      const valid = Number.isFinite(observed) && observed <= now + config.freshness.futureSkewSeconds * 1000;
      return { ...record, observedAt: valid ? toIso(observed) : undefined, latestEventAt: valid ? toIso(observed) : undefined, eventTimes: [] };
    }
    if (record.kind === "ROLLING_SIGNAL_COUNT") {
      const latest = new Date(record.latestEventAt).getTime();
      const observed = new Date(record.observedAt ?? fetchedAt).getTime();
      const validLatest = Number.isFinite(latest) && latest <= now + config.freshness.futureSkewSeconds * 1000;
      return { ...record, observedAt: Number.isFinite(observed) ? toIso(observed) : fetchedAt, latestEventAt: validLatest ? toIso(latest) : undefined, count: Math.max(0, Number(record.count) || 0), eventTimes: [] };
    }
    const eventTimes = (record.eventTimes ?? []).map(value => new Date(value).getTime()).filter(Number.isFinite).filter(value => value <= now + config.freshness.futureSkewSeconds * 1000).sort((a, b) => a - b);
    if (!record.gradeSpecific || !eventTimes.length) return { ...record, eventTimes: eventTimes.map(toIso), kind: record.kind === "TRANSACTIONS_RESUMED" ? "RECENT_SIGNAL" : record.kind };
    const recent = eventTimes.filter(value => now - value <= config.activity.resumeWindowMinutes * 60000);
    const beforeRecent = eventTimes.filter(value => value < (recent[0] ?? Infinity));
    const inferredGap = recent.length && beforeRecent.length ? (recent[0] - beforeRecent.at(-1)) / 60000 : record.precedingGapMinutes;
    if (recent.length >= config.activity.minimumEvents && inferredGap >= config.activity.quietGapMinutes) return { ...record, eventTimes: eventTimes.map(toIso), precedingGapMinutes: inferredGap, resumedAt: toIso(recent[0]), latestEventAt: toIso(recent.at(-1)), kind: "TRANSACTIONS_RESUMED" };
    if (recent.length) return { ...record, eventTimes: eventTimes.map(toIso), kind: "TRANSACTIONS_ONGOING" };
    return { ...record, eventTimes: eventTimes.map(toIso), kind: "RECENT_SIGNAL" };
  });
}
const toIso = value => new Date(value).toISOString();
