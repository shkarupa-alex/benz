import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/lib/fuels.mjs
var HOMOGLYPHS = /* @__PURE__ */ new Map([["a", "\u0430"], ["i", "\u0438"], ["e", "\u0435"], ["o", "\u043E"], ["p", "\u0440"], ["c", "\u0441"], ["x", "\u0445"], ["y", "\u0443"], ["k", "\u043A"], ["m", "\u043C"], ["t", "\u0442"], ["b", "\u0432"], ["h", "\u043D"]]);
function normalizeFuelLabel(input) {
  return String(input ?? "").normalize("NFKC").toLowerCase().replaceAll("\u0451", "\u0435").replace(/[a-z]/g, (char) => HOMOGLYPHS.get(char) ?? char).replace(/\+/g, " \u043F\u043B\u044E\u0441 ").replace(/[-_‐‑‒–—]+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
function classifyFuelLabel(label, requestedProducts) {
  const normalized = normalizeFuelLabel(label);
  if (!hasAi95Token(normalized)) return null;
  if (/(?:^|\s)плюс(?:\s|$)/u.test(normalized)) {
    const premium = requestedProducts.products.find((product) => product.productKey === "AI95_PREMIUM_GENERIC");
    return premium ? toFuelProduct(premium, label) : unknownProduct(label, "PREMIUM");
  }
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
  return unknownProduct(label);
}
function petrolOctaneKey(value = {}) {
  const product = value.product ?? {};
  const productKey = String(value.productKey ?? product.productKey ?? "");
  const family = String(value.family ?? product.family ?? "");
  const encoded = productKey.match(/^AI(92|95|98|100)(?:_|$)/u)?.[1] ?? family.match(/^AI[_-]?(92|95|98|100)$/u)?.[1];
  if (encoded) return encoded;
  const label = normalizeFuelLabel(value.gradeLabel ?? value.displayLabel ?? product.displayLabel ?? "");
  return label.match(/(?:^|\s)(?:аи\s*)?(92|95|98|100)(?:\s|$)/u)?.[1];
}
function hasAi95Token(normalized) {
  return /(?:^|\s)(?:аи\s*)?95(?:\s|$)/u.test(normalized);
}
function isBaseAi95(normalized) {
  return /^(?:аи\s*)?95$/u.test(normalized);
}
function toFuelProduct(product, label) {
  return { family: product.family, variant: product.variant, variantKey: product.variantKey, displayLabel: String(label), specificity: "EXACT_VARIANT", productKey: product.productKey };
}
function unknownProduct(label, variant = "UNKNOWN") {
  return { family: "AI_95", variant, variantKey: variant, displayLabel: String(label), specificity: "EXACT_VARIANT", productKey: "AI95_UNKNOWN" };
}

export {
  __require,
  __commonJS,
  __toESM,
  normalizeFuelLabel,
  classifyFuelLabel,
  petrolOctaneKey
};
