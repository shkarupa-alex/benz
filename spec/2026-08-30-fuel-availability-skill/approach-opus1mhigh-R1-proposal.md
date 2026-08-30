## Constraints and considerations first

The council's split verdict points at a real defect, and I want to name it before revising rather than defend around it. One reviewer independently reproduced essentially every empirical claim in the proposal (with a wider bbox they saw 208 gdebenz stations to my 113 — the endpoint returns whatever the box covers, which confirms the mechanism and corrects my figure) and endorsed the structural decisions: source-role inversion, never-throwing adapters, `EMPTY_RESULT` vs `PARSE_SHAPE_CHANGED`, GET/HEAD-only allowlist, agent-driven blocking loop. The other found the research valuable but would not adopt the *system*. Re-reading my own §3.4–3.5 with that lens, the objection is obvious and correct: I specified a 15-constant pseudo-Bayesian model that emits `уверенность 0.86` for a domain with **no ground truth, no labels, and no way to falsify any of those constants**. That is false precision dressed as rigour, and it is a particularly bad failure *here*, because the task's central requirement is a "meaningful confidence assessment" — and a number nobody can validate is less meaningful than a word somebody can check. The same over-build shows up in four config files, a geohash blocking index, a matching algorithm I described as "Gale-Shapley-lite", and ten library modules for a personal skill whose job is answering "где сейчас 95-й".

So this revision keeps every empirically grounded and structurally load-bearing decision, and **deletes the invented mathematics**. The verdict model becomes an enumerable decision table over ~5 tunables; ranking becomes a deterministic lexicographic tuple with no weights at all; config collapses to one file; identity matching drops to sort-by-distance greedy mutual-best (identical guarantees, a third of the code). I also fix a genuine robustness hole nobody flagged but which would have bitten on first run: a single tool call that blocks for 15 minutes is a plausible harness timeout, so `wait` is now chunked. And a correction to my own identity claim from re-reading the live payload: gdebenz ids are **heterogeneous** — `1629297296` (OSM node), `w152079274` (OSM way), `usr_jcVTKs0_0cI` (user-submitted, app-local, not an OSM entity at all). "OSM ids are stable" is true only for the first two classes.

**Empirical basis (verified by HTTP this session, and independently reproduced by a reviewer):**

| Source | Verified 2026-08-30 | Consequence |
|---|---|---|
| Yandex Maps | Plain `curl` + UA → **200, 676 KB**. `<script type="application/json" class="state-view">` holds `"totalResultCount":51,"requestResults":25,"items":[…]`; **all 25** businesses carry `fuelAvailability` with per-grade `status`, `lastSignalTimestamp`, `signalsCountPerHour`, `queueStatus`, `localizedQueueSize`. `page=1..3` → 25+24+13 = 62 unique; `totalResultCount` jitters 53/49/63 for the same query. | **No browser.** Paginate to a short page; never trust the total. |
| gdebenz.ru | **200** (502 earlier — intermittent). Undocumented JSON API: `GET /api/stations?lat1&lon1&lat2&lon2` → `osm_id, lat, lon, brand, addr, status ∈ yes\|no\|queue\|null, fuels_now, prices_now, dt_only, conflict` (113 for my box, 208 for the reviewer's wider box); `GET /api/comments?<same bbox>` → `{osm_id, status, fmask, fresh_band, conflict}`; `GET /api/cfg` → feature flags. | Not a degraded scrape target — a clean bbox JSON API with ~2–3× Yandex's coverage. Becomes the registry spine. |
| 2GIS | `curl` → **403**; CAPTCHA on fresh browser sessions. | Hostile *and* it publishes no live availability feed. Demoted, not dropped. |

Two decoded facts that drive design:

- **`fmask` is a bitmask over `["92","95","98","100","ДТ"]`** (bits 0–4), recovered from the minified bundle's `Ye=["92","95","98","100","ДТ"]` and cross-validated against `fuels_now`: `27`→`92,95,100,ДТ`; `19`→`92,95,ДТ`; `16`→`ДТ`. Reviewer's independent distribution agrees.
- **gdebenz has no premium-95 concept** (vocabulary stops at 92/95/98/100/ДТ) while Yandex separates `AI95` from `AI95_PREMIUM` — and the first station I sampled read `95: OUT_OF_STOCK, 95+: IN_STOCK`. gdebenz "95 есть" is therefore *not* evidence that 95+ exists, and treating it as such would send the user to a station that cannot serve them.

---

## 1. Approach summary

Build a dependency-free Node skill at `~/.codex/skills/fuel-watch/` in which three never-throwing source adapters produce uniform per-station-per-grade observations, joined on gdebenz's OSM registry, filtered by a configurable bbox/polygon/anchor-hull, and turned into a verdict by a **small enumerable decision table** — not a fitted score — so that every line reads `verdict · confidence word · signal age · which sources agreed`. Ranking is a deterministic lexicographic tuple (verdict → confidence → queue → freshness → distance), which satisfies "rank by probability of availability, then by smallest queue" without a single tunable weight. On-demand mode is one `collect && report`; monitoring is an agent-driven loop where a **chunked** blocking wait returns control at least every 4 minutes so no single tool call can time out, and the agent itself publishes each 15-minute summary into the current Codex task.

---

## 2. Architecture and component breakdown

```
~/.codex/skills/fuel-watch/
├── SKILL.md                    # triggers, on-demand + monitor workflows, Limits
├── config.json                 # ONE config: area, fuel, sources, scoring, monitor
├── config.schema.json          # validated on every load; failure = exit 1, never a guess
├── config.local.json           # optional, git-ignored, deep-merged over config.json
├── scripts/
│   ├── collect.mjs             # sources → snapshot
│   ├── report.mjs              # snapshot (+prev) → md | table | json
│   ├── watch.mjs               # monitor state machine (start|wait|status|stop)
│   ├── resolve-anchors.mjs     # station names → coords → anchors block
│   └── lib/
│       ├── config.mjs  geo.mjs  http.mjs  fuel.mjs
│       ├── identity.mjs  verdict.mjs  render.mjs  store.mjs
│       └── sources/{gdebenz,yandex,twogis}.mjs
├── test/{fixtures/, *.test.mjs}
└── state/                      # snapshots, identity-map, watch state, debug bodies
```

Eight library modules, four CLIs, one config file. Estimated **~1 100 lines V1** excluding tests and fixtures.

- **`sources/*.mjs`** — network + parse only. Export `id`, `role` (`'availability' | 'registry'`), `collect(ctx)`. **Contractually cannot throw or reject.** No scoring, no geometry, no merging.
- **`http.mjs`** — `fetch` with per-request `AbortSignal.timeout`, bounded retry + backoff + jitter, per-host min-interval, UA/`Accept-Language`, and a **method allowlist that rejects anything but GET/HEAD** (structural guarantee we never write to a source). Circuit breaker: any `BLOCKED_CAPTCHA` or 3 consecutive 4xx disables that source for the session.
- **`fuel.mjs`** — canonical grades, alias resolution (case / ё→е / translit), per-source grade maps incl. the gdebenz bit table and the `premiumSupported: false` flag.
- **`geo.mjs`** — pure: `haversineM`, `pointInPolygon`, `convexHull` (monotone chain), `distanceToPolygonBoundary`, `bboxOf`, `padBboxMeters`. ~120 lines, no deps.
- **`identity.mjs`** — cross-source matching + persisted, hand-editable identity map.
- **`verdict.mjs`** — pure `(observations, now, cfg) → { verdict, confidence, age, evidence[] }` plus queue normalization and the ranking comparator. Injected clock; no ambient `Date.now()`.
- **`render.mjs`** — snapshot (+ previous) → Russian markdown / compact table / JSON.
- **`store.mjs`** — snapshot write/read/prune, `state/last.json`, identity map, watch state.
- **`collect.mjs`** — orchestrator: load+validate config → fetch bbox → adapters via `Promise.allSettled` under per-source timeout → geometry filter → merge → verdict → snapshot.
- **`watch.mjs`** — monitor state machine. Spawns nothing, ever.

**Flow:** `config → padded fetch bbox → [adapters ∥] → observations → geometry filter → identity merge → verdict table → lexicographic rank → snapshot → render (+diff)`.

---

## 3. Key interfaces and data models

### 3.1 Adapter contract

```js
export const id   = 'gdebenz';                 // 'gdebenz' | 'yandex' | 'twogis'
export const role = 'availability';            // 'availability' | 'registry'
/** @param {CollectContext} ctx @returns {Promise<SourceResult>}  MUST NOT throw/reject. */
export async function collect(ctx) {}
```

```ts
type CollectContext = {
  area: AreaConfig; bbox: BBox; center: {lat:number; lon:number};
  fuel: FuelConfig; source: SourceConfig;
  http: HttpClient;              // injected — tests supply a fixture client
  now: () => Date;               // injected — tests supply a fixed clock
  browser: BrowserRunner | null; // null unless agent-browser available AND allowed
  log: (level: 'debug'|'warn'|'error', msg: string, meta?: object) => void;
};

type SourceResult = {
  sourceId: string;
  status: 'ok' | 'partial' | 'failed';
  observations: StationObservation[];
  fetchedAt: string;                       // ISO-8601 UTC
  diagnostics: {
    pagesFetched?: number; itemsSeen?: number; itemsParsed?: number;
    warnings: string[];
    errorCode?: SourceErrorCode;
    errorMessage?: string;                 // ≤300 chars, never a full body
    debugBodyPath?: string;                // only on PARSE_SHAPE_CHANGED
  };
};

type SourceErrorCode =
  | 'NETWORK_TIMEOUT' | 'HTTP_ERROR' | 'BLOCKED_CAPTCHA' | 'PARSE_SHAPE_CHANGED'
  | 'EMPTY_RESULT' | 'DISABLED' | 'BROWSER_UNAVAILABLE' | 'CIRCUIT_OPEN';
```

**The error taxonomy is the point.** `EMPTY_RESULT` (genuinely nothing in the box) and `PARSE_SHAPE_CHANGED` (HTTP 200, body > 100 KB, zero parsed businesses — i.e. upstream refactored) must never collapse into "no data". The latter dumps the body to `state/debug/` (rotating: 3 files, 2 MB cap) so the parser is fixed in one iteration rather than a re-investigation. `partial` keeps whatever pages succeeded.

### 3.2 Data model

```ts
type GradeStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNCERTAIN' | 'UNKNOWN';

type StationObservation = {
  sourceId: string;
  sourceStationId: string;
  stationIdKind?: 'osm-node' | 'osm-way' | 'user-submitted' | 'vendor';
  name: string; brand: string|null; address: string|null;
  lat: number; lon: number;
  grades: Record<CanonicalGrade, {
    status: GradeStatus;
    raw: string;                 // verbatim source token — auditability
    directness: 'direct' | 'inferred';   // 'inferred' = derived, e.g. gdebenz 95 → 95+
    price?: number; priceObservedAt?: string;
  }>;
  queue: { level: 0|1|2|3|null; label: string|null; precision: 'exact'|'coarse' } | null;
  observedAt: string | null;
  observedAtPrecision: 'exact' | 'band' | 'unknown';
  signalsPerHour?: number;       // Yandex
  conflict?: boolean;            // gdebenz self-reported disagreement
  extra?: { cashOnly?: boolean; fuelLimit?: string; dtOnly?: boolean };
};

type Station = {
  stationKey: string;            // 'osm:1629297296' | 'gb:usr_xxx' | 'ym:91428629908'
  name: string; brand: string|null; address: string|null;
  lat: number; lon: number; distanceFromCenterM: number;
  sourceIds: string[];
  identity: { matchedBy: 'osm'|'geo+brand'|'single-source'; matchDistanceM?: number };
  grades: Record<CanonicalGrade, GradeAssessment>;
  queue: { level: 0|1|2|3|null; label: string|null; source: string|null;
           observedAt: string|null; precision: 'exact'|'coarse'|null };
};

type GradeAssessment = {
  verdict: 'ЕСТЬ' | 'СКОРЕЕ_ЕСТЬ' | 'ПРОТИВОРЕЧИВО' | 'КОСВЕННО' | 'НЕТ' | 'НЕТ_ДАННЫХ';
  confidence: 'высокая' | 'средняя' | 'низкая' | 'нет';
  reason: string;                // e.g. "2 источника согласны, сигнал 6 мин назад"
  ageMinutes: number | null;
  ageIsApproximate: boolean;     // true when derived from gdebenz fresh_band
  evidence: Array<{ source: string; status: GradeStatus; ageMinutes: number|null;
                    ageIsApproximate: boolean; directness: 'direct'|'inferred';
                    stale: boolean }>;
};
```

There is **no `probability: 0.86` field anywhere.** `verdict` + `confidence` + `reason` + `evidence[]` is strictly more information than a float, and unlike the float, every part of it is checkable by the user against the sources.

### 3.3 The verdict decision table

Per (station, grade), let `E` be all observations for that grade. Classify each by age against three thresholds — `freshMinutes` (45), `recentMinutes` (180), `staleMinutes` (360) — where gdebenz band observations use the `fresh_band` → minutes table and set `ageIsApproximate`. Observations older than `staleMinutes` get `stale: true` and are excluded from the rules below but **still rendered in `evidence[]`**, because "we looked and it was 9 hours old" is the explanation for `НЕТ_ДАННЫХ`.

Rules, first match wins:

| # | Condition | Verdict |
|---|---|---|
| 1 | No non-stale evidence | `НЕТ_ДАННЫХ` |
| 2 | A non-stale `OUT_OF_STOCK` that is **newer than every** non-stale `IN_STOCK` | `НЕТ` |
| 3 | Non-stale `IN_STOCK` **and** `OUT_OF_STOCK` from different sources, neither clearly newer (within `conflictWindowMinutes`, 30) | `ПРОТИВОРЕЧИВО` |
| 4 | A **direct** `IN_STOCK` within `freshMinutes` | `ЕСТЬ` |
| 5 | A **direct** `IN_STOCK` within `recentMinutes` | `СКОРЕЕ_ЕСТЬ` |
| 6 | Only `inferred` or `UNCERTAIN` non-stale evidence | `КОСВЕННО` |
| 7 | otherwise | `НЕТ_ДАННЫХ` |

Confidence, a second enumerable table over three inputs — (age band, number of *independent sources* agreeing with the verdict, directness):

| agreeing sources | direct & ≤fresh | direct & ≤recent | inferred / UNCERTAIN |
|---|---|---|---|
| ≥2 | высокая | средняя | низкая |
| 1, with `signalsPerHour ≥ 2` | высокая | средняя | низкая |
| 1 | средняя | низкая | низкая |
| 0 (stale only) | нет | нет | нет |

Then two hard overrides: `ПРОТИВОРЕЧИВО` caps confidence at `низкая`; gdebenz `conflict: true` demotes confidence one step. **`КОСВЕННО` can never be `высокая`** — this is the structural guarantee that gdebenz's grade-blind "95 есть" cannot be presented as "95+ точно есть".

Every branch is reachable and finite, so `verdict.test.mjs` enumerates the **entire** table rather than sampling a continuous space. Total tunables: `freshMinutes`, `recentMinutes`, `staleMinutes`, `conflictWindowMinutes`, `highConfidenceSignalRate`, plus the `fresh_band` minute mapping. Six numbers, each with a plain-language meaning a user can argue with.

### 3.4 Ranking — lexicographic, zero weights

```js
// verdict.mjs — total order, no tunable weights, fully deterministic
const VERDICT_RANK    = { ЕСТЬ:0, СКОРЕЕ_ЕСТЬ:1, КОСВЕННО:2, ПРОТИВОРЕЧИВО:3,
                          НЕТ_ДАННЫХ:4, НЕТ:5 };
const CONFIDENCE_RANK = { высокая:0, средняя:1, низкая:2, нет:3 };

compareStations(a, b, grade) =>
     VERDICT_RANK[a.verdict]        - VERDICT_RANK[b.verdict]
  || CONFIDENCE_RANK[a.confidence]  - CONFIDENCE_RANK[b.confidence]
  || (a.queue.level ?? 1.5)         - (b.queue.level ?? 1.5)   // unknown queue sits mid
  || (a.ageMinutes ?? 1e9)          - (b.ageMinutes ?? 1e9)
  || a.distanceFromCenterM          - b.distanceFromCenterM
  || a.stationKey.localeCompare(b.stationKey);                 // final tie-break
```

This is a direct transcription of the requirement — "rank by the probability that suitable fuel is actually available and, where data exists, by the smallest queue" — into a comparator, with no invented arithmetic between incommensurable quantities. Unknown queue sorts at 1.5 so it is neither rewarded nor punished against known LOW(1)/MEDIUM(2). The `stationKey` final tie-break makes consecutive 15-minute reports byte-stable when nothing changed, which is what prevents fabricated "changes" in the diff.

### 3.5 Configuration (one file)

```jsonc
{
  "area": {
    "mode": "bbox",                                  // "bbox" | "polygon" | "anchors"
    "bbox": { "south": 48.4696, "west": 44.2266, "north": 48.9435, "east": 44.8073 },
    "polygon": null,                                 // [[lon,lat], …] when mode:"polygon"
    "anchors": [],                                   // [{label,lat,lon,resolvedFrom,resolvedAt}]
    "anchorBufferMeters": 700,
    "fetchPadMeters": 2000,
    "displayTimeZone": "Europe/Volgograd"
  },
  "fuel": {
    "canonical": ["AI92","AI95","AI95_PREMIUM","AI98","AI100","DT","GAS"],
    "defaultWatch": ["AI95","AI95_PREMIUM"],
    "aliases": {
      "AI95": ["95","аи-95","аи95","ai95","95-й"],
      "AI95_PREMIUM": ["95+","95 премиум","экто 95","ekto","g-drive 95","джи-драйв",
                       "pulsar 95","пульсар","ultimate 95","ai95_premium"],
      "DT": ["дт","дизель","diesel","солярка"]
    },
    "sourceMaps": {
      "yandex":  { "AI92":"AI92","AI95":"AI95","AI95_PREMIUM":"AI95_PREMIUM",
                   "AI98":"AI98","AI100":"AI100","DT":"DIESEL" },
      "gdebenz": { "bitIndex": {"AI92":0,"AI95":1,"AI98":2,"AI100":3,"DT":4},
                   "csvNames": {"92":"AI92","95":"AI95","98":"AI98","100":"AI100","ДТ":"DT"},
                   "premiumSupported": false }
    },
    "brandAliases": { "Лукойл":["lukoil"], "Газпром":["газпромнефть","газпром нефть","gazprom"],
                      "Роснефть":["rosneft"], "Teboil":["тебойл"], "ТНК":["tnk"] }
  },
  "sources": {
    "gdebenz": { "enabled": true, "role": "availability", "base": "https://gdebenz.ru",
                 "timeoutMs": 15000, "retries": 2, "referer": "https://gdebenz.ru/" },
    "yandex":  { "enabled": true, "role": "availability",
                 "base": "https://yandex.ru/maps/38/volgograd/search/", "query": "АЗС",
                 "maxPages": 6, "pageSize": 25, "timeoutMs": 25000, "retries": 2,
                 "minIntervalMs": 1500, "browserFallback": "auto" },
    "twogis":  { "enabled": false, "role": "registry", "mode": "browser",
                 "note": "403/CAPTCHA unattended; publishes no live availability",
                 "timeoutMs": 60000 }
  },
  "scoring": {
    "freshMinutes": 45, "recentMinutes": 180, "staleMinutes": 360,
    "conflictWindowMinutes": 30, "highConfidenceSignalRate": 2,
    "gdebenzBandMinutes": { "3": 45, "2": 180, "1": 480 },   // ASSUMPTION — §6
    "inferCrossGrade": true
  },
  "monitor": { "intervalMinutes": 15, "jitterSeconds": 90, "maxHours": 12, "maxRuns": 48,
               "abortAfterConsecutiveTotalFailures": 4, "maxBlockSeconds": 240, "topN": 5 }
}
```

`config.schema.json` is validated on every load by a ~60-line hand-rolled checker (types, enums, ranges, `mode`↔field consistency). A config error is **exit 1 with the offending JSON path** — never a silent default, because a silently-wrong area produces confidently-wrong answers.

The default bbox is Volgograd's own region bounds, lifted from the Yandex payload (`"bounds":[[44.22663,48.4696…],[44.807328,48.9434…]]`) — a defensible superset, not a guess. Anchor mode needs no polygon-offset library: `inArea(p) = pointInPolygon(hull, p) || distanceToPolygonBoundary(hull, p) ≤ anchorBufferMeters`, which is precisely "these named stations are the outermost acceptable ones", inclusive of the anchors themselves.

### 3.6 CLI contracts

```
node scripts/collect.mjs [--grades AI95,AI95_PREMIUM] [--sources gdebenz,yandex]
                         [--browser auto|never|always] [--out <path>]
  0  snapshot written, ≥1 observation      3  written, all sources failed (diagnostics)
  1  config/usage error (invalid area, unknown grade, schema violation)

node scripts/report.mjs [--snapshot state/last.json] [--format md|table|json]
                        [--grades …] [--top 5] [--diff <prev.json>] [--all]
  0  rendered                              1  snapshot unreadable/invalid

node scripts/watch.mjs start --interval 15 --grades AI95,AI95_PREMIUM [--max-hours 12]
node scripts/watch.mjs wait      # blocks at most monitor.maxBlockSeconds (240)
  0  cycle due    20  not due yet — call again    10  stopped
  11 budget exhausted (maxHours/maxRuns)          12  aborted: N total-failure cycles
node scripts/watch.mjs status    # JSON
node scripts/watch.mjs stop

node scripts/resolve-anchors.mjs --names "Лукойл Землячки" "Газпром Историческая" [--write]
  # ranked candidates from the live gdebenz registry + paste-ready anchors block.
  # Writes nothing without --write.
```

`resolve-anchors.mjs` needs no geocoding service: the gdebenz registry (`name`, `brand`, `addr`, `lat`, `lon` for every station in the box) **is** the local gazetteer. It stays read-only by default because turning a fuzzy name match into the boundary of the search area is exactly the guess that deserves a human glance.

### 3.7 Identity matching (simplified, same guarantees)

**Stage 1 — deterministic.** `osm_id` (gdebenz) and `oid` (Yandex) are authoritative *within* a source; never fuzzy-merge inside one source. `stationKey` prefers `osm:<numeric>` / `osm:w<id>`; **`usr_*` ids get `gb:usr_*` and `stationIdKind:'user-submitted'`** — these are app-local, may vanish or be renumbered between polls, and are therefore excluded from the persisted identity map (they are matched fresh each run and never promoted to a stable key).

**Stage 2 — cross-source.** For each gdebenz station, take Yandex candidates within 250 m (a plain O(n·m) scan over ≤300 stations — no geohash index needed at this scale, ~2 ms), sort candidate pairs by distance ascending, and accept greedily under a one-to-one constraint when **all three** hold:

1. `haversineM ≤ 150`
2. brands are **not in conflict** — a normalized brand mismatch (after alias/translit/ё folding) within 150 m is a **hard reject**, never a low score
3. either brands match, or normalized street-token Jaccard ≥ 0.5

Everything else stays unmerged and is rendered as two rows. This is deliberate: a duplicate row is cosmetic, whereas merging a Лукойл that has 95+ with the Газпром across the road that does not is a **wrong answer of exactly the kind the user would act on**. Accepted merges persist to `state/identity-map.json` (hand-editable), re-verified if either coordinate drifts > 60 m.

### 3.8 Adapter specifics

**gdebenz** (`role: availability`, the registry spine)
- `GET /api/stations?lat1&lon1&lat2&lon2` and `GET /api/comments?<same box>`; join on `osm_id`.
- Guard: the endpoint has no documented pagination, so if a response returns suspiciously round counts or an unexpectedly large body, split the bbox into quadrants and re-query — never assume completeness from a single call.
- Status semantics: `no` → `OUT_OF_STOCK` for watched grades. `yes`/`queue` with `fmask > 0` → `IN_STOCK` for masked grades, `OUT_OF_STOCK` for unmasked ones. **`yes` with `fmask == 0` → `UNCERTAIN` for all watched grades**, not `IN_STOCK` — a bare "есть" with no fuel list (95 of 113 rows in my sample) says nothing about a specific grade.
- Premium: `premiumSupported: false` means every gdebenz `AI95` observation additionally yields an `AI95_PREMIUM` observation with `directness: 'inferred'` (when `inferCrossGrade`), which by construction can only ever produce `КОСВЕННО` / `низкая`.
- Freshness: `fresh_band` only (bbox mode carries no absolute timestamp) → band→minutes table, `observedAtPrecision: 'band'`, `ageIsApproximate: true`, rendered as `≈45 мин`.
- **`fmask` self-check:** on every run, decode `fmask` and compare against the same row's `fuels_now` CSV. On any mismatch, emit a warning and **drop gdebenz to grade-blind registry role for that run** (keeps stations, discards grade claims). This makes a silent upstream bit-order rotation self-detecting instead of silently poisoning verdicts.

**Yandex** (`role: availability`, the grade/queue authority)
- `GET <base>?text=АЗС&ll=<lon,lat>&spn=<dlon,dlat>&z=12&page=N`.
- Extract the last `<script type="application/json" class="state-view">`, entity-decode, `JSON.parse`.
- **Recursively walk the whole object** collecting nodes with `type === 'business' && Array.isArray(coordinates)`. Do **not** index `state.stack[0].results.items` — the wrapper path is the most likely thing to be renamed, the leaf node shape the least.
- Pull `title`, `address`, `coordinates:[lon,lat]`, `oid` via `/oid=(\d+)/` on `uri`, and `fuelAvailability.{fuel[],lastSignalTimestamp,signalsCountPerHour,queueStatus,localizedQueueSize,localizedFuelLimit,cashOnly}`. An unrecognised `fuelType` is a warning, not a failure.
- Paginate to `maxPages` (6), stop on zero *new* oids or a short page, dedupe by oid. `totalResultCount` is a diagnostic only — observed 53/49/63 for one query.
- `lastSignalTimestamp` is unix **seconds**; reject future or >30-day-old values as `observedAtPrecision: 'unknown'`.

**2GIS** (`role: registry`, `enabled: false`). I am keeping the demotion and defending it. The task requested 2GIS as a source, and the adapter **is** implemented and wired — but 2GIS publishes no live fuel-availability feed, so the only thing CAPTCHA-fighting buys is name/address/brand data that the OSM registry already supplies. Building session/CAPTCHA machinery, against a site that actively blocks automation, to obtain data that cannot change a single verdict, is effort spent on ToS risk for zero user benefit. When enabled it contributes registry rows only (weight zero in every verdict rule), navigates via agent-browser, and returns `BLOCKED_CAPTCHA` immediately on a challenge with **no retry**. One config flag reverses this.

### 3.9 Queue normalization

| Signal | Normalized |
|---|---|
| Yandex `queueStatus` HIGH / MEDIUM / LOW | level 3 / 2 / 1, `precision: 'exact'`, label from `localizedQueueSize` |
| Unrecognised future `queueStatus` token | regex on the localized string (`нет очереди`→0, `неболь\|маленьк`→1, `средн`→2, `больш\|огромн`→3); still unknown → `null` + warning |
| gdebenz `status === 'queue'` | level 2, `precision: 'coarse'`, label «есть очередь» — **and** `IN_STOCK` evidence for the `fmask` grades |
| absent | `null` → sorts at 1.5 |

### 3.10 The two user-facing modes

**On-demand.** One shot, no state machine:
```
node scripts/collect.mjs --grades <grades> && node scripts/report.mjs --format md
```
The agent posts the rendering. Total wall time ≈ 3–8 s (one gdebenz pair + ≤6 Yandex pages). If the user names a grade no source reports (e.g. `GAS`), `collect` exits 1 with `unsupported grade: GAS (no configured source map)` rather than returning an empty, misleading "нигде нет".

**Monitoring**, driven by the agent inside the current Codex task:
```
1. watch.mjs start --interval 15 --grades <…>       # writes state, spawns NOTHING
2. collect.mjs ; report.mjs --format md --diff <prev>
3. agent posts the summary into the conversation
4. watch.mjs wait
     0  → goto 2
     20 → goto 4          # not due yet; ≤4 min elapsed, no tool-call timeout risk
     10 → post «мониторинг остановлен», done
     11 → post budget notice, done
     12 → post degraded notice (4 cycles with zero usable data), done
```

The **chunked wait** is the fix to a hole in my previous design: a single foreground command blocking 15 minutes is a plausible harness/tool timeout and would kill the loop mid-session. `wait` now blocks at most `maxBlockSeconds` (240), emits a heartbeat, checks the stop sentinel (`state/watch.stop`) every 5 s, and returns `20` if the cycle is not yet due. The agent simply calls it again — three or four cheap calls per interval, none long enough to trip anything.

This remains agent-driven rather than daemon-driven because the requirement is publication *into the current task*: a background process outlives the task and cannot post to the conversation. The honest cost is that the loop ends when the task ends; `state/watch.json` lets a new task resume mid-session.

Guards: `maxHours` 12, `maxRuns` 48, abort after 4 consecutive cycles where every source failed (loudly, not silently), user "stop" → `watch.mjs stop`. Each cycle jitters ±90 s.

### 3.11 Output format

```
⛽ АИ-95 / 95+ · 30.08.2026 15:40 (Волгоград)
Источники: ГдеБЕНЗ ✓113 · Яндекс ✓62 · 2ГИС — выключен (403/captcha, живых данных не даёт)

Изменения за 15 мин: +Лукойл, Землячки (95+ появился) · −Газпром, Историческая (95 кончился)

ЕСТЬ
1. Лукойл · ул. им. М. Фрунзе, 28 · 95+ ЕСТЬ (высокая), 95 НЕТ
   очередь небольшая · сигнал 6 мин назад · Яндекс и ГдеБЕНЗ согласны

СКОРЕЕ ЕСТЬ
2. Роснефть · ул. Землячки, 110 · 95+ (средняя) · очередь нет данных
   сигнал 52 мин назад · только Яндекс

ПРОТИВОРЕЧИВО
3. Газпром · пр. Ленина, 100 · 95 (низкая)
   Яндекс «есть» 12 мин назад · ГдеБЕНЗ «нет» ≈45 мин назад

КОСВЕННО (грейд не подтверждён)
4. Teboil · ул. Рокоссовского, 40 · 95+ (низкая)
   ГдеБЕНЗ сообщает «95 есть», премиум-95 отдельно не различает · ≈45 мин назад

НЕТ СВЕЖИХ ДАННЫХ (>6 ч): 14 АЗС в зоне  ·  НЕТ: 31 АЗС   (--all для полного списка)

Данные — отметки водителей, не телеметрия АЗС. Возраст сигнала указан у каждой строки.
```

Renderer invariants, enforced in code and asserted in tests: **no availability claim without an age and a confidence word**; approximate ages always carry `≈`; every failed or disabled source is named with its reason; the `КОСВЕННО` bucket always states *why* it is indirect; buckets capped at `topN` with counts for the rest; the disclaimer is unconditional. `--format json` emits the full snapshot including `evidence[]`.

### 3.12 Testing

Fixtures captured this session, checked in: the trimmed Yandex `state-view` JSON (pages 1–3), `gdebenz-stations.json`, `gdebenz-comments.json`. Parsers are pure functions over fixture text; `node --test`; **zero network in unit tests**.

- **Parsers:** happy path per source; renamed wrapper key still yields businesses (proves the recursive walk); renamed *leaf* key yields `PARSE_SHAPE_CHANGED`, not a crash; unknown `fuelType` → warning; pagination stops on short page and on repeated oids.
- **fmask:** decode 0/1/16/19/27; the self-check catches a deliberately rotated bit table and demotes gdebenz to registry.
- **Verdict table:** **exhaustive enumeration** of the decision table × confidence table (a few hundred cases — the whole point of discretizing) plus the two overrides.
- **Ranking:** comparator is a strict weak ordering; identical snapshots produce byte-identical reports (anti-churn); unknown queue sorts between LOW and MEDIUM.
- **Geometry:** in/out of bbox, polygon, hull+buffer; anchor inclusion at the hull vertex; ±180/±90 guards.
- **Identity:** true merge at 30 m same brand; **non-merge at 90 m with conflicting brands**; mutual-best one-to-one; `usr_*` never enters the persisted map.
- **Watch:** start→wait(20)→wait(0)→stop; budget exhaustion; consecutive-failure abort; stop sentinel honored within 5 s.
- **Render:** golden-file snapshots incl. the all-sources-failed report.
- **Live smoke** (`npm run smoke`, opt-in, never automatic): asserts ≥1 station with a parsed grade status per enabled source. Doubles as the shape-drift canary.

---

## 4. Key trade-offs

1. **Discrete verdict table over a weighted probability model.** The single biggest change, and it is a retreat I think is right. With no ground truth, a float is unfalsifiable decoration; six named thresholds and an enumerable table are auditable, exhaustively testable, arguable by the user, and — critically — *more* informative on the page, because `«ЕСТЬ, высокая: 2 источника согласны, 6 мин назад»` tells the reader what to check while `0.86` does not.
2. **Lexicographic ranking over a weighted sum.** Availability, queue, freshness and distance are incommensurable; any weighting between them is invented. The comparator transcribes the requirement literally and has zero tunables.
3. **gdebenz as registry spine, Yandex as availability authority** — the source-role inversion both reviewers found valuable. gdebenz gives JSON, OSM ids and 2–3× the coverage; Yandex gives per-grade granularity, queues and exact timestamps. Neither alone suffices; each alone still produces a useful report.
4. **Plain HTTP by default; browser only as an escape hatch.** Verified today for both live sources. A browser is slow, untestable against fixtures, and fragile in a 15-minute loop.
5. **2GIS implemented but off** — defended in §3.8. Reversible in one config flag.
6. **Conservative non-merge on ambiguous identity**, with brand conflict as a hard reject. Duplicates are cosmetic; false merges are actionable wrong answers.
7. **Chunked blocking wait over one long block or a daemon.** A daemon cannot publish into the current task; a 15-minute block risks a tool timeout. Four short blocks per interval is the only shape that satisfies both.
8. **One config file over four.** The four-file split bought namespacing nobody needed and made "where do I change the area?" a lookup. One schema-validated file with sections is better ergonomics for a personal skill.
9. **Zero npm dependencies, stdlib only.** No cheerio (one regex + `JSON.parse`), no turf (~120 lines of geometry), no HTTP client, no schema library. A skill that runs Node from `~/.codex` should be auditable in one sitting and immune to supply-chain drift.

---

## 5. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Yandex `state-view` shape change | High (unversioned internal) | Shape-agnostic recursive walk; `PARSE_SHAPE_CHANGED` canary (200 + big body + 0 businesses); debug body dump; fixtures pin current shape; gdebenz still answers |
| Yandex rate-limit / challenge | Medium | ≤6 pages/cycle, 1 cycle/15 min, min-interval + jitter, circuit breaker, `browserFallback:"auto"` one-shot escape |
| gdebenz downtime (502 observed) or API change | Medium | Endpoints + bit table in config; retries with backoff; optional — run continues on Yandex alone |
| **`fmask` bit order rotates silently** | Low, severe | Per-run cross-validation of `fmask` against `fuels_now`; on mismatch gdebenz is demoted to grade-blind registry and the report says so. Self-detecting. |
| **Invented confidence numbers mislead** | *Was high — now removed* | No float exists; four confidence words with a published derivation table; `evidence[]` in every JSON snapshot |
| 95 vs 95+ conflated | High without care | Separate canonical grades; gdebenz inference marked `directness:'inferred'`; `КОСВЕННО` can never be `высокая`; the report states the reason verbatim |
| Stale data read as current | High | Hard `staleMinutes` exclusion, dedicated `НЕТ СВЕЖИХ ДАННЫХ` bucket, age on every line, `≈` on approximate ages, unconditional disclaimer |
| False station merges | Medium | ≤150 m + brand conflict hard reject + mutual-best one-to-one; hand-editable identity map; `usr_*` ids never persisted |
| **15-min block trips a tool timeout** | Medium | Chunked `wait` (≤240 s per call, exit 20 = call again) |
| Runaway monitoring loop | Medium | `maxHours`/`maxRuns`, abort after 4 total-failure cycles, stop sentinel checked every 5 s |
| Report churn / fake "changes" | Medium | Total-order comparator with `stationKey` final tie-break; diff computed on verdict/confidence/queue transitions, never on rank position |
| gdebenz bbox silently truncating results | Low | Quadrant re-query guard on suspicious counts |
| Timezone confusion | Medium | UTC ISO internally; rendered via `displayTimeZone` |
| ToS / legal exposure | Ongoing | See below |

**Legal and operational posture** — a mandatory `## Ограничения и правовой статус` section in `SKILL.md`. All three sources are unofficial: Yandex's terms restrict automated extraction and `state-view` is an internal, unversioned representation; gdebenz's `/api/*` is undocumented and may change or close without notice; 2GIS actively blocks automation. The posture is therefore personal, low-volume, **read-only**: one poll per 15 minutes, no accounts, no authentication, **no CAPTCHA bypass ever**, `robots.txt` checked and logged (hard-block for 2GIS), honest configurable UA. gdebenz exposes POST endpoints for *submitting* driver reports — **`http.mjs` rejects any method other than GET/HEAD**, so there is no code path by which this skill can write to any source, and that is a structural property rather than a promise. Per-source `enabled:false` is the kill switch; any `BLOCKED_CAPTCHA` or 3 consecutive 4xx trips the breaker for the session and the report says which source went dark and why.

---

## 6. Assumptions and open questions

**Assumptions committed to** (conservative, all cheap to reverse):

1. Node ≥ 20 with global `fetch` and `node:test` (v26.7.0 verified here); zero npm dependencies.
2. Installed at `~/.codex/skills/fuel-watch/` with a flat `SKILL.md` + frontmatter, matching the convention of the skills already on this machine.
3. Default area = Volgograd region bounds from Yandex's own payload — a deliberate superset until the user configures anchors.
4. Default watched grades `AI95` + `AI95_PREMIUM`; others via `--grades`; unmapped grades fail loudly.
5. Interval 15 min per the requirement, configurable, ±90 s jitter.
6. Russian output, `Europe/Volgograd` display; English JSON keys.
7. `fresh_band` is ordinal with `3` = freshest (bands 2 and 3 dominated the live sample; band 1 unobserved) — a config table, **explicitly flagged for calibration**.
8. gdebenz `yes` + `fmask == 0` ⇒ `UNCERTAIN`, not `IN_STOCK`.
9. gdebenz `usr_*` ids are app-local and unstable; excluded from the persisted identity map.
10. State stays under `state/`; snapshots pruned after 48 h; no user data leaves the machine.

**Open questions, each with the default I will implement absent an answer:**

1. **Actual area** — default Volgograd bbox; `resolve-anchors.mjs` converts named outermost stations into a hull + 700 m buffer on request.
2. **`fresh_band` calibration** — default 45/180/480 min for bands 3/2/1. Self-calibrating over a monitoring session: for stations matched to Yandex, compare observed band transitions against Yandex's exact `lastSignalTimestamp`, and log a suggested table. A by-product of simply running the skill.
3. **Repeat reports: full ranking or changes-only?** Default: change line + current top-5 per bucket.
4. **Prices in ranking?** Default: shown (gdebenz supplies them free), **not** ranked on — availability and queue are the stated criteria.
5. **Enable 2GIS?** Default no (registry role, zero verdict weight).
6. **Notification channel?** Default: the task conversation only.
7. **Breadth of "premium"** — default: Yandex `AI95_PREMIUM` plus branded aliases (ЭКТО, G-Drive, Pulsar, Ultimate); extend `fuel.aliases` as brands appear.

**Implementation order, staged so value lands early:**

**V1 (~1 100 LOC, the whole user-facing requirement):** ① `config.mjs` + schema + `geo.mjs` → ② gdebenz adapter (JSON, easiest, yields the registry) → ③ Yandex adapter + fixtures → ④ `identity.mjs` + `verdict.mjs` (pure, exhaustively tested) → ⑤ `render.mjs` + `report.mjs` → ⑥ `watch.mjs` with chunked wait → ⑦ `SKILL.md` + a `skill-validator` pass.

**V2 (only if V1 proves it is needed):** `resolve-anchors.mjs`; the 2GIS browser adapter; `fresh_band` auto-calibration; the gdebenz quadrant-split guard. Each is independently droppable and none blocks the two required modes.