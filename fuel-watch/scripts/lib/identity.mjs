import { haversineMeters } from "./geometry.mjs";
import { brandLabel, normalizeAddress, normalizeBrand, normalizeComparableBrand, normalizeText } from "./normalize.mjs";
import { sha256 } from "./util.mjs";

export function reconcileStations(stations, config, previousSnapshot) {
  const overrides = overrideIndex(config.identity.manualOverrides);
  const groups = new Map();
  for (const station of stations) {
    const member = `${station.source}:${station.sourceStationId ?? ""}`;
    const manual = overrides.get(member);
    const key = manual ? `manual:${manual}` : station.sourceStationId ? `source:${station.source}:${station.sourceStationId}` : fallbackKey(station, config.identity);
    const existing = groups.get(key);
    if (existing) existing.members.push(station);
    else groups.set(key, { stationKey: key, members: [station], matchConfidence: manual ? "MANUAL" : "SOURCE_ID" });
  }
  const values = [...groups.values()];
  let merged;
  do {
    merged = false;
    outer: for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i], b = values[j];
        if (!a || !b || sourcesOverlap(a, b) || conflictingManualKeys(a, b)) continue;
        const score = groupMatchScore(a, b, config.identity);
        const unambiguous = score >= 0.82 && score - secondBestScore(values, i, j, config) >= config.identity.ambiguityMargin && score - secondBestScore(values, j, i, config) >= config.identity.ambiguityMargin;
        if (!unambiguous) continue;
        values[i] = mergeGroups(a, b);
        values[j] = null;
        merged = true;
        break outer;
      }
    }
  } while (merged);
  return preservePreviousKeys(values.filter(Boolean), previousSnapshot).map(group => canonicalize(group, config.ranking.sourcePriority));
}

function preservePreviousKeys(groups, previousSnapshot) {
  const memberToKey = new Map();
  for (const station of previousSnapshot?.assessments ?? []) for (const member of station.members ?? []) memberToKey.set(`${member.source}:${member.sourceStationId}`, station.stationKey);
  const claimed = new Set();
  return groups.map(group => {
    if (group.stationKey.startsWith("manual:")) return group;
    const keys = new Set(group.members.map(member => memberToKey.get(`${member.source}:${member.sourceStationId}`)).filter(Boolean));
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
  const distance = haversineMeters(a.coordinate, b.coordinate);
  if (distance > identity.maxCoordinateDriftMeters) return -Infinity;
  const addressA = normalizeAddress(a.address, identity.streetDictionary), addressB = normalizeAddress(b.address, identity.streetDictionary);
  const titleA = normalizeText(a.title), titleB = normalizeText(b.title);
  const addressScore = tokenSimilarity(addressA, addressB);
  const titleScore = tokenSimilarity(titleA, titleB);
  const numberA = houseNumber(addressA), numberB = houseNumber(addressB);
  if (numberA && numberB && numberA !== numberB) return -Infinity;
  if (brandA && brandA === brandB && addressA && addressA === addressB && numberA && distance <= 5) return 1.2;
  const brandScore = brandA && brandA === brandB ? 1 : 0;
  return 0.45 * (1 - distance / identity.maxCoordinateDriftMeters) + 0.4 * addressScore + 0.15 * Math.max(titleScore, brandScore);
}
function groupMatchScore(a, b, identity) {
  const scores = a.members.flatMap(left => b.members.map(right => matchScore(left, right, identity)));
  return scores.length ? Math.min(...scores) : -Infinity;
}
function secondBestScore(values, targetIndex, excludedIndex, config) {
  const target = values[targetIndex];
  const counterpart = values[excludedIndex];
  if (!target || !counterpart) return 0;
  return Math.max(0, ...values.map((candidate, index) => index === targetIndex || index === excludedIndex || !candidate || !sourcesOverlap(candidate, counterpart) || sourcesOverlap(target, candidate) || conflictingManualKeys(target, candidate) ? -Infinity : groupMatchScore(target, candidate, config.identity)));
}
function sourcesOverlap(a, b) {
  const sources = new Set(a.members.map(member => member.source));
  return b.members.some(member => sources.has(member.source));
}
function conflictingManualKeys(a, b) {
  return a.stationKey.startsWith("manual:") && b.stationKey.startsWith("manual:") && a.stationKey !== b.stationKey;
}
function mergeGroups(a, b) {
  const members = [...a.members, ...b.members];
  const manualKey = [a.stationKey, b.stationKey].find(key => key.startsWith("manual:"));
  return { stationKey: manualKey ?? `merged:${sha256(members.map(member => `${member.source}:${member.sourceStationId}`).sort()).slice(0, 20)}`, members, matchConfidence: manualKey ? "MANUAL" : "HIGH" };
}
function canonicalize(group, priority) {
  const members = [...group.members].sort((a, b) => priority.indexOf(a.source) - priority.indexOf(b.source) || a.source.localeCompare(b.source));
  const best = members[0];
  return { stationKey: group.stationKey, title: best.title || brandLabel(best.brand) || best.address || "АЗС", brand: brandLabel(best.brand) || undefined, address: best.address, coordinate: best.coordinate, members, matchConfidence: group.matchConfidence };
}
function overrideIndex(overrides) {
  const out = new Map();
  for (const override of overrides) {
    const sources = new Set();
    for (const member of override.members) {
      if (sources.has(member.source)) throw new Error(`Manual identity override ${override.stationKey} contains multiple ${member.source} stations`);
      sources.add(member.source);
      out.set(`${member.source}:${member.sourceStationId}`, override.stationKey);
    }
  }
  return out;
}
function fallbackKey(s, identity) { return `anon:${sha256(`${normalizeComparableBrand(s.brand, identity.brandAliases) || normalizeBrand(s.brand)}|${normalizeAddress(s.address, identity.streetDictionary)}|${s.coordinate.join(",")}`).slice(0, 20)}`; }
function houseNumber(address) {
  const tokens = address.split(" ").filter(Boolean);
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (!/^\d+[а-яa-z]?$/u.test(tokens[index])) continue;
    const suffix = tokens[index + 1];
    return suffix && /^[а-яa-z]$/u.test(suffix) ? `${tokens[index]}${suffix}` : tokens[index];
  }
  return undefined;
}
function tokenSimilarity(a, b) { if (!a || !b) return 0; const aa = new Set(a.split(" ")), bb = new Set(b.split(" ")); const common = [...aa].filter(x => bb.has(x)).length; return common / new Set([...aa, ...bb]).size; }
