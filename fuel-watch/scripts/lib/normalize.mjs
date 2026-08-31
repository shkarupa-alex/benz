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

export function normalizeComparableBrand(value, aliases = {}) {
  const label = brandLabel(value);
  if (/^(?:brand-id:|brand:|opaque-brand$)/u.test(label)) return "";
  return canonicalValue(normalizeText(label), aliases);
}

export function normalizeAddress(value, dictionary = {}) {
  const protectedValue = String(value ?? "").replace(/(\d+[а-яa-z]?)\s+г(?=\s*(?:[,;.]|$|\p{L}))/giu, "$1 houseletterg");
  const ignored = new Set(["россия", "рф", "волгоградская", "область", "обл", "город", "г", "волгоград", "улица", "ул", "имени", "им"]);
  const tokens = normalizeText(protectedValue).split(" ").filter(token => token && !ignored.has(token)).map(token => token === "houseletterg" ? "г" : token);
  return applyPhraseDictionary(tokens, dictionary).join(" ");
}

function canonicalValue(value, dictionary) {
  for (const [canonical, aliases] of Object.entries(dictionary ?? {})) {
    const normalizedCanonical = normalizeText(canonical);
    if (value === normalizedCanonical || aliases.some(alias => value === normalizeText(alias))) return normalizedCanonical;
  }
  return value;
}

function applyPhraseDictionary(tokens, dictionary) {
  const entries = Object.entries(dictionary ?? {}).flatMap(([canonical, aliases]) => [canonical, ...aliases].map(alias => ({ alias: normalizeText(alias).split(" ").filter(Boolean), canonical: normalizeText(canonical).split(" ").filter(Boolean) }))).filter(entry => entry.alias.length).sort((a, b) => b.alias.length - a.alias.length);
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
