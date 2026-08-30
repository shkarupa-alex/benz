const HOMOGLYPHS = new Map([["a", "а"], ["i", "и"], ["e", "е"], ["o", "о"], ["p", "р"], ["c", "с"], ["x", "х"], ["y", "у"], ["k", "к"], ["m", "м"], ["t", "т"], ["b", "в"], ["h", "н"]]);

export function normalizeFuelLabel(input) {
  return String(input ?? "").normalize("NFKC").toLowerCase().replaceAll("ё", "е")
    .replace(/[a-z]/g, char => HOMOGLYPHS.get(char) ?? char)
    .replace(/[-_‐‑‒–—]+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function classifyFuelLabel(label, requestedProducts) {
  const normalized = normalizeFuelLabel(label);
  if (!hasAi95Token(normalized)) return null;
  const candidates = [];
  for (const product of requestedProducts.products) {
    for (const alias of product.aliases) {
      const normalizedAlias = normalizeFuelLabel(alias);
      if (product.variant === "BASE" ? isBaseAi95(normalized) : normalized.includes(normalizedAlias)) candidates.push({ product, length: normalizedAlias.length });
    }
  }
  candidates.sort((a, b) => b.length - a.length || a.product.productKey.localeCompare(b.product.productKey));
  if (candidates.length) return toFuelProduct(candidates[0].product, label);
  if (!requestedProducts.includeUnrecognizedAi95Variants) return null;
  return { family: "AI_95", variant: "UNKNOWN", variantKey: "UNKNOWN", displayLabel: String(label), specificity: "EXACT_VARIANT", productKey: "AI95_UNKNOWN" };
}

export function hasAi95Token(normalized) { return /(?:^|\s)(?:аи\s*)?95(?:\s|$)/u.test(normalized); }
function isBaseAi95(normalized) { return /^(?:аи\s*)?95$/u.test(normalized); }
function toFuelProduct(product, label) { return { family: product.family, variant: product.variant, variantKey: product.variantKey, displayLabel: String(label), specificity: "EXACT_VARIANT", productKey: product.productKey }; }
