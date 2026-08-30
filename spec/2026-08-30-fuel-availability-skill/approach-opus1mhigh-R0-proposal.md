## Constraints and considerations first

Before committing to a shape, three things constrain this design hard. First, **the requirement "report confidence/freshness rather than 'fuel is present'" is the actual product**, not a garnish — it forces a data model where every grade verdict carries an age, a source set, and an agreement/conflict flag all the way to the rendered line, which in turn forces per-source observations to be kept separate until the last step rather than merged eagerly. Second, **"monitoring inside the current Codex task"** rules out a daemon or cron: a background process outlives the task and cannot publish into the conversation, so the only reliable primitive is a *foreground blocking wait* that returns control to the agent every 15 minutes. Third, **all three sources are unofficial and independently fragile**, so "source failures must not prevent a useful result" has to be structural (adapters that cannot throw, a run that is useful with 1 of 3) rather than a try/catch afterthought.

I also spent this session verifying the sources rather than designing against the task description's snapshot, and the findings change the design materially:

| Source | Verified 2026-08-30 | Consequence |
|---|---|---|
| Yandex Maps | Plain `curl` + UA → **200, 676 KB**. `<script type="application/json" class="state-view">` contains `"totalResultCount":51,"requestResults":25,"items":[…]`; every business carries `fuelAvailability` with per-grade `status`, `lastSignalTimestamp`, `signalsCountPerHour`, `queueStatus`, `localizedQueueSize`. `?page=1..3` works (25+24+13 = 62 stations); `totalResultCount` jitters 53/49/63 across pages. | **No browser needed.** Paginate until short page; never trust the total. |
| gdebenz.ru | **Now 200** (was 502). It is a Leaflet/MapLibre SPA with an **undocumented public JSON API**: `GET /api/stations?lat1&lon1&lat2&lon2` → 113 stations for the Volgograd bbox with `osm_id`, `lat/lon`, `brand`, `addr`, `status` ∈ `yes/no/queue/null`, `fuels_now` CSV, `prices_now`; `GET /api/comments?<same bbox>` → `{osm_id, status, fmask, fresh_band, conflict}`. | **This is the biggest find.** Not a degraded HTML-scrape source — a clean JSON API with **OSM ids** (stable identity) and ~2× Yandex's station coverage. It becomes the identity spine. |
| 2GIS | `curl` → **403**; task reports CAPTCHA on browser sessions. | Confirmed hostile. But 2GIS **publishes no live fuel-availability feed** — its value is name/address/brand, which OSM already gives us. Demote it. |

Two decoded details worth stating up front, because they are load-bearing:

- **`fmask` is a bitmask over `["92","95","98","100","ДТ"]`** (bit 0…4), recovered from the bundle's `Ye=["92","95","98","100","ДТ"]` and cross-validated against `fuels_now`: `27` → `92,95,100,ДТ`; `19` → `92,95,ДТ`; `16` → `ДТ`. All three match observed rows.
- **gdebenz has no premium-95 concept at all** (its grade vocabulary stops at 92/95/98/100/ДТ), while Yandex distinguishes `AI95` from `AI95_PREMIUM` — and the very first station I sampled had `95: OUT_OF_STOCK, 95+: IN_STOCK`. So gdebenz "95 есть" is *weak* evidence for the user's default watch target, not proof. The scoring model has to encode that asymmetry explicitly or the skill will confidently send the user to a station that has no 95+.

---

## 1. Approach summary

Build a dependency-free Node skill at `~/.codex/skills/fuel-watch/` whose three source adapters return a uniform, never-throwing `SourceResult`, joined into one station set keyed on gdebenz's OSM ids, filtered by a configurable bbox/polygon/anchor-hull geometry, and scored by a transparent time-decayed weighted-evidence model that produces a per-grade probability *and* a separate confidence, both rendered on every output line alongside signal age and which sources agreed. Yandex and gdebenz are fetched over plain HTTPS (empirically verified today — no browser); 2GIS is demoted to an optional browser-only *registry* enrichment that contributes zero weight to availability verdicts. Monitoring runs as an agent-driven loop where a blocking `watch.mjs wait` command returns control every 15 minutes so the agent itself publishes each summary into the current task, with change-diffing so the 2nd..Nth report is signal rather than repetition.

---

## 2. Architecture and component breakdown

```
~/.codex/skills/fuel-watch/
├── SKILL.md                     # trigger description, agent workflow, Limits section
├── config/
│   ├── area.json                # bbox | polygon | anchors  (user-editable)
│   ├── fuel.json                # canonical grades, aliases, per-source grade maps
│   ├── sources.json             # endpoints, timeouts, pagination, kill-switches
│   ├── scoring.json             # decay, weights, priors, thresholds
│   └── *.schema.json            # JSON Schema for each of the above
├── scripts/
│   ├── collect.mjs              # CLI: sources → normalized snapshot
│   ├── report.mjs               # CLI: snapshot (+prev) → md/json/table
│   ├── watch.mjs                # CLI: monitoring state machine (start/wait/status/stop)
│   ├── resolve-anchors.mjs      # CLI: station names → coordinates → area block
│   └── lib/
│       ├── config.mjs  geo.mjs  http.mjs  fuel.mjs
│       ├── identity.mjs  score.mjs  queue.mjs  render.mjs  snapshot.mjs
│       └── sources/{yandex,gdebenz,twogis}.mjs
├── test/{fixtures,*.test.mjs}   # node --test, zero network
└── state/                       # snapshots, identity map, watch state, debug bodies
```

**Responsibilities, one line each:**

- **`sources/*.mjs`** — network + parse only. Each exports `id`, `role` (`'availability' | 'registry'`), and `collect(ctx)`. **Contractually cannot throw**; catches everything and returns a failure `SourceResult`. No scoring, no geometry, no merging.
- **`http.mjs`** — `fetch` wrapper with per-request timeout (`AbortSignal.timeout`), bounded retries with exponential backoff + jitter, min-interval throttle per host, UA/Accept-Language injection, and a **circuit breaker** (3 consecutive 4xx or any `BLOCKED_CAPTCHA` disables the source for the remainder of the session).
- **`fuel.mjs`** — canonical grade vocabulary, alias resolution (case/ё/translit-insensitive), per-source grade mapping including the gdebenz bit-index table and the premium-unknown flag.
- **`geo.mjs`** — pure geometry: `haversineMeters`, `pointInPolygon` (ray casting), `convexHull` (Andrew monotone chain), `distanceToPolygonBoundary`, `bboxOf`, `padBboxMeters`, `geohash`. No I/O.
- **`identity.mjs`** — cross-source station matching + the persisted, hand-editable identity map.
- **`score.mjs`** — pure: `(observations, now, scoringConfig) → GradeAssessment`. Clock is injected, never ambient.
- **`queue.mjs`** — queue normalization across sources into a single ordinal + label.
- **`render.mjs`** — snapshot (+ optional previous snapshot) → Russian markdown / compact table / JSON.
- **`snapshot.mjs`** — write/read/prune `state/snapshots/`, maintain `state/last.json`.
- **`collect.mjs`** — orchestrator: load config → build fetch bbox → run adapters under `Promise.allSettled` with per-source timeout → geometry filter → identity merge → score → write snapshot. Exit code encodes usefulness.
- **`watch.mjs`** — the monitoring state machine; owns `state/watch.json` and the stop sentinel. Deliberately spawns nothing.

**Data flow:** `config → fetch bbox (area + pad) → [adapters in parallel] → observations → geometry filter → identity merge → per-grade scoring → ranking → snapshot → render (+diff vs previous)`.

---

## 3. Key interfaces and data models

### 3.1 Source adapter contract

```js
// scripts/lib/sources/<name>.mjs
export const id   = 'yandex';                 // 'yandex' | 'gdebenz' | 'twogis'
export const role = 'availability';           // 'availability' | 'registry'

/**
 * @param {CollectContext} ctx
 * @returns {Promise<SourceResult>}   MUST NOT throw. MUST NOT reject.
 */
export async function collect(ctx) { /* ... */ }
```

```ts
type CollectContext = {
  area: AreaConfig;
  bbox: BBox;                    // area bbox padded by fetchPadMeters
  center: { lat: number; lon: number };
  fuel: FuelConfig;
  source: SourceConfig;          // this adapter's slice of sources.json
  http: HttpClient;              // injected — tests pass a fixture client
  now: () => Date;               // injected — tests pass a fixed clock
  browser: BrowserRunner | null; // null unless agent-browser is available & allowed
  log: (level, msg, meta?) => void;
};

type SourceResult = {
  sourceId: string;
  status: 'ok' | 'partial' | 'failed';
  observations: StationObservation[];
  fetchedAt: string;                          // ISO-8601 UTC
  diagnostics: {
    pagesFetched?: number;
    itemsSeen?: number;
    itemsParsed?: number;
    warnings: string[];
    errorCode?: SourceErrorCode;
    errorMessage?: string;                    // truncated to 300 chars, no secrets
    debugBodyPath?: string;                   // set only on PARSE_SHAPE_CHANGED
  };
};

type SourceErrorCode =
  | 'NETWORK_TIMEOUT' | 'HTTP_ERROR' | 'BLOCKED_CAPTCHA'
  | 'PARSE_SHAPE_CHANGED' | 'EMPTY_RESULT' | 'DISABLED'
  | 'BROWSER_UNAVAILABLE' | 'CIRCUIT_OPEN';
```

**Error semantics that matter.** `EMPTY_RESULT` and `PARSE_SHAPE_CHANGED` must never be conflated: a 200 response with a >100 KB body that yields **zero** businesses is a shape change (an upstream refactor), and it dumps the body to `state/debug/` (rotating, max 3 files, max 2 MB) so the parser can be fixed in one iteration instead of a re-scrape expedition. A genuinely empty area returns `ok` with `observations: []`. `partial` means some pages succeeded and some failed — those observations are still used.

### 3.2 Normalized observation and merged station

```ts
type GradeStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNCERTAIN' | 'UNKNOWN';

type StationObservation = {
  sourceId: string;
  sourceStationId: string;          // yandex oid | gdebenz osm_id | '2gis:<id>'
  osmId?: string;                   // present for gdebenz — the identity spine
  name: string; brand: string | null; address: string | null;
  lat: number; lon: number;
  grades: Record<CanonicalGrade, {
    status: GradeStatus;
    raw: string;                    // verbatim source token, for auditability
    inferred?: 'cross-grade';       // set when derived, not directly reported
    price?: number;                 // gdebenz prices_now
    priceObservedAt?: string;
  }>;
  queue: { status: 'NONE'|'LOW'|'MEDIUM'|'HIGH'|null; label: string|null;
           precision: 'exact'|'coarse' } | null;
  observedAt: string | null;        // ISO — source-reported signal time
  observedAtPrecision: 'exact' | 'band' | 'unknown';
  signalsPerHour?: number;          // Yandex
  conflict?: boolean;               // gdebenz conflict flag
  extra?: { cashOnly?: boolean; fuelLimit?: string; dtOnly?: boolean };
};

type Station = {
  stationKey: string;               // 'osm:1629297296' > 'ym:91428629908' > 'geo:<geohash8>'
  name: string; brand: string|null; address: string|null;
  lat: number; lon: number;
  distanceFromCenterM: number;
  inArea: boolean;
  sourceIds: string[];              // which sources contributed
  identity: { matchScore: number|null; matchedBy: 'osm'|'geo+brand'|'single-source' };
  grades: Record<CanonicalGrade, GradeAssessment>;
  queue: { level: 0|1|2|3|null; label: string|null; source: string|null;
           observedAt: string|null };
  rankScore: number;
};

type GradeAssessment = {
  probability: number;              // 0..1 — "fuel is actually there right now"
  confidence: number;               // 0..1 — "how much do we know at all"
  verdict: 'likely' | 'maybe' | 'unlikely' | 'unknown';
  freshnessMinutes: number | null;
  freshnessClass: 'fresh' | 'recent' | 'stale' | 'unknown';
  conflict: boolean;
  evidence: Array<{ source: string; status: GradeStatus; ageMinutes: number|null;
                    weight: number; inferred?: string }>;
};
```

`evidence[]` is retained in the snapshot on purpose: it is what makes a confidence number defensible rather than a vibe, and it is what the markdown renderer turns into `«Яндекс и ГдеБЕНЗ согласны, 6 мин назад»`.

### 3.3 CLI contracts

```
node scripts/collect.mjs [--grades AI95,AI95_PREMIUM] [--area config/area.json]
                         [--sources yandex,gdebenz] [--browser auto|never|always]
                         [--out state/snapshots/<ts>.json]
  exit 0  snapshot written, ≥1 observation from ≥1 source
  exit 3  snapshot written but every source failed  (diagnostics present; NOT a crash)
  exit 1  usage/config error (bad area geometry, unknown grade, unreadable config)

node scripts/report.mjs [--snapshot state/last.json] [--format md|json|table]
                        [--grades ...] [--top 10] [--diff <prev-snapshot.json>]
  exit 0  rendered;  exit 1  snapshot unreadable/invalid

node scripts/watch.mjs start --interval 15 --grades AI95,AI95_PREMIUM [--max-hours 12]
node scripts/watch.mjs wait     # BLOCKS until nextDueAt; heartbeat to stderr
     exit 0  cycle due       exit 10  stopped by user       exit 11  budget exhausted
     exit 12 aborted: N consecutive all-source failures
node scripts/watch.mjs status   # JSON state to stdout
node scripts/watch.mjs stop

node scripts/resolve-anchors.mjs --names "Лукойл Землячки" "Газпром Историческая" [--write]
  # matches names against the live gdebenz OSM registry, prints ranked candidates
  # + a paste-ready area.json anchors block. Writes nothing unless --write.
```

`resolve-anchors.mjs` is deliberately read-only by default: turning a fuzzy name match into the *boundary of the search area* is exactly the kind of silent guess that should require a human glance. Note it needs no geocoding service — the 113-station gdebenz registry with `name`, `brand`, `addr`, `lat`, `lon` **is** the local gazetteer.

### 3.4 Configuration schemas

**`config/area.json`**
```jsonc
{
  "mode": "bbox",                          // "bbox" | "polygon" | "anchors"
  "bbox": { "south": 48.4696, "west": 44.2266, "north": 48.9435, "east": 44.8073 },
  "polygon": null,                         // [[lon,lat], ...] closed ring, mode:"polygon"
  "anchors": [                             // mode:"anchors" → convex hull + buffer
    { "label": "Лукойл, ул. Землячки", "lat": 48.7223, "lon": 44.5021,
      "resolvedFrom": "gdebenz:osm:530809435", "resolvedAt": "2026-08-30T12:00:00Z" }
  ],
  "anchorBufferMeters": 700,               // hull is inclusive of the named stations
  "fetchPadMeters": 2000,                  // query wider than we filter
  "displayTimeZone": "Europe/Volgograd"
}
```

The default bbox is not invented — it is Volgograd's own region bounds as reported inside the Yandex payload (`"bounds":[[44.22663,48.4696…],[44.807328,48.9434…]]`), which makes the out-of-the-box behaviour a defensible superset rather than a guess.

Anchor mode avoids needing a polygon-offset library: `inArea(p) = pointInPolygon(hull, p) || distanceToPolygonBoundary(hull, p) <= anchorBufferMeters`. That is ~40 lines of pure geometry and is exactly right for "these named stations are the outermost acceptable ones".

**`config/fuel.json`**
```jsonc
{
  "canonical": ["AI92","AI95","AI95_PREMIUM","AI98","AI100","DT","GAS"],
  "defaultWatch": ["AI95","AI95_PREMIUM"],
  "premiumOf": { "AI95_PREMIUM": "AI95", "AI100": "AI98" },
  "aliases": {
    "AI95":         ["95","аи-95","аи95","ai95","95-й"],
    "AI95_PREMIUM": ["95+","95 премиум","экто 95","ekto","g-drive 95","джи-драйв",
                     "pulsar 95","пульсар","ultimate 95","ai95_premium","премиум 95"],
    "DT":           ["дт","дизель","diesel","солярка"]
  },
  "sourceMaps": {
    "yandex":  { "AI92":"AI92","AI95":"AI95","AI95_PREMIUM":"AI95_PREMIUM",
                 "AI98":"AI98","AI100":"AI100","DT":"DIESEL" },
    "gdebenz": { "bitIndex": { "AI92":0,"AI95":1,"AI98":2,"AI100":3,"DT":4 },
                 "csvNames": { "92":"AI92","95":"AI95","98":"AI98","100":"AI100","ДТ":"DT" },
                 "premiumSupported": false }
  },
  "brandAliases": {
    "Лукойл": ["lukoil","лукойл"], "Газпром": ["газпромнефть","газпром нефть","gazprom"],
    "Роснефть": ["rosneft"], "Teboil": ["тебойл"], "ТНК": ["tnk"]
  }
}
```

The gdebenz bit order lives **in config, not code**, precisely because it was reverse-engineered from a minified bundle and is the single most likely thing to silently rotate.

**`config/scoring.json`**
```jsonc
{
  "freshness": {
    "halfLifeMinutes": 90,
    "staleAfterMinutes": 360,
    "classBoundaries": { "fresh": 45, "recent": 180 },
    "gdebenzBandMinutes": { "3": 45, "2": 180, "1": 480 },   // ASSUMPTION — see §6
    "bandPrecisionPenalty": 0.85
  },
  "sourceWeight":  { "yandex": 1.0, "gdebenz": 0.8, "twogis": 0.0 },
  "statusPrior":   { "IN_STOCK": 0.85, "UNCERTAIN": 0.50, "UNKNOWN": 0.35, "OUT_OF_STOCK": 0.08 },
  "neutralPseudoWeight": 0.35,
  "signalRateBonus": { "perSignalPerHour": 0.06, "cap": 0.30 },
  "crossGradeWeight": 0.35,
  "conflictPenalty": 0.25,
  "verdictThresholds": { "likely": { "p": 0.65, "conf": 0.40 }, "maybe": { "p": 0.45 },
                          "unlikely": { "p": 0.25 } },
  "ranking": { "availabilityWeight": 0.75, "queueWeight": 0.25, "distancePenaltyPerKm": 0.01,
               "unknownQueueScore": 0.5 },
  "queueScore": { "NONE": 1.0, "LOW": 0.8, "MEDIUM": 0.5, "HIGH": 0.2 },
  "minConfidenceToReport": 0.25
}
```

### 3.5 Scoring model (fully specified — no hand-waving)

For each station × watched grade, over every observation `e`:

1. **Age.** `ageMin = (now − observedAt)/60000`. For `observedAtPrecision:'band'` (gdebenz), `observedAt` is imputed from `gdebenzBandMinutes[fresh_band]` and a `bandPrecisionPenalty` multiplier applies.
2. **Decay.** `decay = 0.5 ** (ageMin / halfLifeMinutes)`, and `decay = 0` when `ageMin > staleAfterMinutes`. A zero-weight observation still appears in `evidence[]` marked stale — it explains *why* we say "unknown" instead of silently vanishing.
3. **Weight.** `w = sourceWeight[src] × decay × precisionPenalty × gradeFactor`, where `gradeFactor = 1.0` for a directly reported grade and `crossGradeWeight` (0.35) for inference — chiefly gdebenz "95" → `AI95_PREMIUM`.
4. **Probability.** Weighted blend pulled toward ignorance:
   `p = (0.5·w₀ + Σ wᵢ·prior(statusᵢ)) / (w₀ + Σ wᵢ)`, `w₀ = neutralPseudoWeight`.
5. **Confidence.** `conf = (1 − 1/(1 + Σwᵢ)) · (1 + min(cap, signalsPerHour·rate)) · (conflict ? 1 − conflictPenalty : 1)`, clamped to [0,1]. `conflict` fires when two live-weight observations straddle IN_STOCK / OUT_OF_STOCK, or gdebenz sets its own `conflict` flag.
6. **Verdict.** Thresholds from config; `conf < minConfidenceToReport` forces `unknown` regardless of `p`.
7. **Rank.** `rank = 0.75·(p·(0.5 + 0.5·conf)) + 0.25·queueScore − 0.01·distanceKm`. Deterministic tie-break: fresher, then closer, then `stationKey` ascending — so two consecutive 15-minute reports don't shuffle equal stations and manufacture fake "changes".

The `p·(0.5 + 0.5·conf)` term is the load-bearing bit for the ranking requirement: a station with one 4-hour-old "есть" cannot outrank a station with two agreeing 5-minute-old signals, even though both have high `p`.

### 3.6 Queue normalization

| Source signal | Normalized |
|---|---|
| Yandex `queueStatus: HIGH` + `localizedQueueSize: "Большая очередь"` | `{level: 3, label: "большая", precision: 'exact'}` |
| Yandex `queueStatus` MEDIUM / LOW / absent | 2 / 1 / `null` |
| Unknown future `queueStatus` token | regex fallback on the localized string (`нет очереди`→0, `неболь\|маленьк`→1, `средн`→2, `больш\|огромн`→3); still unrecognised → `null` + warning |
| gdebenz `status === 'queue'` | `{level: 2, label: "есть очередь", precision: 'coarse'}` — **and** IN_STOCK evidence for the `fmask` grades |
| No queue data | `null` → `unknownQueueScore: 0.5` in ranking (neither rewarded nor punished) |

### 3.7 Station identity matching

Two stages, deliberately conservative.

**Stage 1 — deterministic.** `osm_id` (gdebenz) and `oid` (Yandex) are authoritative *within* a source. Never fuzzy-merge inside one source.

**Stage 2 — cross-source.** Block candidates by geohash-6 cell + 8 neighbours (≈ ±600 m), then score:

```
matchScore = 0.60·geoScore + 0.25·brandScore + 0.15·addrScore
  geoScore   = max(0, 1 − haversineM/120)          // hard reject beyond 250 m
  brandScore = 1.0 exact-after-normalize | 0.8 alias-table hit | 0.0 conflicting brands
  addrScore  = Jaccard over street tokens (lowercase, ё→е, drop ул/улица/пр-кт/д/им/№)
```

Accept only when `matchScore ≥ 0.72` **and** the pair is a mutual best match (greedy descending with a one-to-one constraint). **A conflicting brand within 120 m is a hard reject, not a low score** — competitor stations sit across the road from each other constantly in Volgograd, and merging a Лукойл that has 95+ with a Газпром that doesn't is the single worst failure this skill can produce. An unmerged duplicate is cosmetic; a false merge is a wrong answer.

Accepted merges persist to `state/identity-map.json` (`{"osm:1629297296": {"yandex": "91428629908", "score": 0.91, "confirmedAt": "..."}}`) so identity is stable across the 48 polls of a monitoring session and can be hand-corrected. The cache is advisory and re-verified if either coordinate drifts > 60 m.

### 3.8 Yandex adapter — parse strategy

The path to the items array is internal and unversioned, so the parser is deliberately **shape-agnostic**:

1. Extract `<script type="application/json" class="state-view">…</script>` (last one wins), HTML-entity-decode, `JSON.parse`.
2. **Recursively walk the whole object** collecting any node with `type === 'business' && Array.isArray(coordinates)`. Do *not* index `state.stack[0].results.items`.
3. Per node pull: `title`, `address`, `coordinates:[lon,lat]`, `oid` via `/oid=(\d+)/` on `uri`, and `fuelAvailability.{fuel[],status,lastSignalTimestamp,signalsCountPerHour,queueStatus,localizedQueueSize,localizedFuelLimit,cashOnly}`.
4. Map `fuelType` through `sourceMaps.yandex`; an **unrecognised `fuelType` is a warning, not a failure** — a new `AI95_ECTO` token must degrade to a diagnostic line, not a crash.
5. Paginate `page=1..maxPages` (default 6), stop on a page yielding zero *new* oids or `< pageSize` items, dedupe by oid. `totalResultCount` is recorded as a diagnostic and **never** used as a loop bound (observed 53/49/63 for the same query).
6. `lastSignalTimestamp` is unix **seconds** → ×1000. Reject timestamps in the future or older than 30 days as `observedAtPrecision:'unknown'`.

### 3.9 Monitoring lifecycle

`SKILL.md` instructs the agent to run this loop *in the current task*:

```
1. watch.mjs start --interval 15 --grades <...>     # writes state/watch.json, spawns nothing
2. collect.mjs && report.mjs --format md --diff <prev>
3. post the rendered summary into the conversation
4. watch.mjs wait
     exit 0  → goto 2
     exit 10 → post "мониторинг остановлен", done
     exit 11/12 → post degraded/budget notice, done
```

`wait` sleeps to `nextDueAt` with ±90 s jitter, emitting a heartbeat to stderr every 60 s, and polls for the stop sentinel (`state/watch.stop`) so a stop lands within a minute. This is the only structure that satisfies "publish in the current Codex task": the agent, not a daemon, is the publisher.

**Guards, all configurable:** `maxHours` (12) and `maxRuns` (48); **4 consecutive all-source failures → stop with a degraded notice** rather than looping silently on nothing; user "stop" → `watch.mjs stop`.

**Reports 2..N are diff-aware.** Rendering a full identical ranking every 15 minutes trains the user to ignore it. Each subsequent summary leads with `появилось / пропало / очередь выросла / данные устарели` computed against the previous snapshot, then the current top-5.

### 3.10 Output format

```
⛽ АИ-95 / 95+ · 30.08.2026 15:40 (Волгоград)
Источники: Яндекс ✓62 · ГдеБЕНЗ ✓113 · 2ГИС ✗ (403/captcha, отключён)

Изменения за 15 мин: +Лукойл Землячки (95+ появился) · −Газпром Историческая (95 кончился)

СКОРЕЕ ЕСТЬ
1. Лукойл · ул. им. М. Фрунзе, 28 · 95+ есть, 95 нет
   очередь: небольшая · сигнал 6 мин назад · уверенность 0.86 · Яндекс+ГдеБЕНЗ согласны
2. …

ВОЗМОЖНО / ДАННЫЕ ПРОТИВОРЕЧИВЫ
3. Газпром · пр. Ленина, 100 · 95 — Яндекс «есть» (12 мин), ГдеБЕНЗ «нет» (~45 мин)
   уверенность 0.41 ⚠ конфликт источников

НЕТ СВЕЖИХ ДАННЫХ (>6 ч): 14 АЗС в зоне

Данные — отметки водителей, не телеметрия АЗС. Возраст сигнала указан у каждой строки.
```

Invariants the renderer enforces: **no availability claim without an age and a confidence**; failed sources are always named with their reason; buckets are capped at `--top` with an "и ещё K" count; the disclaimer is unconditional. `--format json` emits the full snapshot including `evidence[]`.

---

## 4. Key trade-offs

1. **Plain HTTP over agent-browser, as the default for two of three sources.** I verified today that Yandex and gdebenz both answer `curl`. A browser costs seconds-to-minutes per cycle, cannot be unit-tested against fixtures, and would make a 15-minute loop fragile. Browser is reserved for 2GIS and as an explicit `browserFallback:"auto"` escape hatch if Yandex starts challenging plain requests.
2. **gdebenz as the identity spine, not the "optional degraded source" the brief assumed.** Its `/api/stations` is JSON (no HTML parsing), carries **OSM ids** (stable across runs, unlike anything Yandex gives us for joining), and returned 113 stations vs Yandex's ~62. Yandex remains the *availability* authority (per-grade + queue + exact timestamps); gdebenz is the *registry* and a corroborating availability voter. Inverting the brief's assumed roles is the single highest-leverage decision here.
3. **2GIS demoted to `enabled:false`, `role:'registry'`.** It publishes no live fuel availability, so the only thing CAPTCHA-fighting buys is address/brand data OSM already provides. Building browser-session/CAPTCHA machinery for zero verdict impact is effort spent against the ToS for no user benefit. It stays wired (adapter exists, config flag flips it on) so the decision is reversible in one line.
4. **Transparent time-decayed weighted evidence over anything learned.** There is no ground truth and no labels, so a fitted model would be unfalsifiable. This model is unit-testable, tunable through `scoring.json` without touching code, and — critically — each number can be traced back to the evidence lines printed under it.
5. **Conservative non-merge on ambiguous identity.** Explicitly accepting duplicate rows to avoid false merges, for the reason in §3.7.
6. **Blocking `watch.mjs wait` over cron / a background daemon.** A daemon can't publish into the current task, which is the literal requirement. The cost is that the loop dies if the task dies — acceptable and honest, and `state/watch.json` lets a new task resume.
7. **Recursive shape-agnostic walk over a fixed JSON path for Yandex.** Marginally slower and marginally fuzzier, but it survives the most likely breakage (an upstream wrapper-key rename), which is the whole ballgame for an internal unversioned representation.
8. **Zero npm dependencies, stdlib only** (`fetch`, `node:test`). No cheerio (we parse one `<script>` block with a regex + `JSON.parse`), no turf (≈120 lines of geometry), no HTTP client. A skill that shells out to Node in a user's `~/.codex` should be auditable in one sitting and immune to supply-chain drift.

---

## 5. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Yandex `state-view` shape changes | High (unversioned internal) | Shape-agnostic recursive walk; `PARSE_SHAPE_CHANGED` canary (200 + big body + 0 businesses); debug body dump; fixtures pin current shape; gdebenz still answers |
| Yandex rate-limits or challenges us | Medium | ≤6 pages/cycle, 1 cycle/15 min, min-interval + jitter, circuit breaker, `browserFallback:"auto"` one-shot escape |
| gdebenz API changes or 502s (both observed) | Medium | Bit table + endpoints in config not code; retries + backoff; optional source — run continues on Yandex alone |
| **`fmask` bit order rotates silently** | Low but severe | Config-driven; startup **consistency check**: cross-validate decoded `fmask` against the `fuels_now` CSV on every run, and on mismatch emit a warning + drop gdebenz grade evidence to zero weight (keeping it as registry). Self-detecting. |
| 2GIS CAPTCHA | Certain | Disabled by default; `BLOCKED_CAPTCHA` returns immediately with no retry; zero verdict impact |
| **95 vs 95+ conflated** | High without care | Separate canonical grades; `crossGradeWeight 0.35`; gdebenz evidence alone can never reach the `likely` threshold for `AI95_PREMIUM`; both grades always rendered separately |
| Stale data read as current | High | Hard `staleAfterMinutes` zeroing, dedicated "нет свежих данных" bucket, age on every line, unconditional disclaimer |
| False station merges | Medium | ≥0.72 + mutual-best + 250 m hard cap + **brand conflict = hard reject**; persisted hand-editable identity map |
| Runaway 15-min loop | Medium | maxHours/maxRuns, consecutive-failure abort, stop sentinel checked every 60 s |
| Report churn (fake "changes") | Medium | Fully deterministic tie-breaks; diff computed on verdict/queue-level transitions, not on rank position |
| Timezone confusion | Medium | UTC ISO internally everywhere; render via `displayTimeZone` (Europe/Volgograd) |
| ToS / legal exposure | Ongoing | §below |

**Legal and operational posture** (a mandatory `## Ограничения и правовой статус` section in `SKILL.md`): all three sources are unofficial; Yandex's terms restrict automated extraction and `state-view` is an internal representation; gdebenz's `/api/*` is undocumented and may change or close without notice; 2GIS actively blocks automation. The design's posture is therefore: personal, low-volume, **read-only**, one poll per 15 minutes, no authentication, no accounts, **no CAPTCHA bypass ever**, `respectRobots` checked and logged (hard-block for 2GIS), honest configurable UA. gdebenz exposes POST endpoints for submitting driver reports — **there is no code path in this skill that issues a non-GET request to any source**, enforced by an `http.mjs` allowlist that rejects any method other than GET/HEAD. Per-source `enabled:false` is the kill switch, and any `BLOCKED_CAPTCHA` or 3 consecutive 4xx trips the breaker for the session and says so in the report.

---

## 6. Assumptions and open questions

**Assumptions I am committing to** (chosen conservatively, all cheap to reverse):

1. Node ≥ 20 with global `fetch` and `node:test` (verified v26.7.0 on this machine); **zero npm dependencies**.
2. Installed as `~/.codex/skills/fuel-watch/` with a flat `SKILL.md` + frontmatter, matching the convention of the existing skills on this machine.
3. Default area = Volgograd region bounds `[[44.2266, 48.4696], [44.8073, 48.9435]]` (taken from Yandex's own payload) until the user configures anchors — a deliberate superset.
4. Default watched grades: `AI95` + `AI95_PREMIUM`; other grades via `--grades`.
5. Interval 15 min per the requirement, configurable, ±90 s jitter.
6. Output in Russian, times in `Europe/Volgograd`; JSON keys in English.
7. `fresh_band` is ordinal with `3` = freshest (band 1 was absent from the live sample, 2 and 3 dominate) — encoded as a config table, **flagged as an assumption to calibrate**.
8. gdebenz `status:'yes'` with `fmask == 0` means "fuel reported, grades unspecified" → `UNCERTAIN` for all watched grades, not `IN_STOCK`. When `fmask > 0` it is authoritative, and grades absent from the mask score `OUT_OF_STOCK` at reduced weight.
9. State lives only under `state/`; snapshots pruned after 48 h.
10. No credentials, no writes to any source, no user data leaves the machine.

**Open questions — each with the default I will implement absent an answer:**

1. **Actual search area.** Default: Volgograd bbox. If you name the outermost acceptable stations, `resolve-anchors.mjs` converts them to a hull + 700 m buffer.
2. **`fresh_band` → minutes calibration.** Default 45/180/480 for bands 3/2/1. Correctable in one config line; can be calibrated empirically over a few monitoring sessions by comparing band transitions against Yandex's exact `lastSignalTimestamp` on co-located stations — a nice by-product of running the skill.
3. **Repeat reports: full ranking or changes-only?** Default: change-summary line + current top-5.
4. **Should price data influence ranking?** Default: shown (gdebenz gives it free), **not** ranked on — availability and queue are the stated criteria.
5. **Attempt 2GIS at all?** Default: no (`enabled:false`, registry role, zero weight).
6. **Notification channel.** Default: the task conversation only.
7. **How wide is "premium"?** Default: any Yandex `AI95_PREMIUM` plus branded 95 aliases (ЭКТО, G-Drive, Pulsar, Ultimate) in `fuel.json` — extend the alias list as brands appear.

**If approved, implementation order:** ① `geo.mjs` + config loaders + schemas → ② gdebenz adapter (JSON, easiest, gives the station registry) → ③ Yandex adapter + fixtures → ④ identity + scoring + queue (all pure, all unit-tested) → ⑤ `report.mjs` renderer → ⑥ `watch.mjs` state machine → ⑦ `resolve-anchors.mjs` → ⑧ 2GIS browser adapter (optional, last) → ⑨ `SKILL.md` + a `skill-validator` pass.