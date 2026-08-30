# Fuel Availability Monitoring Skill — Revised Design

## 1. High-level approach

Build a dependency-light Node.js skill with direct HTTP collectors for Yandex Maps, gdebenz, and 2GIS. Yandex and gdebenz supply current availability evidence, while 2GIS supplies station identity and advertised fuel catalogue data; a deterministic pipeline filters the configured area, reconciles stations, assesses freshness and confidence, normalizes queues, and ranks results.

Monitoring remains attached to the current durable Codex task, publishing an immediate report and then a complete update every 15 minutes until explicitly stopped.

## 2. Architecture

### Proposed layout

```text
fuel-availability/
├── SKILL.md
├── config/
│   ├── config.json
│   └── config.schema.json
├── scripts/
│   ├── fuel-monitor.mjs
│   ├── adapters/
│   │   ├── yandex.mjs
│   │   ├── gdebenz.mjs
│   │   └── two-gis.mjs
│   └── lib/
│       ├── config.mjs
│       ├── pagination.mjs
│       ├── fuels.mjs
│       ├── geometry.mjs
│       ├── matching.mjs
│       ├── scoring.mjs
│       ├── queue.mjs
│       ├── cache.mjs
│       ├── pipeline.mjs
│       ├── monitor-loop.mjs
│       └── render.mjs
└── tests/
    ├── fixtures/
    ├── unit/
    ├── integration/
    └── live/
```

Use Node 20+ built-ins: `fetch`, `AbortController`, `node:crypto`, `node:test`, and filesystem primitives. No browser runtime, Playwright, Puppeteer, or third-party HTTP dependency is required for the presently verified source behavior.

### Data flow

```text
User request
    │
    ├─ load and validate configuration
    ├─ resolve requested fuel aliases
    ├─ resolve rectangle, polygon, or station-anchor boundary
    │
    ├─ Yandex city/bbox search + advertised pagination ── availability + queue
    ├─ gdebenz bbox JSON endpoints ───────────────────── availability + queue presence
    └─ 2GIS search pagination/cache ──────────────────── identity + fuel catalogue
                             │
                    normalize source records
                             │
                    exact geometry filtering
                             │
                    station identity matching
                             │
                    per-product evidence fusion
                             │
              availability/confidence/queue ranking
                             │
                 JSON snapshot + Markdown report
```

### Components

| Component | Responsibility |
|---|---|
| `SKILL.md` | Detect on-demand or monitoring mode, invoke the CLI, publish reports, and manage cancellation in the current task. |
| `fuel-monitor.mjs` | Stable CLI entry point, argument parsing, stdout/stderr discipline, and exit codes. |
| `pipeline.mjs` | Run one collection cycle, isolate source failures, enforce deadlines, and assemble a snapshot. |
| `pagination.mjs` | Follow source-advertised pages under explicit page, concurrency, and deadline limits. |
| Source adapters | Fetch and normalize one source without performing cross-source matching or scoring. |
| `geometry.mjs` | Validate geometry, resolve station anchors, calculate convex hulls, and filter points. |
| `fuels.mjs` | Normalize grades and branded variants using configured aliases. |
| `matching.mjs` | Deterministically reconcile source records into canonical stations. |
| `scoring.mjs` | Calculate availability estimate, freshness, conflict, coverage, and confidence. |
| `queue.mjs` | Normalize numeric and ordinal queues without inventing missing queue sizes. |
| `cache.mjs` | Cache catalogue records and stable station crosswalks outside the skill directory. |
| `monitor-loop.mjs` | Run immediate and periodic collection without overlapping cycles or schedule drift. |
| `render.mjs` | Render stable JSON and concise user-facing Markdown. |

## 3. Source adapters

### 3.1 Yandex Maps

Yandex is the primary availability and queue source. Yandex officially documents that station cards can show fuel status, queue, restrictions, and last-update time, and that this information is available in Volgograd. It also warns that the status may be delayed and does not guarantee availability upon arrival. [Yandex fuel availability documentation](https://yandex.ru/support/m-maps/ru/refuel), [Yandex availability rollout](https://yandex.ru/company/news/17-07-2026-01)

#### Collection strategy

1. Request the server-rendered Yandex Maps search page for petrol stations in Volgograd, constrained by a bounding rectangle when the current request form supports it.
2. Parse the first response and determine its advertised pagination.
3. Fetch pages `2..lastPage`, capped by configuration.
4. Use limited parallelism rather than geographic tile fan-out.
5. Extract JSON-bearing script elements.
6. Parse JSON structurally and recursively identify station features.
7. Validate coordinates, station identifiers, and availability objects.
8. Normalize:
   - `IN_STOCK`
   - `OUT_OF_STOCK`
   - `UNKNOWN`
   - `UNCERTAIN`
   - `lastSignalTimestamp`
   - `signalsCountPerHour`
   - `localizedQueueSize` and related queue fields
9. Apply the exact local geometry after all pages have been collected.

The adapter must not use a broad regular expression to synthesize records from arbitrary HTML. If known availability markers exist but no longer validate, return `SCHEMA_CHANGED`, not an empty result.

#### Pagination limits

Default settings:

```text
maximum pages:       20
page concurrency:    4
request timeout:      8 seconds
retry count:          1 for transient errors only
adapter deadline:    80 seconds
```

The bounded worst case is two waves of five eight-second page batches when all 20 pages require a retry, fitting within the cycle deadline. The first page determines the actual page count; the adapter does not request unused pages.

If Yandex advertises more than 20 pages, the adapter returns the collected records with health `TRUNCATED`. The output explicitly says coverage may be incomplete.

No geographic tiling is used. Direct server responses already support full pagination, and tile fan-out would multiply requests without improving the logical result.

#### Capabilities

```js
{
  discovery: true,
  advertisedProducts: true,
  currentAvailability: true,
  queueSize: true,
  exactObservationTime: true
}
```

### 3.2 gdebenz

gdebenz is a first-class availability source backed by direct JSON endpoints, not an HTML scraper. A read-only probe confirmed that the public station endpoint returns an array of station records containing coordinates, status, `fuels_now`, conflict information, and price metadata.

#### Endpoints

For bounding rectangle `south, west, north, east`:

```text
GET https://gdebenz.ru/api/stations
    ?lat1=<south>
    &lon1=<west>
    &lat2=<north>
    &lon2=<east>

GET https://gdebenz.ru/api/comments
    ?lat1=<south>
    &lon1=<west>
    &lat2=<north>
    &lon2=<east>
```

The adapter requests both concurrently and joins them by `osm_id`.

Observed station fields:

```ts
interface GdebenzStation {
  osm_id: string;
  name: string;
  brand: string;
  lat: number;
  lon: number;
  addr: string;
  status: "yes" | "queue" | "low" | "no" | null;
  fuels_now: string;
  dt_only: 0 | 1;
  conflict: string | null;
  prices_now?: Record<string, {
    p: number;
    n: number;
    t: string;
  }>;
}
```

Observed freshness fields from `/api/comments`:

```ts
interface GdebenzFreshnessRecord {
  osm_id: string;
  lat: number;
  lon: number;
  status: string | null;
  fmask: number;
  fresh_band: 0 | 1 | 2 | 3;
  conflict: string | null;
}
```

`fmask` is preserved in raw provenance but is not interpreted in version 1 until its bit allocation is verified. Fuel matching uses the explicit `fuels_now` list.

#### Status semantics

| gdebenz value | Normalized meaning |
|---|---|
| `yes` | Positive availability report |
| `queue` | Positive availability report; queue exists, size unknown |
| `low` | Limited or uncertain availability |
| `no` | No fuel reported |
| `null` | No current availability evidence |

For a specific grade:

- `yes` or `queue` is positive only if `fuels_now` explicitly contains the requested grade.
- `low` plus an explicit matching grade maps to `LIMITED`.
- A positive station status with empty `fuels_now` is general evidence only and cannot qualify a station for AI-95.
- If `fuels_now` lists other grades but not the requested grade, the requested grade remains `UNKNOWN`; absence is not converted to `OUT_OF_STOCK`.
- `status: "no"` is negative evidence for all fuel grades.
- `dt_only: 1` permits positive evidence only for diesel.
- A non-null `conflict` lowers evidence weight and confidence.

This matches gdebenz’s own grade-filter behavior and avoids inferring AI-95 availability from a general green station status.

#### Freshness bands

The API supplies freshness buckets rather than exact observation timestamps:

| `fresh_band` | Source meaning | Conservative maximum age |
|---:|---|---:|
| `3` | Less than one hour | 60 minutes |
| `2` | Reports within three hours | 180 minutes |
| `1` | Reports today | 720 minutes |
| `0` or absent | No usable freshness | Unknown |

Scoring uses the maximum possible age of the bucket. This intentionally understates freshness rather than assuming the observation occurred at the start of the bucket.

#### Capabilities

```js
{
  discovery: true,
  advertisedProducts: false,
  currentAvailability: true,
  queuePresence: true,
  queueSize: false,
  exactObservationTime: false,
  boundedObservationAge: true
}
```

### 3.3 2GIS

2GIS is a catalogue and station-identity source only. Its search results expose station names, addresses, coordinates, branches, and advertised fuel products such as AI-95 and 95+, but not current fuel availability. [2GIS Volgograd station search](https://2gis.ru/volgograd/search/%D0%90%D0%B7%D1%81%20%D0%B1%D0%B5%D0%BD%D0%B7%D0%B8%D0%BD)

#### Collection strategy

1. Use direct HTTP search pages and their pagination.
2. Extract station ID, name, brand, address, coordinates, branch information, source URL, and advertised products.
3. Cache the catalogue for 24 hours.
4. Refresh once at monitoring startup if absent or expired, then at most every six hours.
5. Never treat advertised fuel products as evidence that the product is currently in stock.
6. If the response is a CAPTCHA, return `CHALLENGE` and continue without 2GIS.

There is no production browser fallback. Since 2GIS contributes no live availability or queue evidence, maintaining a browser session merely to defeat an unavailable catalogue path would add substantial fragility without improving the primary result.

`agent-browser` remains appropriate only as a development diagnostic tool if maintainers need to inspect a changed page manually. It is not an execution dependency, and CAPTCHA solving or bypass remains prohibited.

#### Capabilities

```js
{
  discovery: true,
  advertisedProducts: true,
  currentAvailability: false,
  queuePresence: false,
  queueSize: false,
  exactObservationTime: false
}
```

## 4. Interfaces and data models

### Source adapter

```ts
type SourceId = "yandex" | "gdebenz" | "2gis";

interface SourceAdapter {
  readonly id: SourceId;
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
  boundingBox: GeoRectangle;
  requestedFuels: ResolvedFuelQuery[];
  purpose: "ON_DEMAND" | "MONITOR_TICK" | "CATALOG_REFRESH";
}

interface CollectContext {
  now: Date;
  signal: AbortSignal;
  http: HttpPort;
  config: SourceConfig;
  cache: CachePort;
}
```

```ts
interface SourceResult {
  source: SourceId;
  stations: RawStation[];
  availability: FuelObservation[];
  queues: QueueObservation[];
  health: SourceHealth;
}
```

Expected adapter failures are represented in `SourceHealth`; adapters do not reject for routine HTTP, challenge, or parser failures. The pipeline catches unexpected exceptions and converts them to `INTERNAL_ADAPTER_ERROR`. Cancellation propagates as `AbortError`.

### HTTP and pagination ports

```ts
interface HttpPort {
  fetch(
    url: URL,
    options: {
      timeoutMs: number;
      signal: AbortSignal;
      headers?: Record<string, string>;
    }
  ): Promise<Response>;
}
```

```ts
interface PaginationPlan {
  firstPage: number;
  lastAdvertisedPage: number;
  maximumPages: number;
  concurrency: number;
}

async function collectAdvertisedPages<T>(
  plan: PaginationPlan,
  fetchPage: (page: number, signal: AbortSignal) => Promise<T>,
  signal: AbortSignal
): Promise<PaginatedResult<T>>;
```

Errors:

- `NETWORK`
- `TIMEOUT`
- `HTTP_STATUS`
- `RATE_LIMITED`
- `CHALLENGE`
- `SCHEMA_CHANGED`
- `TRUNCATED`
- `ABORTED`
- `INTERNAL_ADAPTER_ERROR`

### Station model

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
  advertisedProducts?: FuelProduct[];
  fetchedAt: string;
}

interface CanonicalStation {
  stationKey: string;
  displayName: string;
  brand?: string;
  address?: string;
  point: GeoPoint;
  members: SourceStationRef[];
  advertisedProducts: FuelProduct[];
  matchConfidence: number;
}
```

`advertisedProducts` means the station normally sells those grades. It is never included in current-availability probability.

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

The default query is:

```js
{
  queryId: "AI95_ANY",
  families: ["AI_95"],
  includeVariants: true
}
```

Normalization rules:

- Normalize Unicode, punctuation, whitespace, casing, and Cyrillic/Latin `AI`.
- Recognize octane only in a fuel-shaped label.
- Apply exclusions before inclusions.
- Preserve branded products as separate `variantKey` values.
- Score plain and branded AI-95 independently.
- For `AI95_ANY`, select the highest eligible matching product at the station and display the actual product.
- An unknown requested grade is exact-match only unless configuration defines an alias.

### Availability observation

```ts
type AvailabilityStatus =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "LIMITED"
  | "UNCERTAIN"
  | "UNKNOWN";

type ObservationTime =
  | {
      kind: "EXACT";
      observedAt: string;
    }
  | {
      kind: "BOUNDED_AGE";
      minimumAgeMinutes: number;
      maximumAgeMinutes: number;
    }
  | {
      kind: "FETCH_TIME_ONLY";
      fetchedAt: string;
    };

interface FuelObservation {
  source: SourceId;
  sourceStationId: string;
  product: FuelProduct;
  status: AvailabilityStatus;
  time: ObservationTime;
  signalsPerHour?: number;
  sourceConflict?: boolean;
  rawStatus: string;
  fetchedAt: string;
  provenanceUrl?: string;
}
```

### Queue model

```ts
interface QueueObservation {
  source: SourceId;
  sourceStationId: string;
  product?: FuelProduct;
  time: ObservationTime;
  kind: "VEHICLES" | "ORDINAL" | "PRESENCE" | "TEXT";
  vehicleCount?: number;
  ordinal?: "NONE" | "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";
  rawValue: string;
}

interface NormalizedQueue {
  present?: boolean;
  comparable: boolean;
  score?: number;
  vehicleCount?: number;
  display: string;
  freshness: FreshnessClass;
}
```

`PRESENCE` supports gdebenz’s `queue` status. It renders as “queue reported; size unknown” but does not participate in shortest-queue ordering.

Default queue scores:

| Queue | Score |
|---|---:|
| None | 0.00 |
| Short | 0.25 |
| Medium | 0.50 |
| Long | 0.75 |
| Very long | 1.00 |

For vehicle counts:

```text
score = min(vehicleCount / 20, 1)
```

Unrecognized text remains non-comparable.

### Pipeline

```ts
async function runOnce(input: RunOnceInput): Promise<Snapshot>;

interface RunOnceInput {
  configPath: string;
  requestedFuel?: string[];
  mode: "ON_DEMAND" | "MONITOR_TICK";
  now?: Date;
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
  coverage: CoverageAssessment;
  warnings: Warning[];
}
```

```ts
interface SourceHealth {
  source: SourceId;
  role: "AVAILABILITY" | "CATALOG" | "BOTH";
  status:
    | "OK"
    | "DEGRADED"
    | "UNAVAILABLE"
    | "CHALLENGE"
    | "SCHEMA_CHANGED"
    | "TRUNCATED"
    | "CIRCUIT_OPEN";
  fetchedAt: string;
  recordsAccepted: number;
  pagesFetched?: number;
  pagesAdvertised?: number;
  cacheAgeMinutes?: number;
  errorCode?: string;
  detail?: string;
}
```

## 5. CLI contract

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

Monitoring stdout contains exactly one complete `Snapshot` JSON object per line. Logs and diagnostics go to stderr.

Exit codes:

| Code | Meaning |
|---:|---|
| `0` | At least one availability source completed |
| `2` | Invalid configuration, geometry, or fuel request |
| `3` | No availability source completed; an empty health-bearing snapshot was emitted |
| `4` | Pipeline-level internal failure |
| `130` | User cancellation |

A failed catalogue-only 2GIS request does not cause exit code 3 when Yandex or gdebenz succeeds.

## 6. Configuration

`config/config.json` is the active configuration next to the scripts. `config/config.schema.json` defines the complete contract.

```ts
interface Config {
  schemaVersion: 1;
  timezone: "Europe/Moscow";

  defaults: {
    fuelQueries: string[];          // ["AI95_ANY"]
    monitorIntervalMinutes: number; // 15
    topN: number;                   // 10
  };

  area:
    | RectangleAreaConfig
    | AnchorAreaConfig
    | PolygonAreaConfig;

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

### Geometry configurations

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
  bufferMeters: number;
  unresolvedPolicy: "fail-closed";
}

interface PolygonAreaConfig {
  kind: "polygon";
  coordinates: Array<[number, number]>; // [lon, lat]
}
```

Anchor rules:

- Require at least three unique, non-collinear anchors.
- Resolve by explicit coordinates first, source ID second, and exact normalized name/address last.
- Search Yandex, gdebenz, and cached 2GIS catalogue data for named anchors.
- If multiple stations remain plausible, return `AREA_AMBIGUOUS`.
- Compute the convex hull and optionally buffer it by `bufferMeters`.
- Include stations lying exactly on the boundary.
- Never expand an unresolved area to all Volgograd.

### Source configuration

```ts
interface SourceConfig {
  enabled: boolean;
  baseUrl: string;
  requestTimeoutMs: number;
  retries: number;
  rateLimitMs: number;
  availabilityReliability?: number;
  discoveryReliability: number;
  correlationGroup?: string;

  pagination?: {
    maximumPages: number;
    concurrency: number;
  };

  refreshIntervalMinutes?: number;
}
```

Initial defaults:

```text
Yandex:
  availability reliability 0.85
  request timeout 8 seconds
  retry 1
  max pages 20
  page concurrency 4
  refresh every monitor tick

gdebenz:
  availability reliability 0.70
  request timeout 8 seconds
  retry 1
  two bbox JSON requests per tick

2GIS:
  no availability reliability
  request timeout 8 seconds
  retry 0
  max pages 20
  concurrency 2
  catalogue cache 24 hours
  monitoring refresh at most every 6 hours
```

### Global limits

```text
cycle deadline:             90 seconds
source concurrency:          3
circuit threshold:           3 consecutive failures
circuit cooldown:           45 minutes
maximum accepted stations: 1000 per source
maximum response body:      10 MiB per page
```

Configuration contains no cookies, credentials, or browser state.

## 7. Geometry and station identity

### Coverage strategy

- Yandex uses one city/bounding-box search followed by advertised pagination.
- gdebenz uses one bounding rectangle for each of its two JSON endpoints.
- 2GIS uses search pagination only when its catalogue cache is due for refresh.
- Every source result is post-filtered against the exact rectangle or polygon.
- No source-specific result count is treated as complete unless pagination completes without truncation.

### Matching algorithm

1. Apply configured identity overrides.
2. Match exact source-native IDs within a source.
3. Generate cross-source candidates within 180 metres.
4. Calculate:
   - coordinate proximity: 50%
   - normalized brand: 20%
   - normalized address: 20%
   - normalized station name: 10%
5. Merge at score `>= 0.78`.
6. Keep scores `0.62–0.78` separate and emit `POSSIBLE_DUPLICATE`.
7. Use complete-link clustering: every member must satisfy the merge threshold against the cluster.
8. Reject automatic merges with conflicting non-empty brands unless explicitly overridden.

Coordinate similarity is full within 25 metres and declines linearly to zero at 180 metres.

The monitor retains a station registry so keys remain stable when a source temporarily disappears. Runtime state is stored under the configured state directory, never alongside the scripts.

## 8. Availability and freshness scoring

### Base likelihoods

```text
IN_STOCK      0.95
OUT_OF_STOCK  0.05
LIMITED       0.70
UNCERTAIN     0.60
UNKNOWN       0.50
```

### Freshness factor

For exact or conservatively bounded age:

- Age `<= fresh`: `1.0`
- `fresh < age <= stale`: linear decline from `1.0` to `0.35`
- `stale < age <= expire`: linear decline from `0.35` to `0`
- Age `> expire`: `0`

Defaults:

```text
availability:
  fresh   20 minutes
  stale   90 minutes
  expire 240 minutes

queue:
  fresh   10 minutes
  stale   30 minutes
  expire  60 minutes
```

For a bounded gdebenz freshness band, use its maximum age. Consequently, band 3 may contribute current evidence, band 2 is weak or uncertain under the defaults, and band 1 is expired. This is deliberately conservative.

### Additional factors

```text
time quality:
  exact source timestamp        1.00
  bounded source freshness      0.85
  fetch time only               0.55

signal factor:
  no count supplied             0.75
  otherwise:
    clamp(0.60 + 0.15 × ln(1 + signalsPerHour), 0.60, 1.00)

source conflict:
  no conflict                   1.00
  conflict indicated            0.60
```

For observation `i`:

```text
weightᵢ =
  sourceReliability
  × freshnessFactor
  × timeQuality
  × signalFactor
  × conflictFactor

contributionᵢ =
  clamp(logit(statusLikelihoodᵢ) × weightᵢ, -2.2, 2.2)
```

Within one `correlationGroup`, retain only the strongest valid contribution for a product. This prevents duplicated representations of the same underlying feed from being treated as independent confirmation.

```text
estimatedAvailability =
  sigmoid(sum(independentGroupContributions))
```

Advertised products from 2GIS never enter this formula.

### Candidate eligibility

A station appears under “currently available” only if:

- it is inside the configured geometry;
- at least one explicit positive observation matches a requested concrete product;
- that positive observation has not expired; and
- estimated availability is at least `0.60`.

For `AI95_ANY`, calculate every matching base or branded product independently and select the best eligible product. Plain AI-95 and branded AI-95 observations are not fused unless an alias explicitly states they represent the same product.

## 9. Confidence

Confidence measures evidence quality and corroboration, not the estimated availability itself.

```text
coverage =
  1 - product(1 - effectiveIndependentGroupWeight)

contradiction =
  min(totalPositiveWeight, totalNegativeWeight)
  / max(totalPositiveWeight + totalNegativeWeight, epsilon)

confidenceScore =
  coverage × (1 - contradiction)
```

A single independent availability source caps confidence at `0.74`.

Labels:

```text
HIGH    score >= 0.75
MEDIUM  score >= 0.45
LOW     score < 0.45
```

A fresh Yandex `IN_STOCK` observation may therefore yield a high availability estimate but only medium confidence. High confidence normally requires agreement between Yandex and gdebenz.

If Yandex is truncated, apply a coverage warning but do not reduce the confidence of stations actually observed. Truncation affects completeness, not the validity of a parsed station record.

## 10. Queue normalization and ranking

Queue data is product-associated when the source supports that association.

- Yandex numeric or localized queue sizes become comparable.
- gdebenz `status: "queue"` becomes “queue reported; size unknown.”
- Stale or expired queue observations are displayed as stale and excluded from ordering.
- Unknown queue never means zero queue.

Ranking:

1. Descending five-percentage-point availability band.
2. If both stations have fresh comparable queues, ascending queue score.
3. Descending exact estimated availability.
4. Newer decisive availability evidence.
5. Stable station name.

Queue does not change availability probability. A station with unknown queue is not automatically penalized against one with a known queue; queue comparison is applied only when both values are comparable.

## 11. On-demand and monitoring lifecycle

### On-demand

Run one collection cycle, publish the ranked result and source health, then terminate.

### Monitoring

1. Start a durable current-task goal with the stopping condition “the user explicitly asks to stop monitoring.”
2. Launch one foreground `monitor --ndjson` process.
3. Publish the first snapshot immediately.
4. Schedule targets as:

```text
startedAt + tickNumber × 15 minutes
```

5. Never run overlapping cycles. If a cycle finishes after its next target, skip the missed target and publish one late result rather than launching concurrent collectors.
6. Poll or wait in intervals no longer than 60 seconds so user steering remains responsive.
7. Publish every snapshot as a complete commentary update, followed by the delta from the previous snapshot.
8. On explicit stop:
   - abort active fetches;
   - send `SIGINT`;
   - allow five seconds for cleanup;
   - send `SIGTERM` if still running;
   - publish a final stopped status;
   - complete the durable goal.
9. Never leave a detached daemon.

Codex’s durable-goal mechanism is intended for long-running work across turns with a clear stopping condition. [Official OpenAI documentation](https://learn.chatgpt.com/use-cases/follow-goals)

Monitoring is available only while the current task and host remain active. It does not promise offline delivery.

Configuration is revalidated before every tick. Invalid configuration produces a configuration-error report and pauses collection until the next tick; the monitor does not silently reuse an obsolete area.

## 12. Output

Example:

```markdown
Fuel availability — AI-95 and premium variants
Area: <configured area>
Checked: 30 Aug 2026, 16:45 MSK

1. <station and address>
   Fuel: G-Drive 95
   Estimated availability: 89% — medium confidence
   Freshness: fresh, Yandex signal 6 minutes ago
   Queue: short
   Evidence:
   - Yandex: IN_STOCK, 7 signals/hour
   - gdebenz: no sufficiently fresh matching report
   Map: <source link>

2. <station and address>
   Fuel: AI-95
   Estimated availability: 72% — low confidence
   Freshness: gdebenz band 3, conservatively treated as up to 60 minutes old
   Queue: reported; size unknown
   Evidence:
   - gdebenz: queue, fuels_now includes 95
```

Monitoring adds:

```markdown
Changes since 16:30:
- Newly supported by current evidence: ...
- No longer supported by fresh evidence: ...
- Queue improved: ...
- Confidence changed: ...
```

Source health distinguishes data roles:

```markdown
Source health:
- Yandex — availability: OK, 8/8 pages, 143 stations
- gdebenz — availability: OK, 208 station records, 117 freshness records
- 2GIS — catalogue only: cached, refreshed 2 hours ago
```

Counts are runtime values and must never be hardcoded.

If no station qualifies:

> No station currently has a sufficiently fresh positive signal for the requested fuel.

The report may show up to three uncertain candidates. It must not claim that fuel is unavailable everywhere unless current negative evidence supports that conclusion.

## 13. Failure and fallback behavior

| Failure | Behavior |
|---|---|
| One availability source fails | Publish successful evidence from the other source and mark confidence accordingly. |
| 2GIS fails or presents CAPTCHA | Continue; identity enrichment may be reduced, but availability remains operational. |
| Yandex schema changes | Return `SCHEMA_CHANGED`; continue with gdebenz. |
| gdebenz JSON schema changes | Reject invalid records; continue with Yandex. |
| One gdebenz endpoint fails | Use the successful endpoint where meaningful; without freshness data, positive records receive fetch-time-only quality and cannot exceed low confidence. |
| Yandex pagination exceeds cap | Return partial results with `TRUNCATED` coverage. |
| `429` | Honor `Retry-After` only if it fits the cycle deadline. |
| `5xx` or network timeout | Retry once with jitter. |
| Ambiguous boundary anchor | Fail closed with `AREA_AMBIGUOUS`. |
| No availability source succeeds | Emit an empty snapshot and exit code 3. |
| All current observations expire | Show last-known data separately, never as current. |
| Repeated adapter failure | Open its circuit after three failures for 45 minutes. |
| User stops during collection | Abort all active requests and exit 130. |

The last-good cache supports change reporting and diagnostics. Expired cached observations cannot qualify as current availability.

## 14. Cache policy

Runtime state resides outside the skill directory:

```text
<configured-state-dir>/
├── station-registry.json
├── 2gis-catalog.json
├── last-snapshot.json
└── source-health.json
```

Defaults:

```text
2GIS catalogue TTL:         24 hours
2GIS monitor refresh:        6 hours
station registry TTL:       30 days
last observation retention: 24 hours
raw HTTP body retention:     disabled
```

Writes use temporary files followed by atomic rename. Cache corruption produces a warning and a clean rebuild.

## 15. Testing

### Unit tests

- Fuel aliases and Cyrillic/Latin normalization.
- Base versus branded AI-95 isolation.
- Exact, bounded, and fetch-time freshness.
- gdebenz freshness-band worst-case ages.
- Correlation-group deduplication.
- Positive/negative conflicts and confidence caps.
- Queue size, ordinal queue, presence-only queue, and unknown text.
- Rectangle, convex hull, polygon boundary, and collinear anchors.
- Complete-link station clustering and brand conflicts.
- Deterministic ranking.

### Yandex parser contracts

Fixtures must cover:

- multiple advertised pages;
- all four Yandex availability statuses;
- exact `lastSignalTimestamp`;
- signal counts;
- localized queue sizes;
- empty legitimate results;
- malformed embedded JSON;
- missing or renamed availability fields;
- pagination beyond the configured cap.

Tests must distinguish `SCHEMA_CHANGED`, `TRUNCATED`, and a legitimate empty result.

### gdebenz contracts

Fixtures must cover:

- `/api/stations` array validation;
- `/api/comments` join by `osm_id`;
- `yes`, `queue`, `low`, `no`, and null statuses;
- explicit `fuels_now` matching;
- positive status with empty `fuels_now`;
- `dt_only`;
- conflict values;
- freshness bands 0–3;
- one endpoint succeeding while the other fails;
- unrecognized additional fields.

Unknown fields are ignored but preserved in optional diagnostic provenance; missing required fields reject only the affected record.

### 2GIS contracts

Fixtures must cover:

- station search pagination;
- branch records;
- advertised AI-95 and premium variants;
- coordinate/address extraction;
- CAPTCHA detection;
- cache freshness and expiry.

Tests explicitly assert that 2GIS catalogue products never generate a `FuelObservation`.

### Integration tests

Use a local fixture server to simulate:

- delayed responses;
- `429`, `500`, and connection failures;
- Yandex page concurrency;
- cycle deadline cancellation;
- partial source success;
- source circuit opening and recovery;
- atomic cache replacement;
- station-key continuity across missing sources.

### Monitoring tests

With fake timers:

- first report is immediate;
- reports target 15-minute boundaries;
- slow cycles never overlap;
- missed intervals are skipped safely;
- stop works during collection and between ticks;
- invalid reloaded configuration pauses collection;
- every NDJSON line is complete;
- no child process remains after cancellation.

### Live canaries

Live tests are manual and opt-in:

- validate that the two gdebenz endpoints still return arrays with expected sentinel fields;
- validate that Yandex exposes parseable pagination and availability objects;
- validate that 2GIS still exposes catalogue records or is correctly classified as challenged;
- never assert that a particular station has fuel;
- never run in standard CI;
- obey strict rate limits.

## 16. Trade-offs

### Chosen: direct source-specific transports

Yandex server HTML and gdebenz JSON are directly accessible, so browser automation would add cost and instability without increasing coverage. 2GIS contributes only catalogue data, making an unattended browser session unjustified.

### Chosen: city/bbox pagination instead of tiling

Advertised pagination is bounded, inspectable, and arithmetically compatible with the 90-second cycle. Geographic tiling could create dozens of redundant requests and make a 15-minute monitor unnecessarily aggressive.

### Chosen: first-class gdebenz integration

Its clean bbox JSON interface supplies station and crowd-status data without scraping HTML. Its lower source reliability reflects crowdsourced semantics and coarse freshness, not transport quality.

### Chosen: 2GIS as catalogue-only

2GIS improves station identity, boundary-anchor resolution, and knowledge of normally sold grades. It cannot corroborate current availability, so the scoring pipeline excludes it.

### Rejected: browser-first or automatic CAPTCHA fallback

This would introduce session state, extra dependencies, and legal fragility while offering no current benefit for the verified source set.

### Rejected: single-source Yandex design

Yandex is currently the richest source, but gdebenz provides independent crowd evidence and graceful degradation if Yandex changes.

### Deferred: external daemon or scheduled notifications

That would survive task closure but violates the current-task monitoring requirement and adds deployment and credential management.

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Yandex changes its internal representation | Structural validation, parser fixtures, explicit schema-drift status, and gdebenz fallback. |
| gdebenz changes or removes its unofficial JSON endpoints | Separate adapter, schema validation, live canary, circuit breaker, and Yandex fallback. |
| 2GIS remains challenged | Catalogue cache and optional operation; no availability dependency. |
| Pagination is incomplete | Follow advertised pages, enforce a visible cap, and report `TRUNCATED`. |
| Nearby stations are incorrectly merged | Conservative thresholds, brand conflicts, complete-link clustering, and overrides. |
| General gdebenz status is mistaken for AI-95 evidence | Require explicit matching `fuels_now` for positive grade evidence. |
| Branded and plain AI-95 are conflated | Score concrete product keys independently. |
| Coarse gdebenz freshness appears newer than it is | Use the maximum age of each freshness bucket. |
| A heuristic percentage is mistaken for certainty | Label it estimated availability and show separate confidence, age, sources, and conflicts. |
| Queue presence is mistaken for queue size | Preserve a distinct non-comparable `PRESENCE` type. |
| Monitoring ends with the host task | State the lifecycle limitation and avoid claiming offline monitoring. |
| Polling burdens source services | Catalogue caching, pagination caps, concurrency limits, one retry, rate limits, and circuit breakers. |

## 18. Legal and operational constraints

The adapters use public but unofficial machine-readable representations. Before distribution, verify each service’s current terms, robots policy, and data-use restrictions.

The skill must:

- issue read-only requests only;
- minimize request volume;
- avoid CAPTCHA circumvention;
- avoid authentication unless a future documented source explicitly requires it;
- never copy browser cookies or session state;
- avoid bulk redistribution or permanent archival of extracted data;
- retain source URL and retrieval time;
- disable raw body logging by default;
- redact query values that may contain sensitive identifiers;
- state that availability can change before arrival;
- avoid presenting the output as guaranteed or safety-critical.

A legal or operational incompatibility disables only the affected adapter.

## 19. Assumptions and open questions

- No area was supplied. Configuration therefore remains invalid until a rectangle, polygon, or at least three unambiguous boundary stations are provided. No city-wide default boundary is invented.
- The gdebenz endpoint paths and fields described above are the version-1 extraction contract. They remain unofficial and require fixtures.
- `gdebenz.fmask` is intentionally not interpreted until its bit allocation is verified.
- 2GIS advertised grades describe normal station capability, not live stock.
- Yandex availability extraction remains based on an internal, unversioned representation despite direct HTTP accessibility.
- The probability values are deterministic ranking heuristics, not calibrated statistical probabilities.
- Explicit invocation fuel arguments override defaults for that run but do not rewrite `config.json`.
- Monitoring continues through temporary source failures and empty results. Only an explicit stop request ends it.
- Monitoring is guaranteed only while the durable Codex task and host remain active.
- Runtime cache lives outside the skill directory; configuration and its schema remain next to the scripts.

## 20. Decision ledger

| Decision | Status | Rationale |
|---|---|---|
| Use modular source adapters and deterministic fusion | Adopted | Preserves isolation, testability, and partial-source results. |
| Use direct HTTP for all three current adapters | Adopted | Verified source behavior does not require browser execution. |
| Use gdebenz bbox JSON endpoints | Adopted | They provide structured station and crowd-status data directly. |
| Treat 2GIS as catalogue-only | Adopted | It exposes station and grade metadata but no current availability. |
| Use Yandex advertised pagination | Adopted | Complete coverage without infeasible geographic fan-out. |
| Remove geographic tiling | Rejected | It multiplies requests and cannot reliably fit the cycle deadline. |
| Remove production browser/CAPTCHA subsystem | Rejected | It provides no current availability benefit and adds fragility. |
| Keep fail-closed area resolution | Adopted | Prevents accidental reporting outside the user’s accepted area. |
| Score concrete fuel products independently | Adopted | Prevents plain and branded AI-95 evidence from being conflated. |
| Separate probability, confidence, and freshness | Adopted | Communicates evidence quality without overstating certainty. |
| Compare queue only when values are comparable | Adopted | Avoids treating missing queue data as zero or long. |
| Keep monitoring inside a durable current task | Adopted | Matches the requested lifecycle without external services. |
| Add external daemon or push notifications | Deferred | Outside the current-task scope. |