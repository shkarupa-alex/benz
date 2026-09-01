import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname);
const outdir = resolve(root, "dist", "scripts");
const adapterNames = ["common.mjs", "yandex.mjs", "gdebenz.mjs", "twogis.mjs", "benzonavt.mjs"];
const adapterSource = (await Promise.all(adapterNames.map(name => readFile(resolve(root, "scripts", "lib", "sources", name), "utf8")))).join("\n---adapter---\n");
const adapterContractHash = createHash("sha256").update(adapterSource).digest("hex");

await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await mkdir(resolve(root, "dist", "config"), { recursive: true });
for (const name of ["config.json", "config.schema.json", "agent-browser.json"]) await copyFile(resolve(root, "config", name), resolve(root, "dist", "config", name));
const result = await build({
  absWorkingDir: root,
  entryPoints: ["scripts/collect.mjs", "scripts/report.mjs", "scripts/monitor.mjs", "scripts/resolve-area.mjs"],
  outdir,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  entryNames: "[name]",
  banner: { js: "import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);" },
  sourcemap: false,
  metafile: true,
  define: { __FUEL_WATCH_ADAPTER_CONTRACT_HASH__: JSON.stringify(adapterContractHash) },
  logLevel: "info"
});
const files = {};
for (const output of Object.keys(result.metafile.outputs).sort()) files[output.replace(`${root}/`, "")] = (await stat(resolve(root, output))).size;
await writeFile(resolve(root, "dist", "manifest.json"), `${JSON.stringify({ schemaVersion: 1, adapterContractHash, files }, null, 2)}\n`);
