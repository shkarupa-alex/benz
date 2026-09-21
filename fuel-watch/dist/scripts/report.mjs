#!/usr/bin/env node
import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  prepareMonitoringSnapshot,
  renderReport
} from "./chunks/chunk-RDSBUZQS.mjs";
import "./chunks/chunk-WCGSC67K.mjs";
import {
  isMainModule,
  loadConfig,
  readJson,
  stableJson
} from "./chunks/chunk-GQHB3NSD.mjs";
import "./chunks/chunk-XKTP5TT3.mjs";

// scripts/report.mjs
import { resolve } from "node:path";
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
  process.stdout.write(args.json ? `${stableJson(result)}
` : `${result.markdown}
`);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--snapshot", "--state-dir"].includes(arg)) out[arg.slice(2)] = resolve(argv[++i]);
    else if (["--json", "--recovered", "--compact"].includes(arg)) out[arg.slice(2)] = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}
async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}
if (isMainModule(import.meta.url)) main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}
`);
  process.exitCode = 2;
});
export {
  renderReport
};
