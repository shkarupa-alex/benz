#!/usr/bin/env node
import { resolve } from "node:path";
import { BrowserRunner } from "./lib/browser-runner.mjs";
import { defaultBrowserConfigPath, defaultConfigPath, defaultSchemaPath, loadConfig } from "./lib/config.mjs";
import { ensureUserConfig } from "./lib/paths.mjs";
import { resolveArea } from "./lib/geometry.mjs";
import { isMainModule, stableJson, writeJsonAtomic } from "./lib/util.mjs";

export async function verifyAnchors(configPath, browserFactory = config => new BrowserRunner(config)) {
  const config = await loadConfig(configPath);
  if (config.area.kind !== "station-anchors") throw new Error("Configured area is not station-anchors");
  const browser = browserFactory(config), resolved = [];
  try {
    for (const anchor of config.area.anchors) {
      const query = `${anchor.label}, Волгоград, АЗС`;
      await browser.open(`https://yandex.ru/maps/38/volgograd/search/${encodeURIComponent(query)}/`);
      const page = await browser.snapshot();
      if (/^limited$/i.test(page.textPrefix.trim())) throw Object.assign(new Error("Yandex returned HTTP 429 limited; anchors were not changed"), { code: "HTTP_ERROR_PAGE" });
      await browser.waitReady({ anyOfSelectors: ["script", "[data-chunk=search-result]", ".search-snippet-view"], urlRejectPatterns: ["captcha", "showcaptcha"], timeoutMs: 20000 });
      const point = await browser.evalJson(`(() => { const links=[...document.querySelectorAll('a[href*="ll="]')].map(a=>a.href); for(const href of links){const m=href.match(/[?&]ll=([0-9.-]+)%2C([0-9.-]+)/);if(m)return [Number(m[1]),Number(m[2])];} const text=[...document.scripts].map(s=>s.textContent||'').find(t=>t.includes('coordinates')); if(text){const m=text.match(/"coordinates"\s*:\s*\[\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*\]/);if(m)return [Number(m[1]),Number(m[2])];} return null;})()`);
      resolved.push({ ...anchor, resolvedPoint: point, driftMeters: point ? approximateMeters(anchor.point, point) : null });
    }
  } finally { await browser.close(); }
  return resolved;
}
function approximateMeters(a, b) { const dy = (a[1] - b[1]) * 111320, dx = (a[0] - b[0]) * 111320 * Math.cos(a[1] * Math.PI / 180); return Math.hypot(dx, dy); }
export async function writeResolvedAnchors(configPath, values) {
  const unresolved = values.filter(value => !Array.isArray(value.resolvedPoint) || value.resolvedPoint.length !== 2 || value.resolvedPoint.some(point => !Number.isFinite(point)));
  if (unresolved.length) throw new Error(`Anchor resolution failed closed: ${unresolved.map(value => value.label).join(", ")}`);
  const config = await loadConfig(configPath);
  config.area.anchors = values.map(({ resolvedPoint, driftMeters, ...anchor }) => ({ ...anchor, point: resolvedPoint }));
  resolveArea(config.area);
  await writeJsonAtomic(resolve(configPath), config);
}
async function main() { const args = parseArgs(process.argv.slice(2)); args.config ??= await ensureUserConfig({ templateConfigPath: defaultConfigPath, templateBrowserConfigPath: defaultBrowserConfigPath, templateSchemaPath: defaultSchemaPath }); const values = await verifyAnchors(args.config); process.stdout.write(`${stableJson(values)}\n`); if (args.write) { if (!args.confirm) throw new Error("--write requires --confirm"); await writeResolvedAnchors(args.config, values); } }
function parseArgs(argv) { const out = {}; for (let i=0;i<argv.length;i++){const arg=argv[i];if(arg==="--config")out.config=resolve(argv[++i]);else if(arg==="--write")out.write=true;else if(arg==="--confirm")out.confirm=true;else throw new Error(`Unknown argument: ${arg}`);} return out; }
if (isMainModule(import.meta.url)) main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode=2; });
