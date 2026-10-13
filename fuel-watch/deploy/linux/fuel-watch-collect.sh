#!/bin/sh
# One background collection for the systemd timer. The collector itself appends the tick to the history and
# refreshes ~/.fuel-watch/state/latest.json; this wrapper only keeps its large JSON out of the journal and leaves
# a one-line summary there instead. The exit code is the collector's, so a failed run shows up as a failed unit.
set -u
ROOT="${FUEL_WATCH_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
out="$(mktemp "${TMPDIR:-/tmp}/fuel-watch-collect.XXXXXX")"
trap 'rm -f "$out"' EXIT
# systemd stops the whole unit with SIGTERM: the collector catches it and closes its browsers first; the shell
# runs these traps only after the collector has exited.
trap 'exit 143' TERM
trap 'exit 130' INT
node "$ROOT/dist/scripts/collect.mjs" >"$out"
code=$?
node -e '
const [file, code] = process.argv.slice(1);
let text = "";
try { text = require("node:fs").readFileSync(file, "utf8"); } catch {}
let parsed;
try { parsed = JSON.parse(text); } catch { console.log(`fuel-watch: exit=${code}, no snapshot (see the error above)`); process.exit(0); }
const snapshot = parsed.snapshot ?? {};
const verdicts = {};
for (const value of snapshot.assessments ?? []) verdicts[value.verdict] = (verdicts[value.verdict] ?? 0) + 1;
const sources = (snapshot.sourceHealth ?? []).map(value => `${value.source}:${value.status}`).join(",");
const warnings = [...new Set((snapshot.warnings ?? []).map(value => value.code))].join(",");
console.log(`fuel-watch: exit=${code} at=${snapshot.fetchedAt} stations=${(snapshot.assessments ?? []).length} verdicts=${JSON.stringify(verdicts)} sources=${sources}${warnings ? ` warnings=${warnings}` : ""}`);
' "$out" "$code" || true
exit "$code"
