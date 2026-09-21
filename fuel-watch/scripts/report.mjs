#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig } from "./lib/config.mjs";
import { prepareMonitoringSnapshot } from "./lib/prepare.mjs";
import { renderReport } from "./lib/render-report.mjs";
import { isMainModule, readJson, stableJson } from "./lib/util.mjs";

export { renderReport };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let snapshot = args.snapshot ? await readJson(args.snapshot) : JSON.parse(await readStdin());
  let state;
  if (args["state-dir"]) state = await readJson(resolve(args["state-dir"], "state.json"));
  if (state) {
    const config = await loadConfig(state.configPath);
    snapshot = prepareMonitoringSnapshot(state, snapshot, config).snapshot;
  }
  const result = renderReport(snapshot, { monitorId: state?.monitorId, generation: state?.generation, recovered: args.recovered, compact: args.compact });
  process.stdout.write(args.json ? `${stableJson(result)}\n` : `${result.markdown}\n`);
}
function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i++) { const arg = argv[i]; if (["--snapshot", "--state-dir"].includes(arg)) out[arg.slice(2)] = resolve(argv[++i]); else if (["--json", "--recovered", "--compact"].includes(arg)) out[arg.slice(2)] = true; else throw new Error(`Unknown argument: ${arg}`); } return out; }
async function readStdin() { let data = ""; for await (const chunk of process.stdin) data += chunk; return data; }
if (isMainModule(import.meta.url)) main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 2; });
