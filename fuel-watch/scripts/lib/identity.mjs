import { haversineMeters } from "./geometry.mjs";
import { ADDRESS_UNIT_KINDS, brandLabel, compileBrandAliases, compileStreetDictionary, isAddressUnitValue, normalizeAddress, normalizeBrand, normalizeComparableBrand, normalizeText } from "./normalize.mjs";
import { sha256 } from "./util.mjs";

export function reconcileStations(stations, config, previousSnapshot, diagnostics = [], { useSpatialIndex = true } = {}) {
  const identity = { ...config.identity, brandAliases: compileBrandAliases(config.identity.brandAliases), streetDictionary: compileStreetDictionary(config.identity.streetDictionary) };
  const overrides = overrideIndex(config.identity.manualOverrides);
  const groups = new Map();
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
        // Negated comparisons so a NaN score (an unusable coordinate makes the distance NaN) fails closed instead
        // of slipping past both thresholds: NaN < 0.82 and NaN >= 0.82 are both false.
        if (!(score >= 0.82)) continue;
        const runnerUp = Math.max(secondBestScore(values, i, j, identity, neighbors), secondBestScore(values, j, i, identity, neighbors));
        if (!(score - runnerUp >= identity.ambiguityMargin)) {
          recordDiagnostic(diagnostics, { kind: "AMBIGUOUS_MATCH", members: [...a.members, ...b.members].map(member => `${member.source}:${member.sourceStationId}`).sort(), score: Number(score.toFixed(4)), runnerUpScore: Number(runnerUp.toFixed(4)) });
          continue;
        }
        values[i] = mergeGroups(a, b);
        values[j] = null;
        merged = true;
        break outer;
      }
    }
  } while (merged);
  return preservePreviousKeys(values.filter(Boolean), previousSnapshot).map(group => canonicalize(group, config.ranking.sourcePriority));
}

// Identity uncertainty is an internal signal about matching, never a statement about fuel; the caller keeps it
// out of the user-facing report. The cap keeps a pathological area from filling the snapshot with near-duplicates.
const MAX_IDENTITY_DIAGNOSTICS = 100;
function recordDiagnostic(diagnostics, entry) {
  const key = stableDiagnosticKey(entry);
  if (diagnostics.length >= MAX_IDENTITY_DIAGNOSTICS || diagnostics.some(value => stableDiagnosticKey(value) === key)) return;
  diagnostics.push(entry);
}
function stableDiagnosticKey(entry) { return `${entry.kind}|${entry.members?.join(",") ?? `${entry.source}:${entry.sourceStationId}`}`; }

// Any pair farther apart than maxCoordinateDriftMeters already scores -Infinity, and secondBestScore floors at 0,
// so restricting both scans to spatial neighbours changes which pairs are examined, never which pair wins. Groups
// without a usable coordinate keep the full scan, because distance alone never rejects them.
function spatialNeighbors(values, identity, enabled = true) {
  const everyLiveIndex = values.map((group, index) => group ? index : -1).filter(index => index >= 0);
  // Turning the index off must leave exactly the exhaustive scan behind, which is what the equivalence test compares against.
  if (!enabled) return () => everyLiveIndex;
  const coordinates = values.flatMap(group => group ? group.members.map(member => member.coordinate) : []);
  const maxAbsLat = Math.max(0, ...coordinates.map(coordinate => Math.abs(Number(coordinate?.[1]))).filter(Number.isFinite));
  const latCell = identity.maxCoordinateDriftMeters / 111320;
  const lonCell = identity.maxCoordinateDriftMeters / (111320 * Math.max(0.01, Math.cos(maxAbsLat * Math.PI / 180)));
  const cells = new Map();
  const unindexed = new Set();
  const keysOf = group => {
    const out = new Set();
    for (const member of group.members) {
      const lon = Number(member.coordinate?.[0]), lat = Number(member.coordinate?.[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      out.add(`${Math.floor(lon / lonCell)}:${Math.floor(lat / latCell)}`);
    }
    return out.size ? out : null;
  };
  const keysByIndex = new Map();
  for (const [index, group] of values.entries()) {
    if (!group) continue;
    const keys = keysOf(group);
    if (!keys) { unindexed.add(index); continue; }
    keysByIndex.set(index, keys);
    for (const key of keys) { const bucket = cells.get(key) ?? new Set(); bucket.add(index); cells.set(key, bucket); }
  }
  return index => {
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
  const partsA = addressParts(addressA), partsB = addressParts(addressB);
  if (partsA.house && partsB.house && partsA.house !== partsB.house) return -Infinity;
  for (const kind of ADDRESS_UNIT_KINDS) if (partsA.units[kind] && partsB.units[kind] && partsA.units[kind] !== partsB.units[kind]) return -Infinity;
  if (brandA && brandA === brandB && addressA && addressA === addressB && partsA.house && distance <= 5) return 1.2;
  const brandScore = brandA && brandA === brandB ? 1 : 0;
  return 0.45 * (1 - distance / identity.maxCoordinateDriftMeters) + 0.4 * addressScore + 0.15 * Math.max(titleScore, brandScore);
}
function groupMatchScore(a, b, identity) {
  const scores = a.members.flatMap(left => b.members.map(right => matchScore(left, right, identity)));
  return scores.length ? Math.min(...scores) : -Infinity;
}
function secondBestScore(values, targetIndex, excludedIndex, identity, neighbors) {
  const target = values[targetIndex];
  const counterpart = values[excludedIndex];
  if (!target || !counterpart) return 0;
  return Math.max(0, ...neighbors(targetIndex).map(index => { const candidate = values[index]; return index === targetIndex || index === excludedIndex || !candidate || !sourcesOverlap(candidate, counterpart) || sourcesOverlap(target, candidate) || conflictingManualKeys(target, candidate) ? -Infinity : groupMatchScore(target, candidate, identity); }));
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
  return { house: undefined, units };
}
function tokenSimilarity(a, b) { if (!a || !b) return 0; const aa = new Set(a.split(" ")), bb = new Set(b.split(" ")); const common = [...aa].filter(x => bb.has(x)).length; return common / new Set([...aa, ...bb]).size; }
