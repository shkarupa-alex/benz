import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const sha256 = value => createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
export const stableJson = value => JSON.stringify(sortObject(value));
export const uniqueId = prefix => `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortObject(value[key])]));
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, path);
}

export const ageMinutes = (time, now = new Date()) => (now.getTime() - new Date(time).getTime()) / 60000;
export const clampText = (text, length = 500) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, length);
