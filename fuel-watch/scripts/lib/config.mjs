import Ajv2020 from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFuelLabel } from "./fuels.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const defaultConfigPath = resolve(here, "../../config/config.json");
const schemaPath = resolve(here, "../../config/config.schema.json");

export async function loadConfig(path = defaultConfigPath) {
  const [config, schema] = await Promise.all([readJsonWithPath(path), readJsonWithPath(schemaPath)]);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(config)) throw new ConfigError(validate.errors.map(formatAjvError));
  validateSemantics(config);
  config.browser.configPath = resolve(dirname(path), config.browser.configPath);
  return config;
}

async function readJsonWithPath(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { throw new ConfigError([`${path}: ${error.message}`]); }
}

function formatAjvError(error) { return `${error.instancePath || "/"} ${error.message}`; }

function validateSemantics(config) {
  const errors = [];
  uniqueBy(config.sources, value => value.id, "/sources id", errors);
  uniqueBy(config.sources, value => value.order, "/sources order", errors);
  uniqueBy(config.requestedProducts.products, value => value.productKey, "/requestedProducts/products productKey", errors);
  const aliases = new Map();
  for (const product of config.requestedProducts.products) {
    for (const rawAlias of product.aliases) {
      const alias = normalizeFuelLabel(rawAlias);
      if (aliases.has(alias) && aliases.get(alias) !== product.productKey) errors.push(`/requestedProducts alias ${JSON.stringify(alias)} belongs to both ${aliases.get(alias)} and ${product.productKey}`);
      aliases.set(alias, product.productKey);
    }
  }
  const members = config.identity.manualOverrides.flatMap(o => o.members.map(m => ({ ...m, stationKey: o.stationKey })));
  uniqueBy(members, value => `${value.source}:${value.sourceStationId}`, "/identity/manualOverrides members", errors);
  const f = config.freshness;
  if (!(f.freshMinutes < f.recentMinutes && f.recentMinutes <= f.staleMinutes && f.staleMinutes <= f.expireMinutes)) errors.push("/freshness thresholds must be monotonic: fresh < recent <= stale <= expire");
  const q = config.queue.ordinalMaxVehicles;
  if (!(q.NONE <= q.SHORT && q.SHORT < q.MEDIUM && q.MEDIUM < q.LONG)) errors.push("/queue/ordinalMaxVehicles must be monotonic");
  if (config.area.kind === "rectangle" && !(config.area.south < config.area.north && config.area.west < config.area.east)) errors.push("/area rectangle bounds are reversed");
  if (errors.length) throw new ConfigError(errors);
}

function uniqueBy(items, key, label, errors) {
  const seen = new Set();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) errors.push(`${label} contains duplicate ${JSON.stringify(value)}`);
    seen.add(value);
  }
}

export class ConfigError extends Error {
  constructor(errors) { super(`Invalid fuel-watch config:\n${errors.map(e => `- ${e}`).join("\n")}`); this.name = "ConfigError"; this.errors = errors; }
}
