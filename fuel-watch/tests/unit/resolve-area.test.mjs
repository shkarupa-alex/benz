import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, defaultConfigPath } from "../../scripts/lib/config.mjs";
import { writeResolvedAnchors } from "../../scripts/resolve-area.mjs";

test("area write fails closed when any anchor is unresolved", async () => {
  const config = await loadConfig();
  const values = config.area.anchors.map((anchor, index) => ({ ...anchor, resolvedPoint: index ? anchor.point : null }));
  await assert.rejects(writeResolvedAnchors(defaultConfigPath, values), /failed closed/);
});

test("area write revalidates uniqueness and collinearity before writing", async () => {
  const config = await loadConfig();
  const values = config.area.anchors.map(anchor => ({ ...anchor, resolvedPoint: [44.5, 48.7] }));
  await assert.rejects(writeResolvedAnchors(defaultConfigPath, values), /unique anchors/);
});
