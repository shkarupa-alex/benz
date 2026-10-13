#!/usr/bin/env node
import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  activityTimestampMs,
  isFreshActivity,
  normalizeQueues,
  rankAssessments
} from "./chunks/chunk-EDWE3O3S.mjs";
import {
  BrowserRunner
} from "./chunks/chunk-4NES4PMI.mjs";
import {
  haversineMeters,
  isInsideArea,
  resolveArea
} from "./chunks/chunk-GHVUWPOG.mjs";
import {
  ensureDefaultHistoryPath,
  forecastWindowDays,
  recordHistory
} from "./chunks/chunk-KNPQEARR.mjs";
import {
  ensureUserConfig,
  latestSnapshotPath
} from "./chunks/chunk-EMN4BFNA.mjs";
import {
  ageMinutes,
  defaultBrowserConfigPath,
  defaultConfigPath,
  defaultSchemaPath,
  isMainModule,
  loadConfig,
  readJson,
  sha256,
  stableJson,
  validateAreaSpec,
  writeJsonAtomic
} from "./chunks/chunk-VLCMFCCN.mjs";
import {
  ADDRESS_UNIT_KINDS,
  brandLabel,
  compileBrandAliases,
  compileStreetDictionary,
  isAddressUnitValue,
  normalizeAddress,
  normalizeBrand,
  normalizeComparableBrand,
  normalizeText
} from "./chunks/chunk-IVODUSOD.mjs";
import {
  petrolOctaneKey
} from "./chunks/chunk-XKTP5TT3.mjs";

// scripts/collect.mjs
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/lib/activity.mjs
function deriveActivityEvidence(records = [], config, fetchedAt) {
  const now = new Date(fetchedAt).getTime();
  return records.map((record) => {
    if (record.kind === "PETROL_STATUS_SNAPSHOT") return { ...record, eventTimes: [] };
    if (record.kind === "SOURCE_REPORTED_TRANSITION") {
      const observed = new Date(record.observedAt ?? record.latestEventAt).getTime();
      const valid = Number.isFinite(observed) && observed <= now + config.freshness.futureSkewSeconds * 1e3;
      return { ...record, observedAt: valid ? toIso(observed) : void 0, latestEventAt: valid ? toIso(observed) : void 0, eventTimes: [] };
    }
    if (record.kind === "ROLLING_SIGNAL_COUNT") {
      const latest = new Date(record.latestEventAt).getTime();
      const observed = new Date(record.observedAt ?? fetchedAt).getTime();
      const validLatest = Number.isFinite(latest) && latest <= now + config.freshness.futureSkewSeconds * 1e3;
      return { ...record, observedAt: Number.isFinite(observed) ? toIso(observed) : fetchedAt, latestEventAt: validLatest ? toIso(latest) : void 0, count: Math.max(0, Number(record.count) || 0), eventTimes: [] };
    }
    const eventTimes = (record.eventTimes ?? []).map((value) => new Date(value).getTime()).filter(Number.isFinite).filter((value) => value <= now + config.freshness.futureSkewSeconds * 1e3).sort((a, b) => a - b);
    if (!record.gradeSpecific || !eventTimes.length) return { ...record, eventTimes: eventTimes.map(toIso), kind: record.kind === "TRANSACTIONS_RESUMED" ? "RECENT_SIGNAL" : record.kind };
    const recent = eventTimes.filter((value) => now - value <= config.activity.resumeWindowMinutes * 6e4);
    const beforeRecent = eventTimes.filter((value) => value < (recent[0] ?? Infinity));
    const inferredGap = recent.length && beforeRecent.length ? (recent[0] - beforeRecent.at(-1)) / 6e4 : record.precedingGapMinutes;
    if (recent.length >= config.activity.minimumEvents && inferredGap >= config.activity.quietGapMinutes) return { ...record, eventTimes: eventTimes.map(toIso), precedingGapMinutes: inferredGap, resumedAt: toIso(recent[0]), latestEventAt: toIso(recent.at(-1)), kind: "TRANSACTIONS_RESUMED" };
    if (recent.length) return { ...record, eventTimes: eventTimes.map(toIso), kind: "TRANSACTIONS_ONGOING" };
    return { ...record, eventTimes: eventTimes.map(toIso), kind: "RECENT_SIGNAL" };
  });
}
var toIso = (value) => new Date(value).toISOString();

// scripts/lib/diff.mjs
function diffSnapshots(previous, current) {
  if (!previous) return [];
  if (previous.areaHash !== current.areaHash || previous.queryHash !== current.queryHash || previous.adapterContractHash !== current.adapterContractHash) return [{ type: "SCOPE_CHANGED", message: "\u0417\u043E\u043D\u0430, \u043D\u0430\u0431\u043E\u0440 \u0442\u043E\u043F\u043B\u0438\u0432\u0430 \u0438\u043B\u0438 \u043A\u043E\u043D\u0442\u0440\u0430\u043A\u0442 \u0430\u0434\u0430\u043F\u0442\u0435\u0440\u043E\u0432 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0438\u0441\u044C; \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u043F\u043E\u0434\u0430\u0432\u043B\u0435\u043D\u043E." }];
  const before = new Map(previous.assessments.map((a) => [a.stationKey, a]));
  const changes = [];
  for (const item of current.assessments) {
    const old = before.get(item.stationKey);
    if (!old) {
      changes.push({ type: "ADDED", stationKey: item.stationKey, current: item });
      continue;
    }
    if (old.verdict !== item.verdict || old.confidence !== item.confidence || queueValue(old.queue) !== queueValue(item.queue)) changes.push({ type: "CHANGED", stationKey: item.stationKey, previous: old, current: item });
    before.delete(item.stationKey);
  }
  for (const old of before.values()) changes.push({ type: "REMOVED", stationKey: old.stationKey, previous: old });
  return changes;
}
function queueValue(queue) {
  return queue?.vehicleCount ?? queue?.ordinal ?? queue?.displayText ?? "unknown";
}

// scripts/lib/identity.mjs
function reconcileStations(stations, config, previousSnapshot, diagnostics = [], { useSpatialIndex = true } = {}) {
  const identity = { ...config.identity, brandAliases: compileBrandAliases(config.identity.brandAliases), streetDictionary: compileStreetDictionary(config.identity.streetDictionary) };
  const overrides = overrideIndex(config.identity.manualOverrides);
  const groups = /* @__PURE__ */ new Map();
  for (const station of stations) {
    const member = `${station.source}:${station.sourceStationId ?? ""}`;
    const manual = overrides.get(member);
    const key = manual ? `manual:${manual}` : station.sourceStationId ? `source:${station.source}:${station.sourceStationId}` : fallbackKey(station, identity);
    const existing = groups.get(key);
    if (existing) existing.members.push(station);
    else groups.set(key, { stationKey: key, members: [station], matchConfidence: manual ? "MANUAL" : "SOURCE_ID" });
  }
  const values = [...groups.values()];
  for (const station of stations) if (brandLabel(station.brand) && !normalizeComparableBrand(station.brand, identity.brandAliases)) recordDiagnostic(diagnostics, { kind: "OPAQUE_BRAND", source: station.source, sourceStationId: station.sourceStationId, brand: brandLabel(station.brand) });
  let merged;
  do {
    merged = false;
    const neighbors = spatialNeighbors(values, identity, useSpatialIndex);
    outer: for (let i = 0; i < values.length; i++) {
      if (!values[i]) continue;
      for (const j of neighbors(i)) {
        if (j <= i) continue;
        const a = values[i], b = values[j];
        if (!a || !b || sourcesOverlap(a, b) || conflictingManualKeys(a, b)) continue;
        const score = groupMatchScore(a, b, identity);
        if (!(score >= 0.82)) continue;
        const runnerUp = Math.max(secondBestScore(values, i, j, identity, neighbors), secondBestScore(values, j, i, identity, neighbors));
        if (!(score - runnerUp >= identity.ambiguityMargin)) {
          recordDiagnostic(diagnostics, { kind: "AMBIGUOUS_MATCH", members: [...a.members, ...b.members].map((member) => `${member.source}:${member.sourceStationId}`).sort(), score: Number(score.toFixed(4)), runnerUpScore: Number(runnerUp.toFixed(4)) });
          continue;
        }
        values[i] = mergeGroups(a, b);
        values[j] = null;
        merged = true;
        break outer;
      }
    }
  } while (merged);
  return preservePreviousKeys(values.filter(Boolean), previousSnapshot).map((group) => canonicalize(group, config.ranking.sourcePriority));
}
var MAX_IDENTITY_DIAGNOSTICS = 100;
function recordDiagnostic(diagnostics, entry) {
  const key = stableDiagnosticKey(entry);
  if (diagnostics.length >= MAX_IDENTITY_DIAGNOSTICS || diagnostics.some((value) => stableDiagnosticKey(value) === key)) return;
  diagnostics.push(entry);
}
function stableDiagnosticKey(entry) {
  return `${entry.kind}|${entry.members?.join(",") ?? `${entry.source}:${entry.sourceStationId}`}`;
}
function spatialNeighbors(values, identity, enabled = true) {
  const everyLiveIndex = values.map((group, index) => group ? index : -1).filter((index) => index >= 0);
  if (!enabled) return () => everyLiveIndex;
  const coordinates = values.flatMap((group) => group ? group.members.map((member) => member.coordinate) : []);
  const maxAbsLat = Math.max(0, ...coordinates.map((coordinate) => Math.abs(Number(coordinate?.[1]))).filter(Number.isFinite));
  const latCell = identity.maxCoordinateDriftMeters / 111320;
  const lonCell = identity.maxCoordinateDriftMeters / (111320 * Math.max(0.01, Math.cos(maxAbsLat * Math.PI / 180)));
  const cells = /* @__PURE__ */ new Map();
  const unindexed = /* @__PURE__ */ new Set();
  const keysOf = (group) => {
    const out = /* @__PURE__ */ new Set();
    for (const member of group.members) {
      const lon = Number(member.coordinate?.[0]), lat = Number(member.coordinate?.[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      out.add(`${Math.floor(lon / lonCell)}:${Math.floor(lat / latCell)}`);
    }
    return out.size ? out : null;
  };
  const keysByIndex = /* @__PURE__ */ new Map();
  for (const [index, group] of values.entries()) {
    if (!group) continue;
    const keys = keysOf(group);
    if (!keys) {
      unindexed.add(index);
      continue;
    }
    keysByIndex.set(index, keys);
    for (const key of keys) {
      const bucket = cells.get(key) ?? /* @__PURE__ */ new Set();
      bucket.add(index);
      cells.set(key, bucket);
    }
  }
  return (index) => {
    if (!keysByIndex.has(index)) return everyLiveIndex;
    const out = new Set(unindexed);
    for (const key of keysByIndex.get(index)) {
      const [x, y] = key.split(":").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const candidate of cells.get(`${x + dx}:${y + dy}`) ?? []) out.add(candidate);
    }
    out.delete(index);
    return [...out].sort((a, b) => a - b);
  };
}
function preservePreviousKeys(groups, previousSnapshot) {
  const memberToKey = /* @__PURE__ */ new Map();
  for (const station of previousSnapshot?.assessments ?? []) for (const member of station.members ?? []) memberToKey.set(`${member.source}:${member.sourceStationId}`, station.stationKey);
  const claimed = /* @__PURE__ */ new Set();
  return groups.map((group) => {
    if (group.stationKey.startsWith("manual:")) return group;
    const keys = new Set(group.members.map((member) => memberToKey.get(`${member.source}:${member.sourceStationId}`)).filter(Boolean));
    if (keys.size !== 1) return group;
    const [key] = keys;
    if (claimed.has(key)) return group;
    claimed.add(key);
    return { ...group, stationKey: key, matchConfidence: group.matchConfidence === "MANUAL" ? "MANUAL" : "PREVIOUS_MEMBER" };
  });
}
function matchScore(a, b, identity) {
  const brandA = normalizeComparableBrand(a.brand, identity.brandAliases), brandB = normalizeComparableBrand(b.brand, identity.brandAliases);
  if (brandLabel(a.brand) && !brandA || brandLabel(b.brand) && !brandB) return -Infinity;
  if (brandA && brandB && brandA !== brandB) return -Infinity;
  const distance = Array.isArray(a.coordinate) && Array.isArray(b.coordinate) ? haversineMeters(a.coordinate, b.coordinate) : NaN;
  if (!(distance <= identity.maxCoordinateDriftMeters)) return -Infinity;
  const addressA = normalizeAddress(a.address, identity.streetDictionary), addressB = normalizeAddress(b.address, identity.streetDictionary);
  const titleA = normalizeText(a.title), titleB = normalizeText(b.title);
  const addressScore = tokenSimilarity(addressA, addressB);
  const titleScore = tokenSimilarity(titleA, titleB);
  const partsA = addressParts(addressA), partsB = addressParts(addressB);
  if (partsA.house && partsB.house && partsA.house !== partsB.house) return -Infinity;
  for (const kind of ADDRESS_UNIT_KINDS) if (partsA.units[kind] && partsB.units[kind] && partsA.units[kind] !== partsB.units[kind]) return -Infinity;
  if (brandA && brandA === brandB && addressA && addressA === addressB && partsA.house && distance <= 5) return 1.2;
  const brandScore = brandA && brandA === brandB ? 1 : 0;
  return 0.45 * (1 - distance / identity.maxCoordinateDriftMeters) + 0.4 * addressScore + 0.15 * Math.max(titleScore, brandScore);
}
function groupMatchScore(a, b, identity) {
  const scores = a.members.flatMap((left) => b.members.map((right) => matchScore(left, right, identity)));
  return scores.length ? Math.min(...scores) : -Infinity;
}
function secondBestScore(values, targetIndex, excludedIndex, identity, neighbors) {
  const target = values[targetIndex];
  const counterpart = values[excludedIndex];
  if (!target || !counterpart) return 0;
  return Math.max(0, ...neighbors(targetIndex).map((index) => {
    const candidate = values[index];
    return index === targetIndex || index === excludedIndex || !candidate || !sourcesOverlap(candidate, counterpart) || sourcesOverlap(target, candidate) || conflictingManualKeys(target, candidate) ? -Infinity : groupMatchScore(target, candidate, identity);
  }));
}
function sourcesOverlap(a, b) {
  const sources = new Set(a.members.map((member) => member.source));
  return b.members.some((member) => sources.has(member.source));
}
function conflictingManualKeys(a, b) {
  return a.stationKey.startsWith("manual:") && b.stationKey.startsWith("manual:") && a.stationKey !== b.stationKey;
}
function mergeGroups(a, b) {
  const members = [...a.members, ...b.members];
  const manualKey = [a.stationKey, b.stationKey].find((key) => key.startsWith("manual:"));
  return { stationKey: manualKey ?? `merged:${sha256(members.map((member) => `${member.source}:${member.sourceStationId}`).sort()).slice(0, 20)}`, members, matchConfidence: manualKey ? "MANUAL" : "HIGH" };
}
function canonicalize(group, priority) {
  const members = [...group.members].sort((a, b) => priority.indexOf(a.source) - priority.indexOf(b.source) || a.source.localeCompare(b.source));
  const best = members[0];
  return { stationKey: group.stationKey, title: best.title || brandLabel(best.brand) || best.address || "\u0410\u0417\u0421", brand: brandLabel(best.brand) || void 0, address: best.address, coordinate: best.coordinate, members, matchConfidence: group.matchConfidence };
}
function overrideIndex(overrides) {
  const out = /* @__PURE__ */ new Map();
  for (const override of overrides) {
    const sources = /* @__PURE__ */ new Set();
    for (const member of override.members) {
      if (sources.has(member.source)) throw new Error(`Manual identity override ${override.stationKey} contains multiple ${member.source} stations`);
      sources.add(member.source);
      out.set(`${member.source}:${member.sourceStationId}`, override.stationKey);
    }
  }
  return out;
}
function fallbackKey(s, identity) {
  return `anon:${sha256(`${normalizeComparableBrand(s.brand, identity.brandAliases) || normalizeBrand(s.brand)}|${normalizeAddress(s.address, identity.streetDictionary)}|${s.coordinate.join(",")}`).slice(0, 20)}`;
}
function addressParts(address) {
  const tokens = address.split(" ").filter(Boolean);
  const units = {};
  for (let index = 0; index < tokens.length - 1; index++) {
    if (!ADDRESS_UNIT_KINDS.has(tokens[index]) || !isAddressUnitValue(tokens[index], tokens[index + 1])) continue;
    units[tokens[index]] = tokens[index + 1];
  }
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (ADDRESS_UNIT_KINDS.has(tokens[index - 1])) continue;
    if (!/^\d+[а-яa-z]?$/u.test(tokens[index])) continue;
    return { house: tokens[index], units };
  }
  return { house: void 0, units };
}
function tokenSimilarity(a, b) {
  if (!a || !b) return 0;
  const aa = new Set(a.split(" ")), bb = new Set(b.split(" "));
  const common = [...aa].filter((x) => bb.has(x)).length;
  return common / (/* @__PURE__ */ new Set([...aa, ...bb])).size;
}

// scripts/lib/verdict.mjs
var POSITIVE = /* @__PURE__ */ new Set(["IN_STOCK", "LIMITED"]);
var NEGATIVE = /* @__PURE__ */ new Set(["OUT_OF_STOCK"]);
function assessStation({ observations = [], activity = [], config, sourceGroups = {}, now = /* @__PURE__ */ new Date() }) {
  const evidence = observations.map((o) => enrich(o, config.freshness, now));
  const usable = evidence.filter((o) => !o.expired && o.ageKind !== "UNKNOWN");
  const direct = usable.filter((o) => o.product?.specificity === "EXACT_VARIANT");
  const positives = direct.filter((o) => POSITIVE.has(o.status));
  const negatives = usable.filter((o) => NEGATIVE.has(o.status) && (o.product?.specificity === "EXACT_VARIANT" || o.familyAllUnavailable === true));
  const conflict = hasFreshConflict(positives, negatives, config.freshness.conflictWindowMinutes);
  if (conflict) return result("CONFLICTING", "LOW", evidence, activity, "opposing fresh current observations");
  const freshestPositive = newest(positives);
  const freshestNegative = newest(negatives);
  if (freshestPositive && (!freshestNegative || freshestPositive.observedMs > freshestNegative.observedMs)) {
    const confidence = positiveConfidence(positives, activity, sourceGroups, config);
    return result("AVAILABLE", confidence, evidence, activity, "fresh exact positive evidence");
  }
  const familyPositive = usable.find((o) => POSITIVE.has(o.status) && o.product?.specificity === "FAMILY_ONLY");
  if (familyPositive) return result("LIKELY_AVAILABLE", "LOW", evidence, activity, "family-only positive evidence");
  const resumed = newestActivity(activity.filter((a) => a.kind === "TRANSACTIONS_RESUMED" && a.gradeSpecific), config.freshness, now);
  if (resumed && freshestNegative && Math.abs(resumed.observedMs - freshestNegative.observedMs) <= config.freshness.conflictWindowMinutes * 6e4) return result("CONFLICTING", "LOW", evidence, activity, "fresh activity conflicts with direct negative evidence");
  if (resumed && (!freshestNegative || resumed.observedMs > freshestNegative.observedMs)) return result("LIKELY_AVAILABLE", "MEDIUM", evidence, activity, "grade-specific activity resumed");
  if (freshestNegative && (!freshestPositive || freshestNegative.observedMs > freshestPositive.observedMs)) return result("NOT_AVAILABLE", "MEDIUM", evidence, activity, "fresh exact negative evidence");
  if (usable.length) return result("INDIRECT", "LOW", evidence, activity, "indirect or uncertain evidence only");
  return result("NO_FRESH_DATA", "NONE", evidence, activity, "no usable current evidence");
}
function assessRequestedUnion({ observations = [], activity = [], config, sourceGroups = {}, now = /* @__PURE__ */ new Date() }) {
  const assessments = {};
  for (const product of config.requestedProducts.products) {
    const matching = observations.filter((o) => o.product?.productKey === product.productKey || o.familyAllUnavailable === true && o.product?.specificity === "FAMILY_ONLY");
    const matchingActivity = activity.filter((a) => a.product?.productKey === product.productKey);
    assessments[product.productKey] = assessStation({ observations: matching, activity: matchingActivity, config, sourceGroups, now });
  }
  const unknown = observations.filter((o) => o.product?.productKey === "AI95_UNKNOWN");
  if (unknown.length) assessments.AI95_UNKNOWN = assessStation({ observations: unknown, activity: activity.filter((a) => a.product?.productKey === "AI95_UNKNOWN"), config, sourceGroups, now });
  const family = observations.filter((o) => o.product?.specificity === "FAMILY_ONLY");
  const familyAssessment = family.length ? assessStation({ observations: family, activity: activity.filter((a) => a.product?.family === "AI_95"), config, sourceGroups, now }) : null;
  const values = Object.values(assessments);
  let selected;
  const available = values.filter((v) => v.verdict === "AVAILABLE");
  const likely = values.filter((v) => v.verdict === "LIKELY_AVAILABLE");
  const conflicting = values.filter((v) => v.verdict === "CONFLICTING");
  if (available.length) selected = strongest(available);
  else if (likely.length) selected = strongest(likely);
  else if (familyAssessment?.verdict === "LIKELY_AVAILABLE") selected = familyAssessment;
  else if (conflicting.length) selected = strongest(conflicting);
  else if (hasFreshFamilyAllNegative(family, config.freshness, now)) selected = { verdict: "NOT_AVAILABLE", confidence: "MEDIUM", reason: "source explicitly reports the whole AI-95 family unavailable" };
  else if (config.requestedProducts.products.every((p) => assessments[p.productKey].verdict === "NOT_AVAILABLE")) selected = { verdict: "NOT_AVAILABLE", confidence: weakest(config.requestedProducts.products.map((p) => assessments[p.productKey].confidence)), reason: "every configured AI-95 member has fresh direct negative evidence" };
  else if (values.some((v) => v.verdict === "INDIRECT") || familyAssessment?.verdict === "INDIRECT") selected = { verdict: "INDIRECT", confidence: "LOW", reason: "indirect evidence only" };
  else selected = { verdict: "NO_FRESH_DATA", confidence: "NONE", reason: "configured union lacks complete fresh evidence" };
  const enriched = assessStation({ observations, activity, config, sourceGroups, now }).observations;
  return { ...selected, observations: enriched, activity, productAssessments: Object.fromEntries(Object.entries(assessments).map(([key, value]) => [key, compactAssessment(value)])) };
}
function enrich(observation, freshness, now) {
  if (observation.time?.kind === "BOUNDED_AGE") {
    const min = Number(observation.time.minMinutes), max = Number(observation.time.maxMinutes);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return { ...observation, ageKind: "INVALID", ageMinutes: null, band: "invalid", expired: true, observedMs: -Infinity };
    const band2 = bandForAge(max, freshness);
    return { ...observation, ageKind: "BOUNDED_AGE", ageMinutes: max, ageRangeMinutes: [min, max], approximate: true, band: band2, expired: max > freshness.expireMinutes, observedMs: now.getTime() - max * 6e4 };
  }
  if (observation.time?.kind !== "EXACT") return { ...observation, ageKind: observation.time?.kind ?? "UNKNOWN", ageMinutes: null, band: "unknown", expired: true, observedMs: -Infinity };
  const ms = new Date(observation.time.observedAt).getTime();
  if (!Number.isFinite(ms) || ms - now.getTime() > freshness.futureSkewSeconds * 1e3) return { ...observation, ageKind: "INVALID", ageMinutes: null, band: "invalid", expired: true, observedMs: -Infinity };
  const age = Math.max(0, ageMinutes(observation.time.observedAt, now));
  const band = bandForAge(age, freshness);
  return { ...observation, ageKind: "EXACT", ageMinutes: age, band, expired: age > freshness.expireMinutes, observedMs: ms };
}
function hasFreshConflict(positives, negatives, windowMinutes) {
  return positives.some((p) => p.band === "fresh" && negatives.some((n) => n.band === "fresh" && Math.abs(p.observedMs - n.observedMs) <= windowMinutes * 6e4));
}
function positiveConfidence(positives, activity, groups, config) {
  const fresh = positives.filter((o) => o.band === "fresh");
  const provenance = new Set(fresh.map((o) => groups[o.source] ?? o.source));
  if (provenance.size >= 2) return "HIGH";
  if (fresh.some((o) => (o.signalsPerHour ?? 0) >= config.activity.strongSignalCountPerHour)) return "HIGH";
  if (fresh.length || activity.some((a) => a.kind === "TRANSACTIONS_RESUMED" && a.gradeSpecific)) return "MEDIUM";
  return "LOW";
}
function newest(values) {
  return [...values].sort((a, b) => b.observedMs - a.observedMs)[0];
}
function newestActivity(values, freshness, now) {
  return newest(values.filter((value) => isFreshActivity(value, now, freshness)).map((value) => ({ ...value, observedMs: activityTimestampMs(value) })));
}
function result(verdict, confidence, observations, activity, reason) {
  return { verdict, confidence, observations, activity, reason };
}
function strongest(values) {
  return [...values].sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))[0];
}
function weakest(values) {
  return [...values].sort((a, b) => confidenceRank(a) - confidenceRank(b))[0] ?? "NONE";
}
function confidenceRank(v) {
  return { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }[v] ?? 0;
}
function bandForAge(age, freshness) {
  return age <= freshness.freshMinutes ? "fresh" : age <= freshness.recentMinutes ? "recent" : age <= freshness.staleMinutes ? "stale" : "expired";
}
function hasFreshFamilyAllNegative(observations, freshness, now) {
  return observations.some((o) => o.familyAllUnavailable === true && o.status === "OUT_OF_STOCK" && !enrich(o, freshness, now).expired);
}
function compactAssessment(value) {
  const usable = value.observations.filter((o) => !o.expired);
  const ages = usable.map((o) => o.ageMinutes).filter(Number.isFinite);
  return { verdict: value.verdict, confidence: value.confidence, reason: value.reason, freshestAgeMinutes: ages.length ? Math.min(...ages) : null, approximate: usable.some((o) => o.approximate), supportingSources: [...new Set(usable.map((o) => o.source))] };
}

// scripts/collect.mjs
var adapters = {
  yandex: () => import("./chunks/yandex-IWVIAYJM.mjs"),
  gdebenz: () => import("./chunks/gdebenz-4C2ZZH66.mjs"),
  "2gis": () => import("./chunks/twogis-KSDWKEJC.mjs"),
  benzonavt: () => import("./chunks/benzonavt-4XPTXNEL.mjs")
};
async function collectSnapshot({ configPath, outputPath, previousPath, historyPath, areaOverride, browserFactory = (config) => new BrowserRunner(config), now = /* @__PURE__ */ new Date(), cleanupNow = Date.now } = {}) {
  const config = await loadConfig(configPath);
  const area = resolveArea(areaOverride ?? config.area);
  const previous = previousPath ? await readJson(previousPath) : void 0;
  const fetchedAt = now.toISOString();
  const request = { area, requestedProducts: config.requestedProducts, fetchedAt, deadlineAt: new Date(now.getTime() + config.browser.adapterTimeoutMs * config.sources.filter((s) => s.enabled).length).toISOString() };
  const results = [];
  const warnings = [];
  const orphanProcesses = [];
  let runtimeHealth = { status: "OK" };
  const cleanups = [];
  const cleanupBudgetMs = config.browser.cleanupReserveMs;
  let cleanupRemainingMs = cleanupBudgetMs;
  const reapOrphans = config.browser.reapOrphanProcesses !== false;
  const closeRunner = async (runner) => {
    const startedAt = cleanupNow();
    const deadline = startedAt + cleanupRemainingMs;
    try {
      return await runner.close(deadline);
    } finally {
      const graceMs = reapGraceMs(deadline - cleanupNow());
      try {
        const reaped = await runner.reapLeftoverProcesses?.({ terminate: reapOrphans, graceMs });
        if (reaped?.length) orphanProcesses.push(...reaped);
      } catch (error) {
        orphanProcesses.push({ namespace: runner.namespace, outcome: `FAILED: ${error.message}` });
      }
      cleanupRemainingMs = Math.max(0, cleanupRemainingMs - Math.max(0, cleanupNow() - startedAt));
    }
  };
  const browserNamespaces = [];
  const challengeHandovers = [];
  const handover = challengeHandoverPolicy(config, challengeHandovers);
  const orderedSources = [...config.sources].sort((a, b) => a.order - b.order);
  const firstEnabled = orderedSources.find((source) => source.enabled);
  let firstRunner;
  try {
    if (firstEnabled) {
      firstRunner = browserFactory(config, firstEnabled.id);
      browserNamespaces.push(firstRunner.namespace);
      await firstRunner.probe();
    }
  } catch (error) {
    runtimeHealth = { status: "BROWSER_UNAVAILABLE", code: error.code ?? "BROWSER_UNAVAILABLE", message: error.message };
    warnings.push({ code: "BROWSER_RUNTIME_FAILED", message: `Common browser runtime failure: ${error.message}` });
    for (const source of config.sources) results.push({ source: source.id, health: { source: source.id, status: source.enabled ? "PARTIAL" : "DISABLED", code: source.enabled ? "NOT_ATTEMPTED" : void 0, message: source.enabled ? "Not attempted because the shared browser runtime failed" : void 0 }, stations: [], observations: [], queues: [], activity: [] });
  }
  if (runtimeHealth.status === "OK") {
    let usedFirstRunner = false;
    for (const source of orderedSources) {
      if (!source.enabled) {
        results.push({ source: source.id, health: { source: source.id, status: "DISABLED" }, stations: [], observations: [], queues: [], activity: [] });
        continue;
      }
      let runner = !usedFirstRunner && source.id === firstEnabled.id ? firstRunner : browserFactory(config, source.id);
      usedFirstRunner = true;
      if (!browserNamespaces.includes(runner.namespace)) browserNamespaces.push(runner.namespace);
      let sourceResult;
      for (let browserAttempt = 0; browserAttempt < 2; browserAttempt++) {
        try {
          const adapter = await adapters[source.id]();
          sourceResult = await adapter.collect(request, { browser: runner, previous, config });
          if (sourceResult.health?.status === "CHALLENGE" && handover.mayOffer()) {
            if (await handover.hold(source.id, runner)) sourceResult = await adapter.collect(request, { browser: runner, previous, config });
          }
        } catch (error) {
          sourceResult = { source: source.id, health: { source: source.id, status: "PARTIAL", code: "INTERNAL_ADAPTER_ERROR", message: error.message }, stations: [], observations: [], queues: [], activity: [] };
        } finally {
          const sourceCleanup = await closeRunner(runner).catch((error) => ({ sessionsRemaining: 1, warnings: [error.message] }));
          for (const namespace of runner.namespaceHistory ?? [runner.namespace]) if (!browserNamespaces.includes(namespace)) browserNamespaces.push(namespace);
          cleanups.push({ source: source.id, browserNamespaces: runner.namespaceHistory ?? [runner.namespace], networkControls: runner.networkControlsStatus, ...sourceCleanup });
          for (const message of runner.runtimeWarnings ?? []) warnings.push({ code: /^User-Agent adjusted:/.test(message) ? "BROWSER_USER_AGENT_ADJUSTED" : "BROWSER_NETWORK_CONTROLS_DEGRADED", message: `${source.id}: ${message}` });
        }
        if (browserAttempt === 0 && isNetworkControlsHealth(sourceResult.health, runner)) {
          runner = browserFactory(config, source.id);
          runner.networkControlsStatus = "DEGRADED";
          runner.runtimeWarnings ??= [];
          runner.runtimeWarnings.push(`agent-browser network controls failed during adapter execution (${sourceResult.health.code}); retried once with exact-URL navigation and fail-closed final-host/page-drift checks`);
          if (!browserNamespaces.includes(runner.namespace)) browserNamespaces.push(runner.namespace);
          continue;
        }
        break;
      }
      results.push(sourceResult);
    }
  } else if (firstRunner) {
    const sourceCleanup = await closeRunner(firstRunner).catch((error) => ({ sessionsRemaining: 1, warnings: [error.message] }));
    cleanups.push({ source: firstEnabled.id, networkControls: firstRunner.networkControlsStatus, ...sourceCleanup });
  }
  const cleanup = { budgetMs: cleanupBudgetMs, spentMs: cleanupBudgetMs - cleanupRemainingMs, remainingMs: cleanupRemainingMs, sessionsRemaining: cleanups.reduce((sum, value) => sum + value.sessionsRemaining, 0), warnings: cleanups.flatMap((value) => value.warnings.map((message) => `${value.source}: ${message}`)), sources: cleanups };
  if (cleanup.sessionsRemaining || cleanup.warnings.length) warnings.push({ code: "CLEANUP_FAILED", message: cleanup.warnings.join("; ") || `${cleanup.sessionsRemaining} browser session(s) remain` });
  if (results.some((r) => ["PARTIAL", "SCHEMA_CHANGED", "CHALLENGE", "TIMEOUT", "HTTP_ERROR", "RESOURCE_BLOCKED"].includes(r.health.status))) warnings.push({ code: "PARTIAL_COVERAGE", message: "At least one source did not provide complete evidence." });
  const stations = results.flatMap((r) => r.stations);
  const identityDiagnostics = [];
  const merged = reconcileStations(stations, config, previous, identityDiagnostics);
  const sourceGroups = Object.fromEntries(config.sources.map((s) => [s.id, s.provenanceGroup]));
  const requestedOctane = [...new Set(config.requestedProducts.products.map((product) => petrolOctaneKey(product)).filter(Boolean))];
  const assessments = [];
  for (const station of merged) {
    const memberKeys = new Set(station.members.map((m) => `${m.source}:${m.sourceStationId}`));
    const observations = results.flatMap((r) => r.observations).filter((o) => memberKeys.has(`${o.source}:${o.sourceStationId}`));
    const queueObservations = results.flatMap((r) => r.queues).filter((o) => memberKeys.has(`${o.source}:${o.sourceStationId}`));
    const activity = deriveActivityEvidence(results.flatMap((r) => r.activity).filter((o) => memberKeys.has(`${o.source}:${o.sourceStationId}`)), config, fetchedAt);
    const assessment = assessRequestedUnion({ observations, activity, config, sourceGroups, now });
    const anchorLabels = (area.anchors ?? []).map((a) => a.label);
    if (!isInsideArea(station.coordinate, area, { anchorLabels, stationLabel: station.address })) continue;
    assessments.push({ ...station, ...assessment, queue: normalizeQueues(queueObservations, now), ...stationCatalogue(station.members, requestedOctane) });
  }
  if (Number.isFinite(area.maxStationCount) && assessments.length > area.maxStationCount) throw Object.assign(new Error(`Area contains ${assessments.length} stations, above its limit of ${area.maxStationCount}; narrow the area or raise maxStationCount`), { code: "AREA_STATION_LIMIT" });
  const referencePoint = config.ranking.referencePoint ?? area.interiorPoint;
  const adapterContractHash = await computeAdapterContractHash();
  enforceCompleteness(results, previous, area.areaHash, adapterContractHash, fetchedAt, warnings);
  const snapshot = {
    schemaVersion: 1,
    fetchedAt,
    areaLabel: area.label,
    areaHash: area.areaHash,
    queryHash: sha256(config.requestedProducts),
    freshnessPolicy: config.freshness,
    adapterContractHash,
    assessments,
    rankingReferencePoint: referencePoint,
    rankedStationKeys: rankAssessments(assessments, referencePoint, now, config.freshness).map((a) => a.stationKey),
    sourceHealth: results.map((r) => r.health),
    sourceCoverage: Object.fromEntries(results.filter((r) => r.coverage).map((r) => [r.source, r.coverage])),
    coverageBaselines: nextCoverageBaselines(results, previous, area.areaHash, adapterContractHash, fetchedAt),
    warnings,
    runtime: { browserNamespace: browserNamespaces[0], browserNamespaces, browserMode: config.browser.headed ? "HEADED" : "HEADLESS", health: runtimeHealth, cleanup, identityDiagnostics, challengeHandovers, orphanProcesses },
    changes: diffSnapshots(previous, { areaHash: area.areaHash, queryHash: sha256(config.requestedProducts), adapterContractHash, assessments })
  };
  if (historyPath) {
    try {
      snapshot.forecast = (await recordHistory(historyPath, snapshot, config)).forecast;
    } catch (error) {
      warnings.push({ code: "HISTORY_UNAVAILABLE", message: `History could not be updated (${error.code ?? "HISTORY_ERROR"}): ${error.message}` });
      snapshot.forecast = { generatedAt: fetchedAt, retentionDays: config.history.retentionDays, windowDays: forecastWindowDays(config), requestedCount: config.history.forecastCount, tickCount: 0, completedEpisodeCount: 0, items: [] };
    }
  }
  if (outputPath) await writeJsonAtomic(outputPath, snapshot);
  return { snapshot, exitCode: warnings.some((w) => w.code === "CLEANUP_FAILED") ? 75 : assessments.length || results.some((r) => r.health.status === "OK") ? 0 : 2 };
}
function challengeHandoverPolicy(config, records) {
  const policy = config.browser.challengeHandover;
  const enabled = policy?.enabled === true && config.browser.headed === true;
  let used = 0;
  return {
    mayOffer: () => enabled && used < policy.maxPerRun,
    hold: async (source, runner) => {
      const record = { source, namespace: runner.namespace, sessionName: runner.sessionName, url: runner.expectedUrl, waitSeconds: policy.waitSeconds, requestedAt: (/* @__PURE__ */ new Date()).toISOString() };
      const outcome = await runner.awaitManualChallengeResolution({ waitMs: policy.waitSeconds * 1e3, pollMs: policy.pollSeconds * 1e3 });
      if (["CLEARED", "TIMED_OUT", "LOST_WHILE_HELD"].includes(outcome)) used += 1;
      records.push({ ...record, outcome });
      return outcome === "CLEARED";
    }
  };
}
function reapGraceMs(remainingMs) {
  return Math.min(3e3, Math.max(250, Number.isFinite(remainingMs) ? remainingMs : 0));
}
function stationCatalogue(members, requestedOctane) {
  const published = members.filter((member) => Array.isArray(member.assortment));
  const assortment = published.length ? [...new Set(published.flatMap((member) => member.assortment))].sort((a, b) => Number(a) - Number(b)) : void 0;
  const limits = members.flatMap((member) => (member.limits ?? []).map((limit) => ({ ...limit, source: member.source })));
  return { assortment, sellsRequestedFamily: assortment ? requestedOctane.some((octane) => assortment.includes(octane)) : void 0, limits: limits.length ? limits : void 0 };
}
var CONTROLS_ATTRIBUTABLE_CODES = /* @__PURE__ */ new Set(["NAVIGATION_FAILED", "TIMEOUT", "BROWSER_UNAVAILABLE"]);
function isNetworkControlsHealth(health, runner) {
  if (health?.code === "BROWSER_UNAVAILABLE" && /failed to install browser network controls:[\s\S]*CDP error \((?:Runtime\.evaluate|Page\.enable)\)/i.test(String(health.message))) return true;
  if (runner.networkControlsStatus !== "ACTIVE") return false;
  if (health?.code === "PAGE_LOST" && /, got (?:about:|chrome-error:|empty URL)/i.test(String(health.message))) return true;
  return CONTROLS_ATTRIBUTABLE_CODES.has(health?.code) && runner.lastCommandFailure?.code === health.code;
}
var moduleDir = dirname(fileURLToPath(import.meta.url));
async function computeAdapterContractHash() {
  if (true) return "02583f1ca351f29346febaa2cf00893c949d8ee0f07ad87873bbd1d71ba2b4f0";
  const names = ["common.mjs", "yandex.mjs", "gdebenz.mjs", "twogis.mjs", "benzonavt.mjs"];
  return sha256((await Promise.all(names.map((name) => readFile(resolve(moduleDir, "lib/sources", name), "utf8")))).join("\n---adapter---\n"));
}
function baselineKey(source, areaHash, contractHash) {
  return `${source}:${areaHash}:${contractHash}`;
}
function enforceCompleteness(results, previous, areaHash, contractHash, fetchedAt, warnings) {
  const cutoff = new Date(fetchedAt).getTime() - 90 * 864e5;
  for (const result2 of results) {
    if (!result2.coverage) continue;
    const baseline = previous?.coverageBaselines?.[baselineKey(result2.source, areaHash, contractHash)];
    const failures = [];
    if (baseline && new Date(baseline.updatedAt).getTime() >= cutoff && baseline.stationCount >= 4 && result2.coverage.stationCount < baseline.stationCount * 0.5) failures.push(`station count ${result2.coverage.stationCount} is below 50% of baseline ${baseline.stationCount}`);
    if (result2.coverage.duplicateRatio > 0.15) failures.push("duplicate ratio exceeds 15%");
    if (result2.coverage.coordinateCoverage < 0.9) failures.push("coordinate coverage is below 90%");
    if (result2.coverage.fuelBlockCoverage < 0.2) failures.push("fuel-block coverage is below 20%");
    if (result2.coverage.freshnessExpected !== false && result2.coverage.timestampCoverage < 0.2) failures.push("timestamp coverage is below 20%");
    if (!failures.length) continue;
    if (result2.health.status === "OK") result2.health = { ...result2.health, status: "PARTIAL", code: "COMPLETENESS_INVARIANT", message: failures.join("; ") };
    warnings.push({ code: failures.some((value) => value.startsWith("station count")) ? "STATION_COUNT_REGRESSION" : "COMPLETENESS_INVARIANT", message: `${result2.source}: ${failures.join("; ")}` });
  }
}
function nextCoverageBaselines(results, previous, areaHash, contractHash, fetchedAt) {
  const cutoff = new Date(fetchedAt).getTime() - 90 * 864e5;
  const out = Object.fromEntries(Object.entries(previous?.coverageBaselines ?? {}).filter(([, value]) => new Date(value.updatedAt).getTime() >= cutoff));
  for (const result2 of results) if (result2.health.status === "OK" && result2.coverage) {
    const key = baselineKey(result2.source, areaHash, contractHash);
    const old = out[key];
    out[key] = { stationCount: Math.max(old?.stationCount ?? 0, result2.coverage.stationCount), updatedAt: fetchedAt };
  }
  return out;
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  args.config ??= await ensureUserConfig({ templateConfigPath: defaultConfigPath, templateBrowserConfigPath: defaultBrowserConfigPath, templateSchemaPath: defaultSchemaPath });
  const statePath = args.state ?? latestSnapshotPath();
  const previousPath = args.previous ?? await existingPath(statePath);
  let interrupted;
  const onSigint = () => {
    interrupted = "SIGINT";
  };
  const onSigterm = () => {
    interrupted = "SIGTERM";
  };
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  const areaOverride = args.area ? await validateAreaSpec(areaSpec(await readJson(args.area))) : void 0;
  if (areaOverride && !args.output) throw new Error("--area requires --output so a one-off zone cannot overwrite the monitored snapshot");
  const result2 = await collectSnapshot({ configPath: args.config, outputPath: args.output, previousPath: areaOverride ? void 0 : previousPath, historyPath: areaOverride ? void 0 : args.history ?? await ensureDefaultHistoryPath(), areaOverride });
  if (!areaOverride && resolve(args.output ?? "") !== resolve(statePath)) await writeJsonAtomic(statePath, result2.snapshot);
  process.removeListener("SIGINT", onSigint);
  process.removeListener("SIGTERM", onSigterm);
  process.stdout.write(`${stableJson({ snapshot: result2.snapshot, exitCode: result2.exitCode })}
`);
  process.exitCode = interrupted === "SIGINT" ? 130 : interrupted === "SIGTERM" ? 143 : result2.exitCode;
}
async function existingPath(path) {
  try {
    await stat(path);
    return path;
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--config", "--output", "--previous", "--history", "--state", "--area"].includes(arg)) out[arg.slice(2)] = resolve(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}
function areaSpec(value) {
  return value && typeof value === "object" && value.area && typeof value.area === "object" ? value.area : value;
}
if (isMainModule(import.meta.url)) main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}
`);
  process.exitCode = 2;
});
export {
  challengeHandoverPolicy,
  collectSnapshot,
  enforceCompleteness,
  nextCoverageBaselines,
  reapGraceMs,
  stationCatalogue
};
