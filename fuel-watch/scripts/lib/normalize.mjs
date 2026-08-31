export function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function brandLabel(value) {
  if (value == null) return "";
  if (["string", "number", "bigint"].includes(typeof value)) return String(value).trim();
  if (Array.isArray(value)) return [...new Set(value.map(brandLabel).filter(Boolean))].join(" / ");
  if (typeof value !== "object") return "";
  for (const key of ["name", "alias", "title", "brand"]) {
    const label = brandLabel(value[key]);
    if (label) return label;
  }
  if (value.id != null) return `brand-id:${String(value.id)}`;
  const opaque = Object.entries(value).filter(([, item]) => item != null && typeof item !== "object").sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${key}:${String(item)}`).join("|");
  return opaque ? `brand:${opaque}` : "opaque-brand";
}

export function normalizeBrand(value) {
  return normalizeText(brandLabel(value));
}

export function compileBrandAliases(dictionary = {}) {
  const aliases = new Map();
  for (const [canonical, values] of Object.entries(dictionary)) {
    const normalizedCanonical = normalizeText(canonical);
    aliases.set(normalizedCanonical, normalizedCanonical);
    for (const value of values) aliases.set(normalizeText(value), normalizedCanonical);
  }
  return aliases;
}

export function normalizeComparableBrand(value, aliases = {}) {
  const label = brandLabel(value);
  if (/^(?:brand-id:|brand:|opaque-brand$)/u.test(label)) return "";
  return canonicalValue(normalizeText(label), aliases);
}

export function compileStreetDictionary(dictionary = {}) {
  return Object.entries(dictionary).flatMap(([canonical, aliases]) => [canonical, ...aliases].map(alias => ({ alias: normalizeText(alias).split(" ").filter(Boolean), canonical: normalizeText(canonical).split(" ").filter(Boolean) }))).filter(entry => entry.alias.length).sort((a, b) => b.alias.length - a.alias.length);
}

export function normalizeAddress(value, dictionary = {}) {
  const protectedValue = String(value ?? "").replace(/(?<!\d)(\d{1,4}[а-яa-z]?)\s+г(?=\s*(?:[,;.]|$|\p{L}))/giu, "$1 houseletterg");
  const ignored = new Set(["россия", "рф", "волгоградская", "область", "обл", "город", "г", "волгоград", "улица", "ул", "имени", "им"]);
  const rawTokens = normalizeText(protectedValue).split(" ").filter(token => token && !ignored.has(token) && !/^\d{6}$/u.test(token)).map(token => token === "houseletterg" ? "г" : token);
  const tokens = [];
  const unitKinds = new Map([["к", "корпус"], ["корп", "корпус"], ["корпус", "корпус"], ["стр", "строение"], ["строение", "строение"]]);
  for (let index = 0; index < rawTokens.length; index++) {
    const token = rawTokens[index], next = rawTokens[index + 1], afterNext = rawTokens[index + 2];
    if (/^\d+$/u.test(token) && next && /^[а-яa-z]$/u.test(next) && !(unitKinds.has(next) && /^\d+[а-яa-z]?$/u.test(afterNext ?? ""))) {
      tokens.push(`${token}${next}`);
      index++;
      continue;
    }
    tokens.push(unitKinds.get(token) ?? token);
  }
  return applyPhraseDictionary(tokens, dictionary).join(" ");
}

function canonicalValue(value, dictionary) {
  if (dictionary instanceof Map) return dictionary.get(value) ?? value;
  for (const [canonical, aliases] of Object.entries(dictionary ?? {})) {
    const normalizedCanonical = normalizeText(canonical);
    if (value === normalizedCanonical || aliases.some(alias => value === normalizeText(alias))) return normalizedCanonical;
  }
  return value;
}

function applyPhraseDictionary(tokens, dictionary) {
  const entries = Array.isArray(dictionary) ? dictionary : compileStreetDictionary(dictionary);
  const result = [...tokens];
  for (const entry of entries) {
    for (let index = 0; index <= result.length - entry.alias.length; index++) {
      if (!entry.alias.every((token, offset) => result[index + offset] === token)) continue;
      result.splice(index, entry.alias.length, ...entry.canonical);
      index += entry.canonical.length - 1;
    }
  }
  return result;
}
