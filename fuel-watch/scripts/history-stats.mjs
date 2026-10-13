#!/usr/bin/env node
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { defaultConfigPath, loadConfig } from "./lib/config.mjs";
import { computeHistoryStats, renderHistoryStats } from "./lib/history-stats.mjs";
import { historyPath, userConfigPath } from "./lib/paths.mjs";
import { isMainModule, stableJson } from "./lib/util.mjs";

export { computeHistoryStats, renderHistoryStats };

// Read-only: it never creates the user config or touches the history beyond reading it, so it is safe to run while
// the background collector is writing (a tick being appended is at worst skipped as an incomplete line).
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config ?? await access(userConfigPath()).then(() => userConfigPath(), () => defaultConfigPath);
  const config = await loadConfig(configPath);
  const stats = await computeHistoryStats(args.history ?? historyPath(), { intervalMinutes: config.monitoring.intervalMinutes, arrivalClusterMinutes: Math.max(config.activity.resumeWindowMinutes, config.activity.quietGapMinutes * 2), days: args.days, station: args.station });
  process.stdout.write(args.json ? `${stableJson(stats)}\n` : `${renderHistoryStats(stats, { limit: args.limit })}\n`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--config", "--history"].includes(arg)) out[arg.slice(2)] = resolve(requireValue(argv, ++i, arg));
    else if (arg === "--station") out.station = requireValue(argv, ++i, arg);
    else if (["--days", "--limit"].includes(arg)) { const value = Number(requireValue(argv, ++i, arg)); if (!Number.isInteger(value) || value < 1) throw new Error(`${arg} must be a positive integer`); out[arg.slice(2)] = value; }
    else if (arg === "--json") out.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}
function requireValue(argv, index, arg) { if (index >= argv.length) throw new Error(`${arg} requires a value`); return argv[index]; }

if (isMainModule(import.meta.url)) main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 2; });
