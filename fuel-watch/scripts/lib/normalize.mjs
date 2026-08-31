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

export function normalizeComparableBrand(value) {
  const label = brandLabel(value);
  if (/^(?:brand-id:|brand:|opaque-brand$)/u.test(label)) return "";
  return normalizeText(label);
}

export function normalizeAddress(value) {
  const ignored = new Set(["россия", "рф", "волгоградская", "область", "обл", "город", "волгоград", "улица", "ул", "имени", "им"]);
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  return tokens.filter((token, index) => {
    if (ignored.has(token)) return false;
    if (token !== "г") return true;
    const next = tokens[index + 1];
    return !next || /^\d/u.test(next);
  }).join(" ");
}
