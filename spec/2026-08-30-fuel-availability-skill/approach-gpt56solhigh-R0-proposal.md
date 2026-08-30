## 1. High-level approach

Build the skill as a dependency-light Node.js package whose standalone collectors independently obtain and normalize observations from Yandex Maps, 2GIS, and gdebenz.ru. A deterministic aggregation pipeline will filter stations to the configured geometry, reconcile station identities, estimate availability from freshness-weighted evidence, normalize queues, and produce both human-readable and machine-readable summaries; monitoring will run inside the current durable Codex task rather than through cron or an external daemon.

No repository or external state was modified.

## 2. Recommended architecture

### Proposed skill layout

```text
fuel-availability/
├── SKILL.md
├── config/
│   ├── config.json
│   └── config.schema.json
├── scripts/
│   ├── fuel-monitor.mjs
│   ├── collect-once.mjs
│   ├── monitor.mjs
│   ├── adapters/
│   │   ├── yandex.mjs
│   │   ├── two-gis.mjs
│   │   └── gdebenz.mjs
│   ├── browser/
│   │   └── agent-browser-port.mjs
│   └── lib/
│       ├── config.mjs
│       ├── fuels.mjs
│       ├── geometry.mjs
│       ├── matching.mjs
│       ├── scoring.mjs
│       ├── queue.mjs
│       ├── cache.mjs
│       ├── pipeline.mjs
│       └── render.mjs
└── tests/
    ├── fixtures/
    ├── unit/
    ├── integration/
    └── live/
```

The collectors should use Node 20+ built-ins—primarily `fetch`, `AbortController`, `node:crypto`, and `node:test`. Avoiding Playwright, Puppeteer, and a permanent browser dependency keeps on-demand execution fast and makes partial-source operation straightforward.

### Data flow

```text
User request
    │
    ├─ resolve fuel query and configuration
    ├─ resolve rectangle or anchor-derived polygon
    ├─ divide bounding rectangle into source-sized tiles
    │
    ├─ Yandex HTTP ───────┐
    ├─ 2GIS HTTP/browser ─┼─ independently normalized observations
    └─ gdebenz HTTP ──────┘
                          │
                 exact geometry filter
                          │
                 station identity matching
                          │
                 per-product evidence fusion
                          │
             availability/confidence/queue ranking
                          │
                Snapshot JSON + rendered summary
```

### Component responsibilities

| Component | Responsibility |
|---|---|
| `SKILL.md` | Detect on-demand versus monitoring intent, invoke the CLI, publish summaries, manage the current task’s monitoring lifecycle, and stop cleanly. |
| `fuel-monitor.mjs` | Stable command-line entry point and exit-code contract. |
| `pipeline.mjs` | Executes one complete collection cycle and isolates adapter failures. |
| Source adapters | Fetch, validate, and translate one source’s representation into source-neutral records. No cross-source scoring or station matching. |
| `agent-browser-port.mjs` | Optional browser fallback boundary. Detects unavailable browser sessions and CAPTCHA without attempting circumvention. |
| `geometry.mjs` | Rectangle validation, anchor resolution, convex hull generation, tiling, and inclusive point-in-polygon filtering. |
| `fuels.mjs` | Fuel-family and branded-variant normalization using configuration-driven aliases. |
| `matching.mjs` | Deterministic station clustering and configured identity overrides. |
| `scoring.mjs` | Freshness weighting, evidence fusion, conflict detection, confidence classification, and candidate eligibility. |
| `queue.mjs` | Preserves raw queue values while deriving comparable ordinal scores where possible. |
| `cache.mjs` | Stores station crosswalks and last-good observations outside the skill directory. |
| `render.mjs` | Produces concise Markdown and stable JSON without changing the underlying assessment. |

## 3. Source adapter design

All adapters run concurrently under a cycle deadline. The pipeline uses `Promise.allSettled`; a failed source never discards successful observations from another source.

### Yandex Maps

Primary path:

1. Query server-rendered search pages for petrol stations over overlapping geometry tiles.
2. Extract JSON-bearing script elements.
3. Recursively inspect parsed objects for station coordinates and `fuelAvailability`.
4. Validate required structural sentinels before accepting observations.
5. Normalize:
   - `IN_STOCK`
   - `OUT_OF_STOCK`
   - `UNKNOWN`
   - `UNCERTAIN`
   - `lastSignalTimestamp`
   - `signalsCountPerHour`
   - queue fields including `localizedQueueSize`

Extraction must parse JSON structurally; it must not use a broad regular expression to manufacture records from arbitrary HTML text. If the known structure is present but no longer validates, return `SCHEMA_CHANGED` rather than treating this as “no fuel.”

Browser fallback is attempted only after HTTP transport or structural extraction fails. A legitimate empty search result does not trigger the browser.

Default capability declaration:

```js
{
  discovery: true,
  availability: true,
  queue: true,
  nativeObservationTime: true
}
```

### 2GIS

Use 2GIS primarily for station discovery, coordinates, addresses, brand information, and identity corroboration. Do not assume it provides fuel availability.

Transport order:

1. Direct HTTP/HTML extraction.
2. If the response is blocked or incomplete and browser fallback is enabled, use an existing `agent-browser` session.
3. Detect CAPTCHA or challenge pages.
4. Never solve, outsource, or bypass a CAPTCHA.
5. If the configured session still encounters a challenge, return `CHALLENGE` and continue without 2GIS.

Default capability declaration:

```js
{
  discovery: true,
  availability: false,
  queue: false,
  nativeObservationTime: false
}
```

If a future 2GIS representation exposes availability, it should remain disabled until fixtures and normalization tests are added explicitly.

### gdebenz.ru

Treat gdebenz.ru as an optional community/status source:

1. Use short-timeout direct HTTP extraction.
2. Retry one transient network error or `5xx`.
3. Preserve report timestamps and raw fuel labels.
4. Do not substitute fetch time for an actual report time without lowering timestamp quality.
5. Disable browser fallback by default because a server-side `502` is not improved by browser automation.

A `502`, timeout, schema failure, or empty response only degrades this adapter.

### Browser dependency boundary

The skill should declare `agent-browser` as an optional execution dependency. Before its first use in a task, `SKILL.md` instructs Codex to load the installed browser workflow with:

```text
agent-browser skills get core --full
```

The browser port must receive a URL, session name, extraction operation, timeout, and abort signal. Cookies and browser state remain in the browser’s session/vault; they are never copied into configuration, logs, cache, or emitted JSON.

## 4. Key interfaces and contracts

TypeScript-style definitions below describe contracts; implementation remains plain JavaScript with JSDoc.

### Source adapter

```ts
interface SourceAdapter {
  readonly id: "yandex" | "2gis" | "gdebenz";
  readonly capabilities: SourceCapabilities;

  discoverAnchors(
    request: AnchorDiscoveryRequest,
    context: CollectContext
  ): Promise<AnchorDiscoveryResult>;

  collect(
    request: CollectorRequest,
    context: CollectContext
  ): Promise<SourceResult>;
}
```

```ts
interface CollectorRequest {
  area: ResolvedArea;
  tiles: GeoRectangle[];
  requestedFuels: ResolvedFuelQuery[];
}

interface CollectContext {
  now: Date;
  signal: AbortSignal;
  http: HttpPort;
  browser?: BrowserPort;
  config: SourceConfig;
}

interface SourceResult {
  source: SourceId;
  stations: RawStation[];
  fuelObservations: FuelObservation[];
  queueObservations: QueueObservation[];
  health: SourceHealth;
}
```

Adapters should return a `SourceResult` for expected failures. The pipeline catches unexpected exceptions and converts them to `INTERNAL_ADAPTER_ERROR`. `AbortError` propagates when the user stops monitoring.

### Browser port

```ts
interface BrowserPort {
  extract(input: BrowserExtractionRequest): Promise<BrowserExtractionResult>;
}

interface BrowserExtractionRequest {
  source: SourceId;
  url: string;
  sessionName: string;
  timeoutMs: number;
  extractionProfile: string;
  signal: AbortSignal;
}
```

Expected errors:

- `BROWSER_UNAVAILABLE`
- `SESSION_UNAVAILABLE`
- `CHALLENGE`
- `NAVIGATION_TIMEOUT`
- `EXTRACTION_FAILED`
- `ABORTED`

### Normalized station model

```ts
interface GeoPoint {
  lat: number;
  lon: number;
}

interface RawStation {
  source: SourceId;
  sourceStationId: string;
  name: string;
  normalizedName: string;
  brand?: string;
  normalizedBrand?: string;
  address?: string;
  point: GeoPoint;
  sourceUrl?: string;
  fetchedAt: string;
}

interface CanonicalStation {
  stationKey: string;
  displayName: string;
  brand?: string;
  address?: string;
  point: GeoPoint;
  members: SourceStationRef[];
  matchConfidence: number;
}
```

Coordinates are WGS84. Boundary points count as inside the configured area.

### Fuel model

```ts
type FuelFamily =
  | "AI_80"
  | "AI_92"
  | "AI_95"
  | "AI_98"
  | "AI_100"
  | "DIESEL"
  | "LPG"
  | "OTHER";

interface FuelProduct {
  family: FuelFamily;
  variant: "BASE" | "BRANDED" | "PREMIUM" | "UNKNOWN";
  variantKey?: string;
  displayLabel: string;
}

interface ResolvedFuelQuery {
  queryId: string;
  families: FuelFamily[];
  includeVariants: boolean;
  exactVariantKeys?: string[];
}
```

The default query is `AI95_ANY`, resolving to `AI_95` with all base, premium, and branded variants.

Fuel normalization rules:

- Normalize Unicode, punctuation, casing, Cyrillic/Latin `AI` variants, and whitespace.
- Extract octane only from a fuel-shaped label, not every occurrence of `95`.
- Apply configured exclusions before inclusions.
- Preserve branded products as separate `variantKey` values.
- For an “any AI-95” query, score each product separately and use the best eligible product. Do not fuse an `OUT_OF_STOCK` signal for plain AI-95 with an `IN_STOCK` signal for a branded AI-95 product as if they were the same product.
- An unknown user-supplied grade uses exact normalized matching unless an alias is configured; it is never broadened silently.

### Availability observation

```ts
type AvailabilityStatus =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "UNCERTAIN"
  | "UNKNOWN";

interface FuelObservation {
  source: SourceId;
  sourceStationId: string;
  product: FuelProduct;
  status: AvailabilityStatus;
  observedAt?: string;
  fetchedAt: string;
  timestampQuality: "NATIVE" | "FETCH_TIME_ONLY";
  signalsPerHour?: number;
  rawStatus: string;
  provenanceUrl?: string;
}
```

### Queue model

```ts
interface QueueObservation {
  source: SourceId;
  sourceStationId: string;
  product?: FuelProduct;
  observedAt?: string;
  fetchedAt: string;
  kind: "VEHICLES" | "ORDINAL" | "TEXT";
  vehicleCount?: number;
  ordinal?: "NONE" | "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";
  rawValue: string;
}

interface NormalizedQueue {
  known: boolean;
  score?: number;       // 0 best, 1 worst
  vehicleCount?: number;
  display: string;
  freshness: FreshnessClass;
}
```

Default ordinal mapping:

| Queue value | Score |
|---|---:|
| None | 0.00 |
| Short | 0.25 |
| Medium | 0.50 |
| Long | 0.75 |
| Very long | 1.00 |

Vehicle counts use `min(count / 20, 1)`. Raw values are always retained. Text that cannot be mapped remains `known: false`; it must not be interpreted as a long queue.

### Pipeline

```ts
async function runOnce(input: RunOnceInput): Promise<Snapshot>;

interface RunOnceInput {
  configPath: string;
  requestedFuel?: string[];
  now?: Date;               // test-only override
  signal?: AbortSignal;
}

interface Snapshot {
  schemaVersion: 1;
  runId: string;
  generatedAt: string;
  timezone: string;
  area: ResolvedAreaSummary;
  requestedFuels: ResolvedFuelQuery[];
  rankedStations: StationAssessment[];
  uncertainStations: StationAssessment[];
  sourceHealth: SourceHealth[];
  warnings: Warning[];
}
```

CLI contract:

```text
node scripts/fuel-monitor.mjs once \
  [--fuel <alias-or-label>]... \
  [--config <path>] \
  [--json]

node scripts/fuel-monitor.mjs monitor \
  [--fuel <alias-or-label>]... \
  [--config <path>] \
  [--interval-minutes 15] \
  --ndjson
```

Exit codes:

| Code | Meaning |
|---:|---|
| `0` | Cycle completed with at least one successful source |
| `2` | Invalid configuration or fuel request |
| `3` | All sources unavailable; an empty health-bearing snapshot is still emitted |
| `4` | Internal pipeline failure |
| `130` | User cancellation |

Monitoring emits one complete `Snapshot` per NDJSON line. Diagnostics go to stderr and never contaminate stdout.

## 5. Configuration schema

`config/config.json` is the active configuration. `config/config.schema.json` documents the contract and is also enforced by a narrow runtime validator.

Top-level shape:

```ts
interface Config {
  schemaVersion: 1;
  timezone: "Europe/Moscow";
  defaults: {
    fuelQueries: string[];            // ["AI95_ANY"]
    monitorIntervalMinutes: number;   // 15
    topN: number;                     // 10
  };
  area: RectangleAreaConfig | AnchorAreaConfig | PolygonAreaConfig;
  fuelAliases: Record<string, FuelAliasConfig>;
  freshness: {
    availability: FreshnessThresholds;
    queue: FreshnessThresholds;
  };
  matching: MatchingConfig;
  scoring: ScoringConfig;
  sources: Record<SourceId, SourceConfig>;
  collection: CollectionConfig;
  cache: CacheConfig;
}
```

Area alternatives:

```ts
interface RectangleAreaConfig {
  kind: "rectangle";
  south: number;
  west: number;
  north: number;
  east: number;
}

interface AnchorAreaConfig {
  kind: "station-anchors";
  boundary: "convex-hull";
  anchors: Array<{
    label: string;
    source?: SourceId;
    sourceStationId?: string;
    name?: string;
    address?: string;
    point?: GeoPoint;
  }>;
  bufferMeters: number;       // default 0
  unresolvedPolicy: "fail-closed";
}

interface PolygonAreaConfig {
  kind: "polygon";
  coordinates: Array<[number, number]>; // [lon, lat]
}
```

Anchor behavior:

- Require at least three unique, non-collinear resolved points.
- Prefer configured coordinates, then source ID, then exact normalized name/address matching.
- If a name resolves to multiple plausible stations, return `AREA_AMBIGUOUS`.
- Do not silently select the nearest candidate or expand to all Volgograd.
- Compute the convex hull; anchor stations and boundary points are included.
- Query the hull’s bounding rectangle, then apply the exact polygon filter locally.

Suggested defaults:

```text
Availability: fresh 20 min, aging to 90 min, expires at 240 min
Queue:        fresh 10 min, aging to 30 min, expires at 60 min
HTTP timeout: 10 s/source request
Browser timeout: 35 s
Cycle deadline: 120 s
HTTP retries: 1 for network, 429, or 5xx only
Tile span: 5 km with 10% overlap
Circuit breaker: 3 consecutive failures, 45-minute cooldown
```

Source settings include:

```ts
interface SourceConfig {
  enabled: boolean;
  transport: "auto" | "http" | "browser";
  availabilityReliability: number;
  discoveryReliability: number;
  correlationGroup: string;
  timeoutMs: number;
  retries: number;
  browserFallback: boolean;
  browserSessionName?: string;
  rateLimitMs: number;
}
```

Default availability reliabilities are `0.85` for Yandex, `0.65` for gdebenz, and no availability weight for 2GIS. These are conservative initial heuristics, not empirically calibrated claims.

Configuration contains no passwords, cookies, tokens, or browser profiles. It may contain environment-variable names but not their secret values.

## 6. Geometry and station identity

### Search coverage

The pipeline queries a source over overlapping rectangular tiles covering the area’s bounding box. It deduplicates paginated and overlapping results before exact point-in-polygon filtering. This avoids relying on a maps service returning every city station from a single viewport.

### Matching sequence

1. Exact configured cross-source override.
2. Exact source-native ID within the same source.
3. Candidate generation by geographic distance.
4. Weighted comparison:
   - coordinate proximity: 50%
   - normalized brand: 20%
   - normalized address: 20%
   - normalized station name: 10%
5. Merge at score `>= 0.78`.
6. Scores from `0.62` to `0.78` remain separate and produce a possible-duplicate warning.
7. Use complete-link clustering: every member must meet the merge threshold with the cluster, preventing transitive A–B–C over-merges.

Coordinate similarity reaches full value within 25 m and falls to zero at 180 m. A conflicting brand prevents an automatic merge unless an explicit override exists.

The monitoring process retains a runtime station registry so station keys remain stable across ticks. Runtime state belongs under a configurable temporary/state directory, not under the scripts or configuration directory.

## 7. Availability, freshness, confidence, and ranking

### Evidence weighting

Status likelihoods:

```text
IN_STOCK     0.95
OUT_OF_STOCK 0.05
UNCERTAIN    0.60
UNKNOWN      0.50
```

Freshness factor:

- At or before `fresh`: `1.0`
- Between `fresh` and `stale`: linear decline from `1.0` to `0.35`
- Between `stale` and `expire`: linear decline from `0.35` to `0`
- After `expire`: `0`

Additional factors:

```text
timestamp quality:
  native source timestamp = 1.00
  fetch time only         = 0.55

signal factor:
  absent count = 0.75
  otherwise clamp(0.60 + 0.15 × ln(1 + count), 0.60, 1.00)
```

For observation `i`:

```text
weightᵢ =
  sourceReliability
  × freshnessFactor
  × timestampQuality
  × signalFactor

contributionᵢ =
  clamp(logit(statusLikelihoodᵢ) × weightᵢ, -2.2, 2.2)
```

Only the strongest relevant contribution in each configured `correlationGroup` is retained, preventing two views of the same underlying feed from being treated as independent confirmation.

For a concrete fuel product:

```text
estimatedAvailability = sigmoid(sum(group contributions))
```

For `AI95_ANY`, calculate each matching base or branded product separately and select the highest eligible product. Display which actual product produced the station’s rank.

### Candidate eligibility

A station appears in “currently available” only when:

- `estimatedAvailability >= 0.60`;
- at least one matching positive observation has not expired; and
- the station lies inside the resolved area.

Expired last-known observations may appear only in a clearly labeled historical section.

### Confidence

Confidence is separate from availability probability:

```text
coverage = 1 - product(1 - effectiveGroupWeight)
conflict = min(positiveWeight, negativeWeight)
           / max(positiveWeight + negativeWeight, epsilon)

confidenceScore = coverage × (1 - conflict)
```

A single independent correlation group caps confidence at `0.74`.

Labels:

```text
HIGH    >= 0.75
MEDIUM  >= 0.45
LOW     <  0.45
```

Thus one fresh Yandex signal can produce a high availability estimate while still being reported as medium confidence because it lacks independent corroboration. This is more meaningful than equating “present in one payload” with certainty.

### Ranking

Availability remains dominant, while queue data breaks operationally insignificant probability differences:

1. Descending five-percentage-point availability band.
2. If both stations have fresh known queues, ascending queue score.
3. Descending exact estimated availability.
4. Newer decisive evidence.
5. Stable station name.

Unknown queue is not assumed better or worse than a known queue. Queue never changes the availability probability.

## 8. On-demand and monitoring lifecycle

### On-demand mode

The skill runs one cycle, renders the snapshot, and terminates. A source failure is shown in the health footer but does not suppress results from healthy sources.

### Monitoring mode

Monitoring stays in the same Codex task:

1. Start a durable goal whose stopping condition is an explicit user request to stop.
2. Launch one foreground child process running `monitor --ndjson`.
3. Emit the first snapshot immediately.
4. Schedule subsequent cycles against monotonic target times: `startedAt + n × 15 minutes`, avoiding cumulative drift.
5. Codex consumes each NDJSON snapshot and publishes it as a commentary update.
6. Between ticks, use bounded waits of at most 60 seconds so user steering and cancellation remain responsive.
7. On an explicit stop request:
   - send `SIGINT`;
   - allow five seconds for cleanup;
   - use `SIGTERM` if necessary;
   - publish a final “monitoring stopped” message;
   - complete the durable goal.
8. On host shutdown or task cancellation, the child process receives cleanup signals and no detached daemon remains.

This uses Codex’s documented durable-goal mechanism for long-running work rather than an independent scheduled task; `/goal` is specifically intended for work continuing across turns toward a stopping condition. [Official OpenAI documentation](https://learn.chatgpt.com/use-cases/follow-goals)

The monitoring loop is owned by the current task. Closing or suspending the host can delay or end delivery; the design does not claim offline monitoring. External scheduling, notifications, and system services are intentionally out of scope.

Configuration is revalidated before every tick. If it becomes invalid, collection fails closed and publishes a configuration-error summary; it does not continue silently with an old area.

## 9. Output format

Example structure:

```markdown
Fuel availability — AI-95 and premium variants
Area: <configured area>
Checked: 30 Aug 2026, 16:45 MSK

1. <station name and address>
   Fuel: G-Drive 95
   Estimated availability: 89% — medium confidence
   Freshness: fresh, last signal 6 min ago
   Queue: short
   Evidence: Yandex IN_STOCK; 7 signals/hour
   Map: <source link>

2. ...

Changes since 16:30:
- Newly available: ...
- No longer supported by fresh evidence: ...
- Queue improved: ...

Source health:
- Yandex: OK, 18 stations, 16:45
- 2GIS: unavailable — CAPTCHA; results continue without it
- gdebenz: degraded — HTTP 502; retry at 17:30
```

Every monitoring update is a complete summary, followed by changes since the previous tick. If no station qualifies:

> No station currently has a sufficiently fresh positive signal for the requested fuel.

It must not say “fuel is unavailable everywhere” unless current, sufficiently reliable negative evidence actually supports that conclusion. The report should then show up to three uncertain candidates and all source-health information.

JSON output contains raw evidence provenance, assessment factors, warnings, and source health for debugging and downstream use.

## 10. Failure and fallback behavior

| Failure | Behavior |
|---|---|
| One source times out or returns `5xx` | Retry once within deadline, then continue with other sources. |
| `429` | Honor `Retry-After` only if it fits the cycle deadline; otherwise defer. |
| CAPTCHA | Never bypass; optionally retry through a configured browser session, then mark unavailable. |
| Parser schema drift | Return `SCHEMA_CHANGED`; do not interpret absence as an empty result. |
| Ambiguous area anchor | Fail closed with `AREA_AMBIGUOUS`; do not search a larger area. |
| No availability-capable source succeeds | Emit exit code 3 and a health-bearing empty snapshot. |
| All fresh data disappears | Show expired last-known observations separately, never as current availability. |
| Collector exceeds cycle deadline | Abort it and publish the other completed source results. |
| Repeated failure | Open the adapter circuit after three failures; retry after 45 minutes. |
| Browser not installed/session unavailable | Record degradation and continue through direct collectors. |
| User stops during collection | Abort all fetches/browser work and terminate cleanly. |

The last-good cache is useful for explaining changes and source outages, but cached evidence older than its expiration threshold cannot qualify a station as currently available.

## 11. Testing strategy

### Unit tests

- Fuel aliases, Cyrillic/Latin normalization, branded variants, and exclusions.
- Freshness boundary values with a fake clock.
- Scoring for positive, negative, conflicting, stale, and correlated evidence.
- Queue label and vehicle-count normalization.
- Haversine distances and point-on-boundary behavior.
- Rectangle, convex hull, invalid polygon, collinear anchors.
- Station matching, brand conflicts, complete-link behavior, and explicit overrides.
- Stable deterministic ranking.

### Parser contract tests

Maintain sanitized source fixtures for:

- known Yandex server HTML with every availability status;
- missing and malformed `fuelAvailability`;
- queue field variants;
- 2GIS normal search and CAPTCHA responses;
- gdebenz normal, empty, changed, and error representations.

Tests must assert that schema drift produces `SCHEMA_CHANGED`, not an empty successful result.

### Integration tests

- Local fixture HTTP server with timeouts, `429`, `502`, and delayed responses.
- Partial-source success using `Promise.allSettled`.
- Tile overlap and pagination deduplication.
- Browser port mocked as success, challenge, timeout, and unavailable.
- Last-good cache expiration and station-key continuity.

### Monitoring tests

Use fake timers and a mocked pipeline to verify:

- immediate first summary;
- 15-minute target cadence without drift;
- a slow cycle does not create concurrent cycles;
- stop during wait and stop during collection;
- configuration reload behavior;
- source circuit opening and recovery;
- complete NDJSON lines under cancellation.

### Output tests

Golden Markdown and JSON snapshots should verify:

- full source provenance;
- meaningful no-results wording;
- confidence/freshness labels;
- change summaries;
- source-health visibility.

### Live canaries

Live tests are manual and opt-in. They validate transport and schema presence, never assert that a particular station has fuel. They use strict rate limits and do not run in normal CI.

## 12. Trade-offs and alternatives

### Chosen: HTTP-first modular collectors with deterministic local fusion

This minimizes browser fragility, isolates source failures, makes the result reproducible, and allows every parser and score to be fixture-tested. Browser automation remains available precisely where direct extraction fails.

### Rejected: browser-first collection

A browser-first implementation would initially be simpler for dynamic maps, but it is slower, more resource-intensive, harder to test, and especially vulnerable to 2GIS CAPTCHA behavior and session expiry.

### Rejected: single-source Yandex implementation

Yandex currently appears to provide the richest availability evidence, but a single-source design cannot corroborate station identity, cannot survive schema drift, and would overstate confidence.

### Deferred: external daemon or scheduled notification service

A separate daemon would survive task closure and could send push notifications, but it violates the requirement to monitor in the current Codex task and adds deployment, credential, and cleanup concerns.

## 13. Pre-mortem risks and mitigation

| Likely failure | Mitigation |
|---|---|
| Yandex changes its internal server representation | Versioned parser fixtures, structural validation, browser fallback, explicit `SCHEMA_CHANGED`, and no fabricated empty result. |
| 2GIS remains permanently challenged | Treat it as optional discovery enrichment; never require it for a useful Yandex/gdebenz result. |
| gdebenz remains unavailable | Low reliability weight, circuit breaker, and no dependency on it for baseline operation. |
| Different sources merge adjacent stations incorrectly | Conservative thresholds, brand conflicts, complete-link clustering, and manual cross-source overrides. |
| Branded AI-95 is conflated with plain AI-95 | Score concrete products independently and aggregate only at query level. |
| Fresh positive data is contradicted by stale negative data | Explicit age decay; expired observations contribute zero. |
| “89%” is mistaken for measured certainty | Label it “estimated availability,” report separate confidence, age, sources, and conflicts. |
| Queue wording changes | Preserve raw text; unknown labels remain unknown instead of receiving a guessed score. |
| Monitoring silently stops after the task closes | State clearly that monitoring is task-bound; no detached process or offline-delivery claim. |
| Repeated polling causes blocking or source complaints | Fifteen-minute cadence, tile/page limits, request throttling, one retry, and circuit breakers. |
| Browser fallback leaks session state | Browser vault/session isolation; no cookie serialization or secret-bearing debug dumps. |

## 14. Legal and operational constraints

The three integrations rely on public web representations rather than documented availability APIs. Before release, the implementer must review each service’s current terms, robots policy, and applicable data-use restrictions.

The skill must:

- identify itself conservatively and minimize request volume;
- avoid CAPTCHA circumvention, credential harvesting, and private endpoints requiring unauthorized access;
- use only a user-authorized browser session;
- avoid long-term redistribution of extracted datasets;
- retain provenance and retrieval timestamps;
- keep raw page capture disabled by default;
- redact URLs or logs that contain session identifiers;
- clearly state that fuel and queue data may change before arrival;
- avoid presenting the result as safety-critical or guaranteed.

Any terms-of-service incompatibility should disable that adapter without affecting the remaining sources.

## 15. Assumptions and open questions

These are resolved conservatively for implementation; none blocks the design:

- No search area was supplied. The active configuration must therefore fail validation until the user sets a rectangle, polygon, or at least three unambiguous boundary stations. The skill will not ship with an invented Volgograd-wide boundary.
- 2GIS is treated as a discovery and identity source, not an availability source.
- The Yandex fields observed on 2026-08-30 are considered an internal, unversioned representation.
- Availability percentages are heuristic estimates suitable for ranking, not calibrated real-world probabilities. Future historical verification can tune source reliabilities without changing the interfaces.
- A queue without an explicit unit is ordinal. The implementation does not convert wording into an invented vehicle count.
- Monitoring is guaranteed only while the current durable Codex task and host are running.
- The default request is `AI95_ANY`; explicit user requests override it for that invocation without rewriting persistent configuration.
- Only an explicit request to stop ends monitoring. Temporary source failure, no qualifying station, or an unrelated user message does not.
- Runtime cache and process state live outside the skill folder; only user-editable configuration and its schema live next to the scripts.

The `brain-council` design process shaped the explicit alternatives, pre-mortem, and decision boundaries above. Implementation remains gated on user approval.