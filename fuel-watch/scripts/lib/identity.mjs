import { haversineMeters } from "./geometry.mjs";
import { sha256 } from "./util.mjs";

export function reconcileStations(stations, config, previousSnapshot) {
  const overrides = overrideIndex(config.identity.manualOverrides);
  const groups = new Map();
  for (const station of stations) {
    const member = `${station.source}:${station.sourceStationId ?? ""}`;
    const manual = overrides.get(member);
    const key = manual ? `manual:${manual}` : station.sourceStationId ? `source:${station.source}:${station.sourceStationId}` : fallbackKey(station);
    const existing = groups.get(key);
    if (existing) existing.members.push(station);
    else groups.set(key, { stationKey: key, members: [station], matchConfidence: manual ? "MANUAL" : "SOURCE_ID" });
  }
  const values = [...groups.values()];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const a = values[i], b = values[j];
      if (!a || !b || a.members[0].source === b.members[0].source) continue;
      const score = matchScore(a.members[0], b.members[0], config.identity.maxCoordinateDriftMeters);
      const exactIdentity = isExactIdentityMatch(a.members[0], b.members[0], config.identity.maxCoordinateDriftMeters);
      if (exactIdentity || score >= 0.82 && score - secondBestScore(values, i, j, config) >= config.identity.ambiguityMargin) {
        const members = [...a.members, ...b.members];
        const stationKey = `merged:${sha256(members.map(m => `${m.source}:${m.sourceStationId}`).sort()).slice(0, 20)}`;
        values[i] = { stationKey, members, matchConfidence: "HIGH" };
        values[j] = null;
      }
    }
  }
  return preservePreviousKeys(values.filter(Boolean), previousSnapshot).map(group => canonicalize(group, config.ranking.sourcePriority));
}

function preservePreviousKeys(groups, previousSnapshot) {
  const memberToKey = new Map();
  for (const station of previousSnapshot?.assessments ?? []) for (const member of station.members ?? []) memberToKey.set(`${member.source}:${member.sourceStationId}`, station.stationKey);
  const claimed = new Set();
  return groups.map(group => {
    const keys = new Set(group.members.map(member => memberToKey.get(`${member.source}:${member.sourceStationId}`)).filter(Boolean));
    if (keys.size !== 1) return group;
    const [key] = keys;
    if (claimed.has(key)) return group;
    claimed.add(key);
    return { ...group, stationKey: key, matchConfidence: group.matchConfidence === "MANUAL" ? "MANUAL" : "PREVIOUS_MEMBER" };
  });
}

function matchScore(a, b, maxMeters) {
  const brandA = normalizeBrand(a.brand), brandB = normalizeBrand(b.brand);
  if (brandA && brandB && brandA !== brandB) return -Infinity;
  const distance = haversineMeters(a.coordinate, b.coordinate);
  if (distance > maxMeters) return -Infinity;
  const addressA = normalizeAddress(a.address), addressB = normalizeAddress(b.address);
  const titleA = normalizeText(a.title), titleB = normalizeText(b.title);
  const addressScore = tokenSimilarity(addressA, addressB);
  const titleScore = tokenSimilarity(titleA, titleB);
  const numberA = addressA.match(/\b\d+[а-яa-z]?\b/u)?.[0], numberB = addressB.match(/\b\d+[а-яa-z]?\b/u)?.[0];
  if (numberA && numberB && numberA !== numberB) return -Infinity;
  return 0.45 * (1 - distance / maxMeters) + 0.4 * addressScore + 0.15 * titleScore;
}
function isExactIdentityMatch(a, b, maxMeters) {
  const brandA = normalizeBrand(a.brand), brandB = normalizeBrand(b.brand);
  const addressA = normalizeAddress(a.address), addressB = normalizeAddress(b.address);
  const number = addressA.match(/\b\d+[а-яa-z]?\b/u)?.[0];
  return Boolean(brandA && brandB && brandA === brandB && addressA && addressA === addressB && number && haversineMeters(a.coordinate, b.coordinate) <= maxMeters);
}
function secondBestScore(values, ai, bj, config) {
  const target = values[ai].members[0];
  return Math.max(0, ...values.map((g, index) => index === ai || index === bj || !g || g.members[0].source === target.source ? -Infinity : matchScore(target, g.members[0], config.identity.maxCoordinateDriftMeters)));
}
function canonicalize(group, priority) {
  const members = [...group.members].sort((a, b) => priority.indexOf(a.source) - priority.indexOf(b.source) || a.source.localeCompare(b.source));
  const best = members[0];
  return { stationKey: group.stationKey, title: best.title || best.brand || best.address || "АЗС", brand: best.brand, address: best.address, coordinate: best.coordinate, members, matchConfidence: group.matchConfidence };
}
function overrideIndex(overrides) { const out = new Map(); for (const o of overrides) for (const m of o.members) out.set(`${m.source}:${m.sourceStationId}`, o.stationKey); return out; }
function fallbackKey(s) { return `anon:${sha256(`${normalizeBrand(s.brand)}|${normalizeAddress(s.address)}|${s.coordinate.join(",")}`).slice(0, 20)}`; }
function normalizeBrand(value) { return normalizeText(typeof value === "object" && value ? value.name ?? value.title ?? value.brand : value); }
function normalizeAddress(value) {
  const ignored = new Set(["россия", "рф", "волгоградская", "область", "обл", "город", "г", "волгоград", "улица", "ул", "имени", "им"]);
  return normalizeText(value).split(" ").filter(token => token && !ignored.has(token)).join(" ");
}
function normalizeText(v) { return String(v ?? "").normalize("NFKC").toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function tokenSimilarity(a, b) { if (!a || !b) return 0; const aa = new Set(a.split(" ")), bb = new Set(b.split(" ")); const common = [...aa].filter(x => bb.has(x)).length; return common / new Set([...aa, ...bb]).size; }
