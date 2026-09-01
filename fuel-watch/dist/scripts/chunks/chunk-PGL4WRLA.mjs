import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);

// scripts/lib/normalize.mjs
function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replaceAll("\u0451", "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function brandLabel(value) {
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
function normalizeBrand(value) {
  return normalizeText(brandLabel(value));
}
function compileBrandAliases(dictionary = {}) {
  const aliases = /* @__PURE__ */ new Map();
  for (const [canonical, values] of Object.entries(dictionary)) {
    const normalizedCanonical = normalizeText(canonical);
    aliases.set(normalizedCanonical, normalizedCanonical);
    for (const value of values) aliases.set(normalizeText(value), normalizedCanonical);
  }
  return aliases;
}
function normalizeComparableBrand(value, aliases = {}) {
  const label = brandLabel(value);
  if (/^(?:brand-id:|brand:|opaque-brand$)/u.test(label)) return "";
  return canonicalValue(normalizeText(label), aliases);
}
function compileStreetDictionary(dictionary = {}) {
  return Object.entries(dictionary).flatMap(([canonical, aliases]) => [canonical, ...aliases].map((alias) => ({ alias: normalizeText(alias).split(" ").filter(Boolean), canonical: normalizeText(canonical).split(" ").filter(Boolean) }))).filter((entry) => entry.alias.length).sort((a, b) => b.alias.length - a.alias.length);
}
var ADDRESS_UNIT_KINDS = /* @__PURE__ */ new Set(["\u043A\u043E\u0440\u043F\u0443\u0441", "\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435", "\u043B\u0438\u0442\u0435\u0440\u0430", "\u0432\u043B\u0430\u0434\u0435\u043D\u0438\u0435", "\u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435"]);
function isAddressUnitValue(kind, value, { allowLetter = ["\u043A\u043E\u0440\u043F\u0443\u0441", "\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435", "\u043B\u0438\u0442\u0435\u0440\u0430"].includes(kind) } = {}) {
  return allowLetter ? /^(?:\d+[а-яa-z]?|[а-яa-z])$/u.test(value ?? "") : /^\d+[а-яa-z]?$/u.test(value ?? "");
}
function normalizeAddress(value, dictionary = {}) {
  const protectedValue = String(value ?? "").replace(/(?<!\d)(\d{1,4}[а-яa-z]?)\s*\/\s*(\d+[а-яa-z]?)/giu, "$1 \u043A\u043E\u0440\u043F\u0443\u0441 $2").replace(new RegExp("(?<!\\d)(\\d{1,4}[\u0430-\u044Fa-z]?)\\s+\u0433(?=\\s*(?:[,;.]|$|\\p{L}))", "giu"), "$1 houseletterg");
  const ignored = /* @__PURE__ */ new Set(["\u0440\u043E\u0441\u0441\u0438\u044F", "\u0440\u0444", "\u0432\u043E\u043B\u0433\u043E\u0433\u0440\u0430\u0434\u0441\u043A\u0430\u044F", "\u043E\u0431\u043B\u0430\u0441\u0442\u044C", "\u043E\u0431\u043B", "\u0433\u043E\u0440\u043E\u0434", "\u0433", "\u0432\u043E\u043B\u0433\u043E\u0433\u0440\u0430\u0434", "\u0443\u043B\u0438\u0446\u0430", "\u0443\u043B", "\u0438\u043C\u0435\u043D\u0438", "\u0438\u043C"]);
  const rawTokens = normalizeText(protectedValue).split(" ").filter((token) => token && !ignored.has(token) && !/^\d{6}$/u.test(token)).map((token) => token === "houseletterg" ? "\u0433" : token);
  const tokens = [];
  const unitKinds = /* @__PURE__ */ new Map([["\u043A", "\u043A\u043E\u0440\u043F\u0443\u0441"], ["\u043A\u043E\u0440\u043F", "\u043A\u043E\u0440\u043F\u0443\u0441"], ["\u043A\u043E\u0440\u043F\u0443\u0441", "\u043A\u043E\u0440\u043F\u0443\u0441"], ["\u0441\u0442\u0440", "\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435"], ["\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435", "\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435"], ["\u043B\u0438\u0442", "\u043B\u0438\u0442\u0435\u0440\u0430"], ["\u043B\u0438\u0442\u0435\u0440\u0430", "\u043B\u0438\u0442\u0435\u0440\u0430"], ["\u0432\u043B\u0430\u0434", "\u0432\u043B\u0430\u0434\u0435\u043D\u0438\u0435"], ["\u0432\u043B\u0430\u0434\u0435\u043D\u0438\u0435", "\u0432\u043B\u0430\u0434\u0435\u043D\u0438\u0435"], ["\u0441\u043E\u043E\u0440", "\u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435"], ["\u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435", "\u0441\u043E\u043E\u0440\u0443\u0436\u0435\u043D\u0438\u0435"]]);
  for (let index = 0; index < rawTokens.length; index++) {
    const token = rawTokens[index], next = rawTokens[index + 1], afterNext = rawTokens[index + 2];
    if (/^\d+$/u.test(token) && next && /^[а-яa-z]$/u.test(next) && !(unitKinds.has(next) && /^\d+[а-яa-z]?$/u.test(afterNext ?? ""))) {
      tokens.push(`${token}${next}`);
      index++;
      continue;
    }
    const unitKind = unitKinds.get(token);
    const ambiguousSingleLetter = token === "\u043A";
    tokens.push(unitKind && isAddressUnitValue(unitKind, next, { allowLetter: !ambiguousSingleLetter && ["\u043A\u043E\u0440\u043F\u0443\u0441", "\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435", "\u043B\u0438\u0442\u0435\u0440\u0430"].includes(unitKind) }) ? unitKind : token);
  }
  return applyPhraseDictionary(tokens, dictionary).join(" ");
}
function canonicalValue(value, dictionary) {
  if (dictionary instanceof Map) return dictionary.get(value) ?? value;
  for (const [canonical, aliases] of Object.entries(dictionary ?? {})) {
    const normalizedCanonical = normalizeText(canonical);
    if (value === normalizedCanonical || aliases.some((alias) => value === normalizeText(alias))) return normalizedCanonical;
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

export {
  normalizeText,
  brandLabel,
  normalizeBrand,
  compileBrandAliases,
  normalizeComparableBrand,
  compileStreetDictionary,
  ADDRESS_UNIT_KINDS,
  isAddressUnitValue,
  normalizeAddress
};
