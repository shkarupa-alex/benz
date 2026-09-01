import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);

// scripts/lib/paths.mjs
import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
function fuelWatchHome(env = process.env) {
  return resolve(env.FUEL_WATCH_HOME || join(homedir(), ".fuel-watch"));
}
var userConfigPath = (env = process.env) => join(fuelWatchHome(env), "config", "config.json");
var userBrowserConfigPath = (env = process.env) => join(fuelWatchHome(env), "config", "agent-browser.json");
var userSchemaPath = (env = process.env) => join(fuelWatchHome(env), "config", "config.schema.json");
var historyPath = (env = process.env) => resolve(env.FUEL_WATCH_HISTORY_PATH || join(fuelWatchHome(env), "history", "history.json"));
var latestSnapshotPath = (env = process.env) => join(fuelWatchHome(env), "state", "latest.json");
var monitorRoot = (env = process.env) => join(fuelWatchHome(env), "monitors");
async function ensureUserConfig({ templateConfigPath, templateBrowserConfigPath, templateSchemaPath, env = process.env } = {}) {
  if (!templateConfigPath || !templateBrowserConfigPath || !templateSchemaPath) throw new Error("Fuel Watch config templates are required");
  const target = userConfigPath(env);
  await mkdir(dirname(target), { recursive: true, mode: 448 });
  await copyOnce(templateConfigPath, target);
  await copyOnce(templateBrowserConfigPath, userBrowserConfigPath(env));
  await copyFile(templateSchemaPath, userSchemaPath(env));
  return target;
}
async function copyOnce(source, target) {
  try {
    await copyFile(source, target, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

export {
  historyPath,
  latestSnapshotPath,
  monitorRoot,
  ensureUserConfig
};
