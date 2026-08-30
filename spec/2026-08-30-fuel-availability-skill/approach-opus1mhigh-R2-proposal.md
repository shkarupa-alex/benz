## Constraints and considerations first

Round 2 left one finding unresolved, and I can identify it: **2GIS**. It is a source the task explicitly requested, and across two rounds I have kept it disabled on the strength of an assertion I never actually verified — "2GIS publishes no live fuel-availability feed." Asserting a fact to justify dropping a requirement, without checking it, is exactly the failure mode I criticized in my own scoring model. So I checked, and the picture is both more defensible and more constructive than what I wrote:

- `GET https://2gis.ru/volgograd` with a normal browser UA **302-redirects to `/museum?return_url=…`** — an anti-bot interstitial, not the map.
- **`https://2gis.ru/robots.txt` itself returns HTTP 403** to an automated client. When a site will not even serve you its robots file, you cannot establish permission to crawl it; combined with the interstitial, the operator's intent is unambiguous.
- But `https://catalog.api.2gis.com/3.0/items` — the **official, documented Places API** — is reachable and returns a well-formed `{"code":403,"error":{"message":"Authorization error, incorrect key."}}`. It works; it just requires a registered key.

That reframes the decision entirely. The right answer is not "scrape 2GIS through a browser and fight CAPTCHAs" and not "silently drop a requested source" — it is **use 2GIS through its sanctioned API, gated on a user-supplied key, and never touch the scraped web surface**. That satisfies the requirement, respects the operator, and is the only 2GIS path with a stable contract. What the key-gated API *contains* I still cannot verify without a key; the design therefore makes the source's role a config field so that if its station attributes turn out to carry live availability, promoting it from `registry` to `availability` is a one-line change touching no other code.

I also found and fixed a genuine logic bug in my own decision table while re-deriving it: **rule 2 (`OUT_OF_STOCK` newer than every `IN_STOCK` → `НЕТ`) preempted rule 3 (conflict)**, so an `OUT` that was two minutes newer than an `IN` would render a confident `НЕТ` instead of `ПРОТИВОРЕЧИВО` — precisely the false confidence the whole table exists to prevent. The rules are reordered below with "clearly newer" given an explicit definition.

**Empirical basis (HTTP-verified this session; a reviewer independently reproduced the Yandex and gdebenz findings):**

| Source | Verified 2026-08-30 | Consequence |
|---|---|---|
| Yandex Maps | Plain `curl` + UA → **200, 676 KB**. `<script type="application/json" class="state-view">` holds `"totalResultCount":51,"requestResults":25,"items":[…]`; **all 25** businesses carry `fuelAvailability` with per-grade `status`, `lastSignalTimestamp`, `signalsCountPerHour`, `queueStatus`, `localizedQueueSize`. `page=1..3` → 25+24+13 = 62 unique oids; `totalResultCount` jitters 53/49/63 for one query. | **No browser.** Paginate to a short page; never trust the total. Availability authority. |
| gdebenz.ru | **200** (502 earlier — intermittent). Undocumented JSON API: `GET /api/stations?lat1&lon1&lat2&lon2` → `osm_id, lat, lon, brand, addr, status ∈ yes\|no\|queue\|null, fuels_now, prices_now, dt_only, conflict` (113 in my box; 208 in a reviewer's wider box); `GET /api/comments?<same box>` → `{osm_id, status, fmask, fresh_band, conflict}`. | Clean bbox JSON API, OSM ids, 2–3× Yandex coverage. Registry spine + corroborating voter. |
| 2GIS | `2gis.ru` → **302 to `/museum` interstitial**; **`robots.txt` → 403**; official `catalog.api.2gis.com/3.0/items` → structured 403 "incorrect key". | Web surface is off-limits; **official API adapter, key-gated**, disabled until a key exists. |

Two decoded facts that drive the design:

- **`fmask` is a bitmask over `["92","95","98","100","ДТ"]`** (bits 0–4), recovered from the minified bundle's `Ye=["92","95","98","100","ДТ"]` and cross-validated against `fuels_now`: `27`→`92,95,100,ДТ`; `19`→`92,95,ДТ`; `16`→`ДТ`. A reviewer's independent distribution agrees.
- **gdebenz has no premium-95 concept** (vocabulary stops at 92/95/98/100/ДТ) while Yandex separates `AI95` from `AI95_PREMIUM` — and the first station I sampled read `95: OUT_OF_STOCK, 95+: IN_STOCK`. gdebenz "95 есть" is therefore not evidence that 95+ exists, and treating it as such would route the user to a station that cannot serve them.

---

## 1. Approach summary

Build a dependency-free Node skill at `~/.codex/skills/fuel-watch/` in which three never-throwing source adapters emit uniform per-station-per-grade observations, joined on gdebenz's OSM registry, filtered by a configurable bbox/polygon/anchor-hull, and resolved into a verdict by a **small, totally enumerable decision table** — no fitted score, no probability float — so every line reads `verdict · confidence word · signal age · which sources agreed · why`. Ranking is a deterministic lexicographic comparator (verdict → confidence → queue → freshness → distance) with zero tunable weights, transcribing "rank by probability of availability, then by smallest queue" literally. On-demand mode is one `collect && report`; monitoring is an agent-driven loop whose blocking wait is **chunked to ≤4 minutes per call** so no single tool invocation can time out, with the agent itself publishing each 15-minute summary into the current Codex task.

---

## 2. Architecture and component breakdown

```
~/.codex/skills/fuel-watch/
├── SKILL.md                    # triggers, on-demand + monitor workflows, Limits
├── config.json                 # ONE config: area, fuel, sources, scoring, monitor
├── config.schema.json          # validated on every load; violation = exit 1, never a default
├── config.local.json           # optional, git-ignored, deep-merged (holds the 2GIS key)
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

Eight library modules, four CLIs, one config file. Estimated **~1 100 lines for V1**, excluding tests and fixtures.

- **`sources/*.mjs`** — network + parse only. Export `id`, `role` (`'availability' | 'registry'`, read from config), `collect(ctx)`. **Contractually cannot throw or reject.** No scoring, no geometry, no merging.
- **`http.mjs`** — `fetch` with per-request `AbortSignal.timeout`, bounded retry + backoff + jitter, per-host min-interval, UA/`Accept-Language`, **a method allowlist rejecting anything but GET/HEAD**, and **a host allowlist** (`gdebenz.ru`, `yandex.ru`, `catalog.api.2gis.com`) that makes "we never touch the scraped 2GIS web surface" a structural property rather than a promise. Circuit breaker: any `BLOCKED_CAPTCHA` or 3 consecutive 4xx disables the source for the session.
- **`fuel.mjs`** — canonical grades, alias resolution (case / ё→е / translit), per-source grade maps including the gdebenz bit table and the `premiumSupported: false` flag.
- **`geo.mjs`** — pure: `haversineM`, `pointInPolygon`, `convexHull` (monotone chain), `distanceToPolygonBoundary`, `centroid`, `bboxOf`, `padBboxMeters`. ~120 lines, no deps.
- **`identity.mjs`** — cross-source matching + the persisted, hand-editable identity map.
- **`verdict.mjs`** — pure `(observations, now, cfg) → GradeAssessment`, plus queue normalization and the ranking comparator. Clock injected; no ambient `Date.now()`.
- **`render.mjs`** — snapshot (+ previous) → Russian markdown / compact table / JSON.
- **`store.mjs`** — snapshot write/read/prune, `state/last.json`, identity map, watch state, previous-snapshot resolution.
- **`collect.mjs`** — orchestrator: load+validate config → padded fetch bbox → adapters via `Promise.allSettled` under per-source timeout → geometry filter → identity merge → verdict → snapshot.
- **`watch.mjs`** — monitor state machine. Spawns nothing, ever.

**Flow:** `config → padded fetch bbox → [adapters ∥] → observations → geometry filter → identity merge → verdict table → lexicographic rank → snapshot → render (+diff)`.

---

## 3. Key interfaces and data models

### 3.1 Adapter contract

```js
export const id = 'gdebenz';                   // 'gdebenz' | 'yandex' | 'twogis'
/** @param {CollectContext} ctx @returns {Promise<SourceResult>}  MUST NOT throw/reject. */
export async function collect(ctx) {}
```

```ts
type CollectContext = {
  area: AreaConfig; bbox: BBox; reference: {lat:number; lon:number};
  fuel: FuelConfig; source: SourceConfig;    // source.role is authoritative
  http: HttpClient;              // injected — tests supply a fixture client
  now: () => Date;               // injected — tests supply a fixed clock
  secrets: { twogisApiKey?: string };        // from config.local.json only
  log: (level: 'debug'|'warn'|'error', msg: string, meta?: object) => void;
};

type SourceResult = {
  sourceId: string;
  role: 'availability' | 'registry';
  status: 'ok' | 'partial' | 'failed';
  observations: StationObservation[];
  fetchedAt: string;                          // ISO-8601 UTC
  diagnostics: {
    pagesFetched?: number; itemsSeen?: number; itemsParsed?: number;
    warnings: string[];
    errorCode?: SourceErrorCode;
    errorMessage?: string;                    // ≤300 chars, never a full body, never a key
    debugBodyPath?: string;                   // only on PARSE_SHAPE_CHANGED
  };
};

type SourceErrorCode =
  | 'NETWORK_TIMEOUT' | 'HTTP_ERROR' | 'BLOCKED_CAPTCHA' | 'PARSE_SHAPE_CHANGED'
  | 'EMPTY_RESULT' | 'DISABLED' | 'MISSING_CREDENTIAL' | 'CIRCUIT_OPEN';
```

**The error taxonomy is load-bearing.** `EMPTY_RESULT` (genuinely nothing in the box) and `PARSE_SHAPE_CHANGED` (HTTP 200, body > 100 KB, zero parsed businesses — i.e. upstream refactored) must never collapse into "no data": one is an answer, the other is a broken parser wearing an answer's clothes. The latter dumps the body to `state/debug/` (rotating: 3 files, 2 MB cap) so the fix is one iteration rather than a re-investigation. `partial` retains whatever pages succeeded.

### 3.2 Data model

```ts
type GradeStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNCERTAIN' | 'UNKNOWN';

type StationObservation = {
  sourceId: string;
  sourceStationId: string;
  stationIdKind: 'osm-node' | 'osm-way' | 'user-submitted' | 'vendor';
  name: string; brand: string|null; address: string|null;
  lat: number; lon: number;
  grades: Record<CanonicalGrade, {
    status: GradeStatus;
    raw: string;                        // verbatim source token — auditability
    directness: 'direct' | 'inferred';  // 'inferred' = derived, e.g. gdebenz 95 → 95+
    price?: number; priceObservedAt?: string;
  }>;
  queue: { level: 0|1|2|3|null; label: string|null; precision: 'exact'|'coarse' } | null;
  observedAt: string | null;
  observedAtPrecision: 'exact' | 'band' | 'unknown';
  signalsPerHour?: number;              // Yandex
  conflict?: boolean;                   // gdebenz self-reported disagreement
  extra?: { cashOnly?: boolean; fuelLimit?: string; dtOnly?: boolean };
};

type Station = {
  stationKey: string;         // 'osm:1629297296' | 'osm:w152079274' | 'gb:usr_…' | 'ym:914…'
  name: string; brand: string|null; address: string|null;
  lat: number; lon: number; distanceFromReferenceM: number;
  sourceIds: string[];
  identity: { matchedBy: 'osm'|'geo+brand'|'single-source'; matchDistanceM?: number };
  grades: Record<CanonicalGrade, GradeAssessment>;
  queue: { level: 0|1|2|3|null; label: string|null; source: string|null;
           observedAt: string|null; precision: 'exact'|'coarse'|null };
};

type GradeAssessment = {
  verdict: 'ЕСТЬ' | 'СКОРЕЕ_ЕСТЬ' | 'ПРОТИВОРЕЧИВО' | 'КОСВЕННО' | 'НЕТ' | 'НЕТ_ДАННЫХ';
  confidence: 'высокая' | 'средняя' | 'низкая' | 'нет';
  reason: string;             // "2 источника согласны, сигнал 6 мин назад"
  ageMinutes: number | null;
  ageIsApproximate: boolean;  // true when derived from gdebenz fresh_band
  evidence: Array<{ source: string; status: GradeStatus; ageMinutes: number|null;
                    ageIsApproximate: boolean; directness: 'direct'|'inferred';
                    stale: boolean }>;
};
```

There is **no probability float anywhere**. `verdict` + `confidence` + `reason` + `evidence[]` carries strictly more information than `0.86`, and unlike the float, every part of it is checkable by the user against the sources.

### 3.3 The verdict decision table (corrected ordering)

Per (station, grade): classify every observation's age against `freshMinutes` (45), `recentMinutes` (180), `staleMinutes` (360); gdebenz band observations use the `fresh_band` → minutes table and carry `ageIsApproximate`. Observations older than `staleMinutes` are `stale` and excluded from the rules but **still rendered in `evidence[]`** — "we looked, and the newest signal was 9 hours old" is the explanation for `НЕТ_ДАННЫХ`, not a reason to hide it.

Definitions used below, over non-stale observations only:
- `newestIn` = smallest age among **direct** `IN_STOCK`; `newestOut` = smallest age among **direct** `OUT_OF_STOCK` (`∞` if absent).
- **"clearly newer"** = younger by **more than** `conflictWindowMinutes` (30).
- **Direct dominates inferred**: an inferred observation can never contradict a direct one for the same grade. gdebenz's grade-blind "95 есть" cannot rebut Yandex's explicit "95+ нет", at any age — gdebenz structurally does not know about 95+.

| # | Condition | Verdict |
|---|---|---|
| 1 | No non-stale evidence | `НЕТ_ДАННЫХ` |
| 2 | Direct `IN` and direct `OUT` both exist and **neither is clearly newer** | `ПРОТИВОРЕЧИВО` |
| 3 | `newestOut` clearly newer than `newestIn` (incl. no direct `IN` at all) | `НЕТ` |
| 4 | `newestIn` clearly newer (or no `OUT`) **and** `newestIn ≤ freshMinutes` | `ЕСТЬ` |
| 5 | `newestIn` clearly newer (or no `OUT`) **and** `newestIn ≤ recentMinutes` | `СКОРЕЕ_ЕСТЬ` |
| 6 | Only `inferred` and/or `UNCERTAIN` non-stale evidence | `КОСВЕННО` |
| 7 | otherwise | `НЕТ_ДАННЫХ` |

Rule 2 now precedes rule 3, which is the correction: a two-minute-newer `OUT_OF_STOCK` is a disagreement between crowd reporters, not proof of absence, and reporting it as a confident `НЕТ` would be precisely the false confidence this table exists to prevent.

**Confidence** — a second total table over (directness × age band) × (number of *independent sources* agreeing with the chosen verdict):

| agreeing sources | direct & ≤fresh | direct & ≤recent | inferred / UNCERTAIN |
|---|---|---|---|
| ≥ 2 | высокая | средняя | низкая |
| 1, `signalsPerHour ≥ highConfidenceSignalRate` | высокая | средняя | низкая |
| 1 | средняя | низкая | низкая |

Three hard overrides: `ПРОТИВОРЕЧИВО` caps at `низкая`; gdebenz `conflict: true` demotes one step; **`КОСВЕННО` can never exceed `низкая`**. `НЕТ_ДАННЫХ` always carries `нет`. Every combination is reachable and finite, so `verdict.test.mjs` enumerates the **entire** cross-product rather than sampling a continuum.

Total tunables: `freshMinutes`, `recentMinutes`, `staleMinutes`, `conflictWindowMinutes`, `highConfidenceSignalRate`, and the three-entry `fresh_band` map. Every one has a plain-language meaning the user can argue with.

### 3.4 Ranking — lexicographic, zero weights

```js
// verdict.mjs — total order, no tunable weights, fully deterministic
const VERDICT_RANK    = { ЕСТЬ:0, СКОРЕЕ_ЕСТЬ:1, КОСВЕННО:2, ПРОТИВОРЕЧИВО:3,
                          НЕТ_ДАННЫХ:4, НЕТ:5 };
const CONFIDENCE_RANK = { высокая:0, средняя:1, низкая:2, нет:3 };
const q = s => s.queue?.level ?? 1.5;        // null-safe; unknown sorts between LOW and MEDIUM

compareStations(a, b) =>
     VERDICT_RANK[a.verdict]       - VERDICT_RANK[b.verdict]
  || CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]
  || q(a)                          - q(b)
  || (a.ageMinutes ?? 1e9)         - (b.ageMinutes ?? 1e9)
  || a.distanceFromReferenceM      - b.distanceFromReferenceM
  || a.stationKey.localeCompare(b.stationKey);   // final tie-break → byte-stable reports
```

A direct transcription of the requirement, with no invented arithmetic between incommensurable quantities. `distanceFromReferenceM` is measured from `area.referencePoint` (default: the area centroid) and is a **tie-break only** — we do not know the user's live position, and pretending otherwise would be another invented signal. The `stationKey` final comparator is what makes two consecutive 15-minute reports byte-identical when nothing has changed, which is what stops the diff from fabricating "changes".

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
    "referencePoint": null,                          // null → computed centroid
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
                 "minIntervalMs": 1500 },
    "twogis":  { "enabled": false, "role": "registry",
                 "transport": "official-api",           // ONLY legal value; "scrape" rejected
                 "base": "https://catalog.api.2gis.com/3.0/items",
                 "regionId": 41, "timeoutMs": 20000,
                 "note": "needs apiKey in config.local.json; web surface is off-limits" }
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

`config.schema.json` is enforced on every load by a ~60-line hand-rolled checker (types, enums, ranges, `mode`↔field consistency, and a hard rejection of `twogis.transport: "scrape"`). A config error is **exit 1 naming the offending JSON path** — never a silent default, because a silently-wrong area produces confidently-wrong answers.

The default bbox is Volgograd's own region bounds lifted from the Yandex payload (`"bounds":[[44.22663,48.4696…],[44.807328,48.9434…]]`) — a defensible superset, not a guess. Anchor mode needs no polygon-offset library: `inArea(p) = pointInPolygon(hull, p) || distanceToPolygonBoundary(hull, p) ≤ anchorBufferMeters`, which expresses "these named stations are the outermost acceptable ones", inclusive of the anchors themselves.

### 3.6 CLI contracts

```
node scripts/collect.mjs [--grades "95+,95"] [--sources gdebenz,yandex]
                         [--out <path>] [--list-grades]
  0  snapshot written, ≥1 observation      3  written, all sources failed (diagnostics)
  1  config/usage error (invalid area, unresolvable grade, schema violation)
  # --grades accepts canonical ids OR any alias ("95+", "аи-95", "дизель");
  # an unresolvable token exits 1 listing the known aliases — never a silent empty result.

node scripts/report.mjs [--snapshot state/last.json] [--format md|table|json]
                        [--grades …] [--top 5] [--diff auto|<prev.json>|none] [--all]
  0  rendered                              1  snapshot unreadable/invalid
  # --diff defaults to "auto": store.mjs picks the newest snapshot older than this one.
  # The agent never has to track filenames.

node scripts/watch.mjs start --interval 15 --grades "95+,95" [--max-hours 12]
node scripts/watch.mjs wait      # blocks at most monitor.maxBlockSeconds (240)
  0  cycle due    20  not due yet — call again    10  stopped
  11 budget exhausted (maxHours/maxRuns)          12  aborted: N total-failure cycles
node scripts/watch.mjs status    # JSON
node scripts/watch.mjs stop

node scripts/resolve-anchors.mjs --names "Лукойл Землячки" "Газпром Историческая" [--write]
  # ranked candidates from the live gdebenz registry + paste-ready anchors block.
  # Writes nothing without --write.
```

`resolve-anchors.mjs` needs no geocoding service: the gdebenz registry (`name`, `brand`, `addr`, `lat`, `lon` for every station in the box) **is** the local gazetteer. It stays read-only by default because converting a fuzzy name match into the boundary of the search area is exactly the guess that deserves a human glance.

### 3.7 Identity matching

**Stage 1 — deterministic.** `osm_id` (gdebenz) and `oid` (Yandex) are authoritative *within* a source; never fuzzy-merge inside one source. `stationKey` prefers `osm:<numeric>` / `osm:w<id>`. **`usr_*` ids become `gb:usr_*` with `stationIdKind:'user-submitted'`** — these are app-local, not OSM entities, and may vanish or be renumbered between polls, so they are matched fresh each run and **never** enter the persisted identity map.

**Stage 2 — cross-source.** For each gdebenz station, collect Yandex candidates within 250 m (a plain O(n·m) scan over ≤300 stations, ~2 ms — no spatial index needed at this scale), sort candidate pairs by ascending distance, and accept greedily under a one-to-one constraint when **all three** hold:

1. `haversineM ≤ 150`
2. brands are **not in conflict** — a normalized brand mismatch (after alias/translit/ё folding) within 150 m is a **hard reject**, never a low score
3. brands match, **or** normalized street-token Jaccard ≥ 0.5

Everything else stays unmerged and renders as two rows. Deliberate: a duplicate row is cosmetic, while merging a Лукойл that has 95+ with the Газпром across the road that does not is **an actionable wrong answer**. Accepted merges persist to `state/identity-map.json` (hand-editable), re-verified when either coordinate drifts > 60 m.

### 3.8 Adapter specifics

**gdebenz** — `role: availability`, registry spine
- `GET /api/stations?lat1&lon1&lat2&lon2` and `GET /api/comments?<same box>`; join on `osm_id`.
- No documented pagination: if a response looks suspiciously capped (round count, or count equal to a previous run's exact maximum), split the bbox into quadrants and re-query. Never infer completeness from one call.
- Status semantics: `no` → `OUT_OF_STOCK` for watched grades. `yes`/`queue` with `fmask > 0` → `IN_STOCK` for masked grades, `OUT_OF_STOCK` for unmasked. **`yes` with `fmask == 0` → `UNCERTAIN`** for all watched grades, never `IN_STOCK` — a bare "есть" with no fuel list (95 of 113 rows in my sample) says nothing about a specific grade.
- Premium: `premiumSupported: false` means each gdebenz `AI95` observation also yields an `AI95_PREMIUM` observation flagged `directness: 'inferred'` (when `inferCrossGrade`), which by construction can only ever produce `КОСВЕННО` / `низкая`.
- Freshness: `fresh_band` only (bbox mode carries no absolute timestamp) → band→minutes map, `observedAtPrecision: 'band'`, `ageIsApproximate: true`, rendered `≈45 мин`.
- **`fmask` self-check every run:** decode `fmask` and compare with the same row's `fuels_now` CSV. On any mismatch, warn and **demote gdebenz to grade-blind registry for that run** (keep stations, discard grade claims), and say so in the report. A silent upstream bit rotation becomes self-detecting rather than silently poisoning verdicts.

**Yandex** — `role: availability`, grade/queue authority
- `GET <base>?text=АЗС&ll=<lon,lat>&spn=<dlon,dlat>&z=12&page=N`.
- Extract the last `<script type="application/json" class="state-view">`, entity-decode, `JSON.parse`.
- **Recursively walk the whole object** collecting nodes with `type === 'business' && Array.isArray(coordinates)`. Do **not** index `state.stack[0].results.items` — the wrapper path is the likeliest thing to be renamed, the leaf shape the least.
- Pull `title`, `address`, `coordinates:[lon,lat]`, `oid` via `/oid=(\d+)/` on `uri`, and `fuelAvailability.{fuel[],lastSignalTimestamp,signalsCountPerHour,queueStatus,localizedQueueSize,localizedFuelLimit,cashOnly}`. An unrecognised `fuelType` is a warning, not a failure.
- Paginate to `maxPages` (6), stop on zero *new* oids or a short page, dedupe by oid. `totalResultCount` is a diagnostic only — observed 53/49/63 for a single query.
- `lastSignalTimestamp` is unix **seconds**; future or >30-day-old values downgrade to `observedAtPrecision: 'unknown'`.

**2GIS** — `role: registry` (configurable), `transport: 'official-api'`, `enabled: false` until a key exists

The web surface is **not used, and cannot be**: the host allowlist in `http.mjs` permits `catalog.api.2gis.com` and nothing under `2gis.ru`, and `config.schema.json` rejects `transport: "scrape"`. This is a considered position, not avoidance of work. `2gis.ru` 302-redirects automated clients to a `/museum` interstitial and serves **403 on its own `robots.txt`** — when a site will not tell you what it permits and actively intercepts your client, unattended scraping is unwelcome by any reasonable reading, and no CAPTCHA-defeating machinery belongs in a personal skill. The sanctioned path exists and works: `catalog.api.2gis.com/3.0/items` answers with a well-formed error for a bad key, so a registered free-tier key turns the adapter on with `MISSING_CREDENTIAL` → `ok` and no other change.

What that API contains I could not verify without a key, so the design is deliberately outcome-agnostic: the adapter maps `items[].point`, `name`, `address_name`, and any fuel-related `attributes` into standard observations, and **`role` is read from config**. If 2GIS attributes turn out to be static offerings (fuel types the station sells), it stays `registry` and contributes identity/address data at zero verdict weight. If they turn out to carry live availability, flipping `role: "availability"` in config promotes it into the verdict table with no code change — the never-throwing adapter contract and the source-agnostic verdict rules already accommodate an nth availability voter, and a third independent source is exactly what turns `средняя` into `высокая` under the "≥2 agreeing sources" row.

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
node scripts/collect.mjs --grades "95+,95" && node scripts/report.mjs --format md
```
The agent posts the rendering. Wall time ≈ 3–8 s (one gdebenz pair + ≤6 Yandex pages). A grade no source maps (e.g. `GAS`) exits 1 with `unsupported grade: GAS (no configured source map; known: …)` rather than returning a misleading empty "нигде нет".

**Monitoring**, agent-driven inside the current Codex task:
```
1. watch.mjs start --interval 15 --grades "95+,95"   # writes state, spawns NOTHING
2. collect.mjs ; report.mjs --format md --diff auto
3. agent posts the summary into the conversation
4. watch.mjs wait
     0  → goto 2
     20 → goto 4          # not due yet; ≤4 min elapsed, no tool-call timeout risk
     10 → post «мониторинг остановлен», done
     11 → post budget notice, done
     12 → post degraded notice (4 cycles with zero usable data), done
```

The **chunked wait** closes a hole that would have bitten on the first real session: one foreground command blocking 15 minutes is a plausible harness/tool timeout that would kill the loop mid-run. `wait` blocks at most `maxBlockSeconds` (240), emits a heartbeat, polls the stop sentinel (`state/watch.stop`) every 5 s, and returns `20` when the cycle is not yet due. Three or four cheap calls per interval, none long enough to trip anything.

It stays agent-driven rather than daemon-driven because the requirement is publication *into the current task*: a background process outlives the task and cannot post to the conversation. The honest cost is that the loop ends when the task ends; `state/watch.json` lets a fresh task resume mid-session.

Guards: `maxHours` 12, `maxRuns` 48, abort after 4 consecutive cycles in which every source failed (loudly), user "stop" → `watch.mjs stop`. Each cycle jitters ±90 s.

**Diff stability.** The change line compares only `verdict`, `confidence`, and `queue.level` transitions per (station, grade). Band-derived ages drifting inside a band, or `≈45 мин` becoming `≈48 мин`, are **not** events — otherwise gdebenz's coarse freshness would manufacture a "change" every cycle and destroy the signal the diff exists to carry.

### 3.11 Output format

```
⛽ АИ-95 / 95+ · 30.08.2026 15:40 (Волгоград)
Источники: ГдеБЕНЗ ✓113 · Яндекс ✓62 · 2ГИС — выключен (нет API-ключа; веб-версия не используется)

Изменения за 15 мин: +Лукойл, Землячки (95+ появился) · −Газпром, Историческая (95 кончился)

ЕСТЬ
1. Лукойл · ул. им. М. Фрунзе, 28 · 95+ ЕСТЬ (высокая), 95 НЕТ
   очередь небольшая · сигнал 6 мин назад · Яндекс и ГдеБЕНЗ согласны

СКОРЕЕ ЕСТЬ
2. Роснефть · ул. Землячки, 110 · 95+ (средняя) · очередь нет данных
   сигнал 52 мин назад · только Яндекс

ПРОТИВОРЕЧИВО
3. Газпром · пр. Ленина, 100 · 95 (низкая)
   Яндекс «есть» 12 мин назад · ГдеБЕНЗ «нет» ≈45 мин назад — расхождение меньше 30 мин

КОСВЕННО (грейд не подтверждён)
4. Teboil · ул. Рокоссовского, 40 · 95+ (низкая)
   ГдеБЕНЗ сообщает «95 есть», премиум-95 отдельно не различает · ≈45 мин назад

НЕТ СВЕЖИХ ДАННЫХ (>6 ч): 14 АЗС в зоне  ·  НЕТ: 31 АЗС   (--all для полного списка)

Данные — отметки водителей, не телеметрия АЗС. Возраст сигнала указан у каждой строки.
```

Renderer invariants, enforced in code and asserted by golden-file tests: **no availability claim without an age and a confidence word**; approximate ages always carry `≈`; every failed or disabled source is named with its reason; the `КОСВЕННО` bucket always states *why* it is indirect; `ПРОТИВОРЕЧИВО` always shows both sides with their ages; buckets capped at `topN` with counts for the remainder; the disclaimer is unconditional. `--format json` emits the full snapshot including `evidence[]`.

### 3.12 Testing

Fixtures captured this session and checked in: trimmed Yandex `state-view` JSON (pages 1–3), `gdebenz-stations.json`, `gdebenz-comments.json`, plus a recorded 2GIS `403 incorrect key` body. Parsers are pure functions over fixture text; `node --test`; **zero network in unit tests**.

- **Parsers:** happy path per source; renamed *wrapper* key still yields businesses (proves the recursive walk); renamed *leaf* key yields `PARSE_SHAPE_CHANGED`, not a crash; unknown `fuelType` → warning; pagination stops on short page and on repeated oids.
- **fmask:** decode 0/1/16/19/27; the self-check catches a deliberately rotated bit table and demotes gdebenz to registry.
- **Verdict:** **exhaustive enumeration** of the decision × confidence cross-product plus the three overrides. Regression cases pinned explicitly: `OUT` newer than `IN` by 2 min → `ПРОТИВОРЕЧИВО`; by 45 min → `НЕТ`; fresh inferred `IN` vs older direct `OUT` → `НЕТ` (direct dominates inferred).
- **Ranking:** comparator is a strict weak ordering; null queue sorts between LOW and MEDIUM; identical snapshots render byte-identically.
- **Geometry:** in/out of bbox, polygon, hull+buffer; anchor inclusion exactly at a hull vertex; ±180/±90 guards.
- **Identity:** merge at 30 m same brand; **non-merge at 90 m with conflicting brands**; one-to-one constraint; `usr_*` never persisted.
- **Transport guards:** `http.mjs` rejects POST; rejects any `2gis.ru` host; `config.schema.json` rejects `transport: "scrape"`. These are tests, not comments.
- **Watch:** start→wait(20)→wait(0)→stop; budget exhaustion; consecutive-failure abort; stop sentinel honored within 5 s.
- **Render:** golden files including the all-sources-failed report and the gdebenz-demoted report.
- **Live smoke** (`npm run smoke`, opt-in, never automatic): asserts ≥1 station with a parsed grade status per enabled source. Doubles as the shape-drift canary.

---

## 4. Key trade-offs

1. **Discrete verdict table over a weighted probability model.** With no ground truth, a float is unfalsifiable decoration. Named thresholds and a finite table are auditable, exhaustively testable, arguable by the user, and *more* informative on the page: `«ЕСТЬ, высокая: 2 источника согласны, 6 мин назад»` tells the reader what to check; `0.86` does not.
2. **Lexicographic ranking over a weighted sum.** Availability, queue, freshness and distance are incommensurable; any weighting between them is invented. The comparator transcribes the requirement and has zero tunables.
3. **gdebenz as registry spine, Yandex as availability authority.** gdebenz gives JSON, OSM ids and 2–3× the coverage; Yandex gives per-grade granularity, queues and exact timestamps. Neither alone suffices; either alone still produces a useful report.
4. **2GIS via its official API, key-gated, never scraped.** This is the resolution of my one outstanding disagreement with the council. The task named 2GIS as a source, and the adapter now has a real, sanctioned, stable-contract path to it instead of a browser CAPTCHA fight against a site whose robots.txt returns 403. The cost is a manual key registration step; the benefit is a source that will not break, will not get blocked, and can be promoted to a full availability voter by one config field if its data supports it.
5. **Plain HTTP by default; no browser at all in V1.** Verified today for both live sources. A browser is slow, untestable against fixtures, and fragile inside a 15-minute loop — and with 2GIS moved to its API, nothing in the design needs one.
6. **Conservative non-merge on ambiguous identity**, with brand conflict as a hard reject. Duplicates are cosmetic; false merges are actionable wrong answers.
7. **Chunked blocking wait** over one long block or a daemon. A daemon cannot publish into the current task; a 15-minute block risks a tool timeout. Short repeated blocks are the only shape satisfying both.
8. **One config file over four.** The split bought namespacing nobody needed; secrets alone live separately, in `config.local.json`.
9. **Zero npm dependencies, stdlib only.** No cheerio (one regex + `JSON.parse`), no turf (~120 lines of geometry), no HTTP client, no schema library. A skill running Node out of `~/.codex` should be auditable in one sitting and immune to supply-chain drift.

---

## 5. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Yandex `state-view` shape change | High (unversioned internal) | Shape-agnostic recursive walk; `PARSE_SHAPE_CHANGED` canary (200 + big body + 0 businesses); debug body dump; fixtures pin the shape; gdebenz still answers |
| Yandex rate-limit / challenge | Medium | ≤6 pages/cycle, 1 cycle/15 min, min-interval + jitter, circuit breaker; on `BLOCKED_CAPTCHA` the source goes dark for the session and the report says so — no bypass attempt |
| gdebenz downtime (502 observed) or API change | Medium | Endpoints + bit table in config; retries with backoff; optional — run continues on Yandex alone |
| **`fmask` bit order rotates silently** | Low, severe | Per-run cross-validation against `fuels_now`; on mismatch gdebenz demotes to grade-blind registry and the report states it. Self-detecting. |
| **Confident `НЕТ` on a 2-minute-newer OUT** | *Was present — now fixed* | Conflict rule evaluated **before** the definitive-`НЕТ` rule; `conflictWindowMinutes` guard; pinned regression tests |
| Invented confidence numbers mislead | *Removed* | No float exists; four confidence words with a published derivation table; `evidence[]` in every snapshot |
| 95 vs 95+ conflated | High without care | Separate canonical grades; gdebenz inference flagged `inferred`; direct dominates inferred; `КОСВЕННО` capped at `низкая`; the report states the reason verbatim |
| Stale data read as current | High | Hard `staleMinutes` exclusion, dedicated `НЕТ СВЕЖИХ ДАННЫХ` bucket, age on every line, `≈` on approximate ages, unconditional disclaimer |
| False station merges | Medium | ≤150 m + brand-conflict hard reject + one-to-one; hand-editable identity map; `usr_*` never persisted |
| 15-min block trips a tool timeout | Medium | Chunked `wait` (≤240 s per call, exit 20 = call again) |
| Runaway monitoring loop | Medium | `maxHours`/`maxRuns`, abort after 4 total-failure cycles, stop sentinel checked every 5 s |
| Report churn / fake "changes" | Medium | Total-order comparator with `stationKey` tie-break; diff on verdict/confidence/queue transitions only, never on rank position or band-internal age drift |
| gdebenz bbox silently truncating | Low | Quadrant re-query guard on suspicious counts |
| **Accidentally hitting a blocked or write endpoint** | Low, severe | `http.mjs` host allowlist + GET/HEAD-only method allowlist; schema rejects `transport:"scrape"`; all three asserted by tests |
| Timezone confusion | Medium | UTC ISO internally; rendered via `displayTimeZone` |

**Legal and operational posture** — a mandatory `## Ограничения и правовой статус` section in `SKILL.md`. Yandex's terms restrict automated extraction and `state-view` is an internal, unversioned representation; gdebenz's `/api/*` is undocumented and may change or close without notice; 2GIS is accessed **only** through its official Places API under a registered key, because its web surface intercepts automated clients and refuses to serve `robots.txt`. The posture is personal, low-volume, **read-only**: one poll per 15 minutes, no accounts, no authentication beyond a user-supplied 2GIS key, **no CAPTCHA bypass ever**, honest configurable UA, `robots.txt` fetched and logged where it is served. gdebenz exposes POST endpoints for *submitting* driver reports — the GET/HEAD allowlist means there is no code path by which this skill can write to any source, and that is a structural property with a test behind it. Per-source `enabled:false` is the kill switch; any `BLOCKED_CAPTCHA` or 3 consecutive 4xx trips the breaker and the report names which source went dark and why.

---

## 6. Assumptions and open questions

**Assumptions committed to** (conservative, all cheap to reverse):

1. Node ≥ 20 with global `fetch` and `node:test` (v26.7.0 verified here); zero npm dependencies.
2. Installed at `~/.codex/skills/fuel-watch/` with a flat `SKILL.md` + frontmatter, matching the convention of the skills already on this machine.
3. Default area = Volgograd region bounds from Yandex's own payload — a deliberate superset until anchors are configured.
4. Default watched grades `AI95` + `AI95_PREMIUM`; others by alias; unmapped grades fail loudly.
5. Interval 15 min per the requirement, configurable, ±90 s jitter.
6. Russian output, `Europe/Volgograd` display; English JSON keys.
7. `fresh_band` is ordinal with `3` = freshest (bands 2 and 3 dominated the live sample; band 1 unobserved) — a config table, **explicitly flagged for calibration**.
8. gdebenz `yes` + `fmask == 0` ⇒ `UNCERTAIN`, not `IN_STOCK`.
9. gdebenz `usr_*` ids are app-local and unstable; excluded from the persisted identity map.
10. **The 2GIS Places API exposes station identity/attributes rather than live availability** — unverified without a key, so 2GIS defaults to `role: "registry"` (zero verdict weight). If a key reveals live availability fields, one config field promotes it.
11. State stays under `state/`; snapshots pruned after 48 h; no user data and no key ever leaves the machine.

**Open questions, each with the default I will implement absent an answer:**

1. **Actual area** — default Volgograd bbox; `resolve-anchors.mjs` turns named outermost stations into a hull + 700 m buffer on request.
2. **A 2GIS API key** — default: none, source disabled with `MISSING_CREDENTIAL` reported in every summary footer so its absence is visible rather than silent. Registering a free-tier key is a one-time user action.
3. **`fresh_band` calibration** — default 45/180/480 min for bands 3/2/1. Self-calibrating over a monitoring session: for stations matched to Yandex, compare observed band transitions against Yandex's exact `lastSignalTimestamp` and log a suggested table.
4. **Repeat reports: full ranking or changes-only?** Default: change line + current top-5 per bucket.
5. **Prices in ranking?** Default: shown (gdebenz supplies them free), **not** ranked on — availability and queue are the stated criteria.
6. **Reference point for the distance tie-break** — default: area centroid; settable to a home address if the user prefers.
7. **Breadth of "premium"** — default: Yandex `AI95_PREMIUM` plus branded aliases (ЭКТО, G-Drive, Pulsar, Ultimate); extend `fuel.aliases` as brands appear.

**Implementation order, staged so value lands early:**

**V1 (~1 100 LOC — the complete user-facing requirement, no browser, no key needed):** ① `config.mjs` + schema + `geo.mjs` → ② gdebenz adapter (JSON, easiest, yields the registry) → ③ Yandex adapter + fixtures → ④ `identity.mjs` + `verdict.mjs` (pure, exhaustively tested) → ⑤ `render.mjs` + `report.mjs` → ⑥ `watch.mjs` with chunked wait → ⑦ `SKILL.md` + a `skill-validator` pass.

**V2 (independently droppable; none blocks either required mode):** the 2GIS official-API adapter (~80 LOC once a key exists); `resolve-anchors.mjs`; `fresh_band` auto-calibration; the gdebenz quadrant-split guard.