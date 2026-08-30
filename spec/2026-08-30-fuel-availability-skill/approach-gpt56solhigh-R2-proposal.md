# Fuel Availability Monitoring Skill — Final Design

## 1. High-level approach

Build a dependency-light Node.js skill with direct HTTP collectors for Yandex Maps, gdebenz, and 2GIS. Yandex and gdebenz provide current availability evidence, while 2GIS supplies station identity and advertised-product metadata; a deterministic pipeline applies the configured boundary, reconciles stations, assesses freshness and confidence, normalizes queues, and ranks results.

Monitoring remains attached to the current durable Codex task, publishing immediately and then every 15 minutes until the user explicitly stops it.

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

Use Node 20+ built-ins: `fetch`, `AbortController`, `node:crypto`, `node:test`, and filesystem primitives. No production browser dependency is needed for the currently verified source behavior.

### Data flow

```text
User request
    │
    ├─ load and validate configuration
    ├─ resolve requested fuels
    ├─ resolve rectangle, polygon, or station-anchor boundary
    │
    ├─ Yandex search + bounded pagination ─ availability + queue size
    ├─ gdebenz bbox JSON endpoints ──────── availability + queue presence
    └─ 2GIS search/cache ────────────────── identity + advertised products
                             │
                    normalize source records
                             │
                    exact geometry filtering
                             │
                    station identity matching
                             │
                    per-product evidence fusion
                             │
                confidence and queue ranking
                             │
                 JSON snapshot + Markdown report
```

### Component responsibilities

| Component | Responsibility |
|---|---|
| `SKILL.md` | Detect mode, invoke the CLI, publish reports, and manage current-task cancellation. |
| `fuel-monitor.mjs` | CLI arguments, stdout/stderr contract, exit codes, and signal handling. |
| `pipeline.mjs` | Run one cycle, isolate source failures, enforce deadlines, and assemble a snapshot. |
| `pagination.mjs` | Traverse advertised or inferred page sequences with caps, deduplication, and termination guards. |
| Source adapters | Fetch and normalize one source without performing cross-source scoring or matching. |
| `geometry.mjs` | Validate areas, resolve anchors, calculate convex hulls, and filter coordinates. |
| `fuels.mjs` | Normalize grades and branded variants using configurable aliases. |
| `matching.mjs` | Reconcile source records into canonical stations. |
| `scoring.mjs` | Calculate freshness-weighted availability and confidence. |
| `queue.mjs` | Normalize comparable queues while preserving presence-only and unknown values. |
| `cache.mjs` | Persist catalogue records, stable station keys, and prior snapshots outside the skill directory. |
| `monitor-loop.mjs` | Schedule non-overlapping cycles without cadence drift. |
| `render.mjs` | Render stable JSON and user-facing Markdown. |

## 3. Source adapters

### 3.1 Yandex Maps

Yandex is the primary availability and queue-size source. Its public documentation states that station cards may show fuel status, queue, restrictions, and last-update time, while warning that the information can be delayed. [Yandex fuel availability documentation](https://yandex.ru/support/m-maps/ru/refuel)

#### Collection strategy

1. Request the server-rendered petrol-station search page for Volgograd, using a bounding rectangle when supported by the current request format.
2. Parse the first response and inspect its pagination metadata.
3. Traverse additional pages with bounded concurrency.
4. Extract JSON-bearing script elements.
5. Parse JSON structurally and recursively locate station features.
6. Validate station IDs, coordinates, fuel objects, statuses, and timestamps.
7. Normalize:
   - `IN_STOCK`
   - `OUT_OF_STOCK`
   - `UNKNOWN`
   - `UNCERTAIN`
   - `lastSignalTimestamp`
   - `signalsCountPerHour`
   - `localizedQueueSize` and related queue fields
8. Deduplicate records by Yandex station ID.
9. Apply the exact configured geometry locally.

Do not use a broad regular expression to manufacture records from arbitrary HTML. If recognized availability structures exist but no longer validate, return `SCHEMA_CHANGED`.

#### Pagination termination

Pagination supports two strategies:

1. Prefer an advertised last page or next-page link.
2. If explicit metadata is absent, request sequential pages until:
   - the page contains no station records;
   - the page repeats the previous page’s station-ID set;
   - every station ID was already seen; or
   - `maximumPages` is reached.

Repeated-page detection prevents infinite pagination when a source ignores the page parameter.

Defaults:

```text
maximum pages:       16
page concurrency:     4
request timeout:      6 seconds
retry count:          1
adapter deadline:    65 seconds
```

The worst timeout path is bounded: the first page costs at most 12 seconds, and the remaining 15 pages require four concurrent waves of at most 12 seconds, totaling at most 60 seconds before minor processing overhead.

Configuration validation rejects pagination settings whose calculated worst case exceeds `adapterDeadlineMs`.

When the page limit is reached before natural completion, health is `TRUNCATED`. Parsed station observations remain valid, but overall search completeness becomes partial.

No geographic tile fan-out is used.

#### Timestamp validation

- Reject malformed timestamps.
- Treat timestamps more than five minutes in the future as invalid.
- Clamp future skew of five minutes or less to age zero.
- A status without a usable signal timestamp receives `ObservationTime.kind = "UNKNOWN"` and cannot independently qualify a station as currently available.

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

gdebenz is a first-class JSON availability source.

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

Request both endpoints concurrently and join their records by `osm_id`.

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

`conflict` remains `string | null` throughout normalization so its source value is not lost. `fmask` is retained as provenance but not interpreted in version 1 because its bit allocation has not been verified.

#### Grade semantics

| Status | Meaning |
|---|---|
| `yes` | Positive general availability report |
| `queue` | Positive report with a queue of unknown size |
| `low` | Limited availability |
| `no` | No fuel reported |
| `null` | No current status |

For a requested grade:

- `yes` or `queue` is positive only when `fuels_now` explicitly contains the grade.
- `low` with an explicitly matching grade becomes `LIMITED`.
- Positive status with empty `fuels_now` is general evidence and cannot qualify AI-95.
- If `fuels_now` lists only other grades, the requested grade remains `UNKNOWN`, not `OUT_OF_STOCK`.
- `no` is negative evidence for all grades, subject to freshness.
- `dt_only: 1` permits positive evidence only for diesel.
- A non-null `conflict` reduces evidence strength and confidence while remaining visible in provenance.

#### Freshness bands

| Band | Meaning | Conservative maximum age |
|---:|---|---:|
| `3` | Less than one hour | 60 minutes |
| `2` | Reports within three hours | 180 minutes |
| `1` | Reports today | 720 minutes |
| `0` or absent | No usable freshness | Unknown |

Use the maximum possible age when calculating freshness.

If `/api/stations` succeeds but `/api/comments` fails, statuses may be shown as unverified last-known data, but they receive `ObservationTime.kind = "UNKNOWN"` and zero current-evidence weight. Fetch time is not a substitute for observation time.

If `/api/comments` succeeds without the matching station record, retain the health information but do not construct a station from coordinates alone unless its identifier matches a cached station.

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

2GIS is a catalogue and station-identity source only. Search results expose names, addresses, coordinates, branches, and normally offered grades such as AI-95 and 95+, but not current availability. [2GIS Volgograd station search](https://2gis.ru/volgograd/search/%D0%90%D0%B7%D1%81%20%D0%B1%D0%B5%D0%BD%D0%B7%D0%B8%D0%BD)

#### Collection strategy

1. Use direct HTTP search pages and bounded pagination.
2. Extract station ID, name, brand, address, coordinates, branches, source URL, and advertised products.
3. Cache the catalogue for 24 hours.
4. During monitoring, refresh at startup only if missing or expired, then at most every six hours.
5. Never convert advertised products into current-availability observations.
6. Detect CAPTCHA or challenge pages and return `CHALLENGE`.

There is no production browser fallback. Since 2GIS supplies no current availability, maintaining an unattended browser session would add fragility without improving the primary result.

`agent-browser` may be used during adapter development to diagnose a changed page when direct extraction no longer works. CAPTCHA solving or bypass remains prohibited.

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

## 4. Key interfaces

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

interface SourceResult {
  source: SourceId;
  stations: RawStation[];
  availability: FuelObservation[];
  queues: QueueObservation[];
  health: SourceHealth;
}
```

Adapters return `SourceResult` for expected failures. Unexpected exceptions become `INTERNAL_ADAPTER_ERROR`; cancellation propagates as `AbortError`.

### Core functions

```ts
function loadConfig(path: string): Config;

async function resolveArea(
  config: AreaConfig,
  adapters: SourceAdapter[],
  context: CollectContext
): Promise<ResolvedArea>;

function normalizeFuel(
  rawLabel: string,
  source: SourceId,
  aliases: FuelAliasConfig
): FuelProduct | null;

function matchStations(
  records: RawStation[],
  previousRegistry: StationRegistry | null,
  config: MatchingConfig
): MatchResult;

function assessProduct(
  station: CanonicalStation,
  product: FuelProduct,
  observations: FuelObservation[],
  now: Date,
  config: ScoringConfig
): ProductAssessment;

function assessStation(
  station: CanonicalStation,
  query: ResolvedFuelQuery,
  observations: FuelObservation[],
  queues: QueueObservation[],
  now: Date,
  config: ScoringConfig
): StationAssessment;

function rankStations(
  assessments: StationAssessment[],
  config: RankingConfig
): StationAssessment[];

async function runOnce(input: RunOnceInput): Promise<Snapshot>;

async function runMonitor(
  input: MonitorInput,
  emit: (snapshot: Snapshot) => Promise<void>
): Promise<MonitorResult>;
```

Expected configuration/geometry errors:

- `CONFIG_INVALID`
- `AREA_MISSING`
- `AREA_INVALID`
- `AREA_AMBIGUOUS`
- `AREA_ANCHOR_NOT_FOUND`
- `FUEL_QUERY_INVALID`
- `SOURCE_CONFIGURATION_INVALID`
- `MONITORING_HOST_UNSUPPORTED`

### HTTP and pagination

```ts
interface HttpPort {
  fetch(
    url: URL,
    options: {
      timeoutMs: number;
      signal: AbortSignal;
      headers?: Record<string, string>;
      maximumBodyBytes: number;
    }
  ): Promise<Response>;
}

interface PaginationPlan {
  firstPage: number;
  advertisedLastPage?: number;
  maximumPages: number;
  concurrency: number;
  stopOnEmpty: boolean;
  stopOnRepeatedIds: boolean;
}

async function collectPages<T>(
  plan: PaginationPlan,
  fetchPage: (
    page: number,
    signal: AbortSignal
  ) => Promise<ParsedPage<T>>,
  signal: AbortSignal
): Promise<PaginatedResult<T>>;
```

HTTP/source errors:

- `NETWORK`
- `TIMEOUT`
- `BODY_TOO_LARGE`
- `HTTP_STATUS`
- `RATE_LIMITED`
- `CHALLENGE`
- `SCHEMA_CHANGED`
- `TRUNCATED`
- `ABORTED`
- `INTERNAL_ADAPTER_ERROR`

## 5. Data models

### Stations

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
  normalizedAddress?: string;
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

Advertised products describe normal catalogue capability only.

### Fuels

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
  specificity: "EXACT_VARIANT" | "FAMILY_ONLY";
}

interface ResolvedFuelQuery {
  queryId: string;
  families: FuelFamily[];
  includeVariants: boolean;
  exactVariantKeys?: string[];
}
```

The default is:

```js
{
  queryId: "AI95_ANY",
  families: ["AI_95"],
  includeVariants: true
}
```

Plain and branded products are scored independently. Family-only observations corroborate an exact variant only when configuration explicitly declares that mapping; otherwise they corroborate the family query but not the specific branded product.

### Availability observations

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
      kind: "UNKNOWN";
    };

interface SourceConflict {
  rawStatus: string;
  normalizedStatus?: AvailabilityStatus;
}

interface FuelObservation {
  source: SourceId;
  sourceStationId: string;
  product: FuelProduct;
  status: AvailabilityStatus;
  time: ObservationTime;
  signalsPerHour?: number;
  sourceConflict?: SourceConflict;
  rawStatus: string;
  fetchedAt: string;
  provenanceUrl?: string;
}
```

Fetch time is always provenance, never observation time.

### Queues

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

`PRESENCE` renders “queue reported; size unknown” and is excluded from shortest-queue comparison.

### Assessment

```ts
interface StationAssessment {
  station: CanonicalStation;
  requestedQueryId: string;
  selectedProduct?: FuelProduct;
  estimatedAvailability: number;
  confidenceScore: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  freshness: FreshnessClass;
  decisiveObservationAt?: string;
  queue: NormalizedQueue;
  eligible: boolean;
  evidence: EvidenceSummary[];
  warnings: Warning[];
}
```

### Snapshot

```ts
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
interface CoverageAssessment {
  completeness: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  availabilitySourcesSucceeded: SourceId[];
  catalogueSourcesSucceeded: SourceId[];
  reasons: string[];
}
```

## 6. Configuration schema

```ts
interface Config {
  schemaVersion: 1;
  timezone: "Europe/Moscow";

  defaults: {
    fuelQueries: string[];
    monitorIntervalMinutes: number;
    topN: number;
  };

  area: AreaConfig;
  fuelAliases: Record<string, FuelAliasConfig>;
  freshness: FreshnessConfig;
  matching: MatchingConfig;
  scoring: ScoringConfig;
  ranking: RankingConfig;
  sources: {
    yandex: YandexConfig;
    gdebenz: GdebenzConfig;
    "2gis": TwoGisConfig;
  };
  collection: CollectionConfig;
  cache: CacheConfig;
}
```

### Geometry

```ts
type AreaConfig =
  | {
      kind: "rectangle";
      south: number;
      west: number;
      north: number;
      east: number;
    }
  | {
      kind: "polygon";
      coordinates: Array<[number, number]>;
    }
  | {
      kind: "station-anchors";
      boundary: "convex-hull";
      anchors: StationAnchor[];
      bufferMeters: number;
      unresolvedPolicy: "fail-closed";
    };
```

Validation:

- Rectangle: `south < north`, `west < east`.
- Polygon: at least three distinct non-collinear points, no self-intersection.
- Anchors: at least three uniquely resolved, non-collinear stations.
- Boundary points count as inside.
- Maximum area is configurable; default 5,000 km² prevents accidental region-wide polling.

Named anchors resolve from exact coordinates, source ID, or exact normalized name/address. Name-only discovery uses Yandex and 2GIS city search. gdebenz participates only when a coordinate or bounding hint is available. Ambiguity fails closed.

Resolved anchor coordinates are cached against a hash of the anchor configuration, but `config.json` is not rewritten automatically.

### Freshness

```ts
interface FreshnessThresholds {
  freshMinutes: number;
  staleMinutes: number;
  expireMinutes: number;
}

interface FreshnessConfig {
  availability: FreshnessThresholds;
  queue: FreshnessThresholds;
}
```

Validation requires:

```text
0 <= freshMinutes < staleMinutes < expireMinutes
```

Defaults:

```text
availability: 20 / 90 / 240 minutes
queue:        10 / 30 / 60 minutes
```

### Matching

```ts
interface MatchingConfig {
  candidateRadiusMeters: number;       // 180
  fullCoordinateScoreMeters: number;   // 25
  mergeThreshold: number;              // 0.78
  possibleDuplicateThreshold: number;  // 0.62
  weights: {
    coordinate: number;                // 0.50
    brand: number;                     // 0.20
    address: number;                   // 0.20
    name: number;                      // 0.10
  };
  overrides: StationIdentityOverride[];
}
```

Weights must total `1.0`.

### Scoring

```ts
interface ScoringConfig {
  statusLikelihoods: {
    IN_STOCK: number;      // 0.95
    OUT_OF_STOCK: number;  // 0.05
    LIMITED: number;       // 0.70
    UNCERTAIN: number;     // 0.60
    UNKNOWN: number;       // 0.50
  };
  sourceReliability: {
    yandex: number;        // 0.85
    gdebenz: number;       // 0.70
  };
  timeQuality: {
    exact: number;         // 1.00
    bounded: number;       // 0.85
    unknown: number;       // 0
  };
  noSignalCountFactor: number;          // 0.75
  conflictFactor: number;               // 0.60
  candidateThreshold: number;           // 0.60
  singleSourceConfidenceCap: number;     // 0.74
  mediumConfidenceThreshold: number;    // 0.45
  highConfidenceThreshold: number;      // 0.75
}
```

### Source-specific settings

```ts
interface YandexConfig {
  enabled: boolean;
  searchUrlTemplate: string;
  requestTimeoutMs: number;       // 6000
  retries: number;                // 1
  adapterDeadlineMs: number;      // 65000
  rateLimitMs: number;
  correlationGroup: string;
  pagination: {
    maximumPages: number;         // 16
    concurrency: number;          // 4
  };
}

interface GdebenzConfig {
  enabled: boolean;
  baseUrl: string;
  stationsPath: string;           // /api/stations
  commentsPath: string;           // /api/comments
  requestTimeoutMs: number;       // 6000
  retries: number;                // 1
  adapterDeadlineMs: number;      // 15000
  rateLimitMs: number;
  correlationGroup: string;
}

interface TwoGisConfig {
  enabled: boolean;
  searchUrlTemplate: string;
  requestTimeoutMs: number;       // 6000
  retries: number;                // 0
  adapterDeadlineMs: number;      // 45000
  rateLimitMs: number;
  pagination: {
    maximumPages: number;         // 12
    concurrency: number;          // 2
  };
  cacheTtlMinutes: number;        // 1440
  monitorRefreshMinutes: number;  // 360
}
```

### Collection and cache

```ts
interface CollectionConfig {
  cycleDeadlineMs: number;          // 75000
  maximumStationsPerSource: number; // 1000
  maximumBodyBytes: number;         // 10 MiB
  circuitFailureThreshold: number;  // 3
  circuitCooldownMinutes: number;   // 45
  maximumAreaKm2: number;           // 5000
}

interface CacheConfig {
  stateDirectory: string;
  stationRegistryTtlDays: number;    // 30
  lastObservationTtlHours: number;   // 24
  retainRawBodies: false;
}
```

Configuration contains no cookies, credentials, or browser state.

## 7. Station identity matching

1. Apply explicit cross-source overrides.
2. Match exact native IDs within each source.
3. Generate cross-source candidates within 180 metres.
4. Calculate:
   - coordinate proximity: 50%
   - brand similarity: 20%
   - address similarity: 20%
   - station-name similarity: 10%
5. Merge at `>= 0.78`.
6. Keep `0.62–0.78` separate and emit `POSSIBLE_DUPLICATE`.
7. Use complete-link clustering so every member meets the threshold against the cluster.
8. Reject automatic merging of conflicting non-empty brands.

Coordinate similarity is full within 25 metres and declines linearly to zero at 180 metres.

Canonical station keys are reused from the runtime registry. New keys are derived from a hash of normalized brand, address, rounded coordinates, and sorted source identifiers.

## 8. Availability and freshness scoring

Base likelihoods:

```text
IN_STOCK      0.95
OUT_OF_STOCK  0.05
LIMITED       0.70
UNCERTAIN     0.60
UNKNOWN       0.50
```

Freshness factor:

- At or before `fresh`: `1.0`
- Between `fresh` and `stale`: linearly decline to `0.35`
- Between `stale` and `expire`: linearly decline to `0`
- After `expire`: `0`
- Unknown observation time: `0`

For bounded time, use `maximumAgeMinutes`.

Additional factors:

```text
exact time quality:       1.00
bounded time quality:     0.85
unknown time quality:     0
missing signal count:     0.75
source conflict factor:   0.60
```

For signal count `n`:

```text
signalFactor =
  clamp(0.60 + 0.15 × ln(1 + n), 0.60, 1.00)
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

Within one correlation group, retain only the strongest valid contribution for a concrete product.

```text
estimatedAvailability =
  sigmoid(sum(independentGroupContributions))
```

A source conflict also contributes conflict mass to the confidence calculation but is not treated as an independent observation.

A station is currently eligible only if:

- it lies inside the area;
- an explicit matching positive observation exists;
- the observation has known, non-expired time;
- estimated availability is at least `0.60`.

Expired or time-unknown statuses may be displayed as historical or unverified evidence but cannot qualify a station.

## 9. Confidence

```text
coverage =
  1 - product(1 - independentGroupWeight)

observedContradiction =
  min(totalPositiveWeight, totalNegativeWeight)
  / max(totalPositiveWeight + totalNegativeWeight, epsilon)

sourceConflictMass =
  sum(rawWeight × 0.40 for observations with sourceConflict)
  / max(sum(rawWeight), epsilon)

contradiction =
  clamp(observedContradiction + sourceConflictMass, 0, 1)

confidenceScore =
  coverage × (1 - contradiction)
```

One independent source caps confidence at `0.74`.

```text
HIGH    >= 0.75
MEDIUM  >= 0.45
LOW     <  0.45
```

Yandex truncation changes coverage completeness but does not reduce the confidence of individual station observations already parsed.

## 10. Queue normalization and ranking

- Yandex numeric or recognized localized queue sizes are comparable.
- gdebenz `queue` becomes `PRESENCE`.
- Unknown text stays non-comparable.
- Stale or expired queues do not participate in ordering.
- Queue never changes availability probability.

Queue scores:

| Queue | Score |
|---|---:|
| None | 0.00 |
| Short | 0.25 |
| Medium | 0.50 |
| Long | 0.75 |
| Very long | 1.00 |

Vehicle counts use:

```text
min(vehicleCount / 20, 1)
```

Ranking:

1. Descending five-percentage-point availability band.
2. When both stations have fresh comparable queues, ascending queue score.
3. Descending exact availability estimate.
4. Newer decisive observation.
5. Stable station name.

A known queue is not automatically preferred over or penalized against an unknown queue.

## 11. CLI contract

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

Monitoring stdout contains one complete snapshot per line. Diagnostics go to stderr.

| Exit | Meaning |
|---:|---|
| `0` | At least one availability source completed |
| `2` | Invalid configuration, area, or fuel query |
| `3` | No availability source completed; health-bearing empty snapshot emitted |
| `4` | Pipeline-level internal failure |
| `5` | Monitoring requested without a durable continuation capability |
| `130` | User cancellation |

A 2GIS failure alone never causes exit code 3.

## 12. On-demand and monitoring lifecycle

### On-demand

Run one cycle, render its snapshot, and terminate.

### Monitoring

An explicit monitoring request authorizes creation of a durable current-task goal. On-demand requests never create one.

1. Confirm through available host capabilities that the current task supports durable continuation.
2. If unavailable, return `MONITORING_HOST_UNSUPPORTED`; do not start an unmanaged background process.
3. Start a goal whose stopping condition is an explicit user request to stop monitoring.
4. Launch one foreground `monitor --ndjson` child process.
5. Publish the first snapshot immediately.
6. Target subsequent cycle starts at:

```text
startedAt + tickNumber × 15 minutes
```

7. Never overlap cycles.
8. If a cycle overruns a target, publish the completed late result, skip missed starts, and resume at the next future boundary.
9. Use waits no longer than 60 seconds so user steering remains responsive.
10. Publish each snapshot as a complete commentary update plus changes from the prior snapshot.
11. On explicit stop:
    - abort current requests;
    - send `SIGINT`;
    - allow five seconds for cleanup;
    - send `SIGTERM` if necessary;
    - publish a final stopped status;
    - complete the durable goal.
12. Never leave a detached process.

Codex durable goals are designed for long-running work with an explicit stopping condition. [Official OpenAI documentation](https://learn.chatgpt.com/use-cases/follow-goals)

Configuration is revalidated before each tick. Invalid configuration produces an error summary and pauses collection until the next tick rather than reusing an obsolete area.

## 13. Output

```markdown
Fuel availability — AI-95 and premium variants
Area: <configured area>
Checked: 30 Aug 2026, 16:45 MSK
Coverage: complete for both availability sources

1. <station and address>
   Fuel: G-Drive 95
   Estimated availability: 89% — medium confidence
   Freshness: Yandex signal 6 minutes ago
   Queue: short
   Evidence:
   - Yandex: IN_STOCK, 7 signals/hour
   - gdebenz: no sufficiently fresh matching report
   Map: <source link>

2. <station and address>
   Fuel: AI-95
   Estimated availability: 69% — low confidence
   Freshness: gdebenz band 3; treated as up to 60 minutes old
   Queue: reported; size unknown
   Evidence:
   - gdebenz: queue; fuels_now explicitly contains 95
```

Monitoring adds:

```markdown
Changes since 16:30:
- Newly supported by current evidence: ...
- No longer supported by fresh evidence: ...
- Queue improved: ...
- Confidence changed: ...
```

Health output distinguishes roles:

```markdown
Source health:
- Yandex — availability: OK, 8/8 pages
- gdebenz — availability: OK, station and freshness endpoints joined
- 2GIS — catalogue only: cached, refreshed 2 hours ago
```

All counts are runtime values.

If no station qualifies:

> No station currently has a sufficiently fresh positive signal for the requested fuel.

Do not say that fuel is unavailable everywhere unless fresh negative evidence supports that statement. Show up to three uncertain or recently expired candidates separately.

## 14. Failure and fallback behavior

| Failure | Behavior |
|---|---|
| One availability source fails | Publish evidence from the other source with reduced confidence. |
| 2GIS fails or returns CAPTCHA | Continue without catalogue enrichment. |
| Yandex schema changes | Return `SCHEMA_CHANGED`; continue with gdebenz. |
| gdebenz schema changes | Reject invalid records; continue with Yandex. |
| gdebenz freshness endpoint fails | Treat station statuses as time-unknown and current-ineligible. |
| Yandex pagination exceeds cap | Publish partial results with `TRUNCATED` coverage. |
| Page repeats indefinitely | Stop on repeated station-ID set and mark degraded. |
| Response exceeds 10 MiB | Abort that response with `BODY_TOO_LARGE`. |
| `429` | Honor `Retry-After` only within the adapter deadline. |
| `5xx` or network timeout | Retry once with bounded jitter. |
| Ambiguous area anchor | Fail closed with `AREA_AMBIGUOUS`. |
| No availability source succeeds | Emit an empty snapshot and exit 3. |
| All observations expire | Show last-known evidence separately, never as current. |
| Three consecutive failures | Open the adapter circuit for 45 minutes. |
| User stops during collection | Abort active requests and exit 130. |

Schema failures and challenges are not retried within the same cycle.

## 15. Cache policy

```text
<configured-state-dir>/
├── station-registry.json
├── resolved-area.json
├── 2gis-catalog.json
├── last-snapshot.json
└── source-health.json
```

Defaults:

```text
2GIS catalogue TTL:         24 hours
2GIS monitoring refresh:     6 hours
station registry TTL:       30 days
last observation retention: 24 hours
raw response retention:     disabled
```

Writes use a temporary file followed by atomic rename. Every cache file carries a schema version, creation time, configuration fingerprint, and source version. Corrupt or incompatible caches are ignored and rebuilt.

Cached observations older than their freshness expiration cannot qualify as current.

## 16. Testing

### Unit tests

- Fuel aliases and Cyrillic/Latin normalization.
- Plain versus branded AI-95 isolation.
- Exact, bounded, and unknown observation time.
- Worst-case gdebenz freshness bands.
- Correlation-group deduplication.
- Conflict strings, conflict penalties, and confidence caps.
- Numeric, ordinal, presence-only, and unknown queues.
- Rectangles, convex hulls, polygon boundaries, and collinear anchors.
- Complete-link station matching and brand conflicts.
- Deterministic ranking.

### Yandex parser contracts

Fixtures cover:

- explicit pagination;
- pagination without a declared last page;
- empty and repeated pages;
- all four Yandex statuses;
- exact timestamps and future clock skew;
- signal counts;
- localized queue values;
- legitimate empty results;
- malformed embedded JSON;
- renamed availability fields;
- page-cap truncation.

### gdebenz contracts

Fixtures cover:

- station and freshness endpoint schemas;
- joining by `osm_id`;
- `yes`, `queue`, `low`, `no`, and null;
- explicit `fuels_now`;
- positive status with empty fuels;
- `dt_only`;
- string and null `conflict`;
- freshness bands 0–3;
- missing freshness endpoint;
- unmatched freshness records;
- additional unknown fields.

Tests assert that fetch time never becomes observation time.

### 2GIS contracts

Fixtures cover:

- search pagination;
- branch records;
- advertised AI-95 and premium products;
- address and coordinate extraction;
- challenge detection;
- cache expiry.

Tests assert that 2GIS never emits current availability.

### Integration tests

Use a local fixture server for:

- timeouts, `429`, `500`, and oversized bodies;
- pagination concurrency and repeated-page termination;
- cycle cancellation;
- partial-source success;
- circuit opening and recovery;
- atomic cache writes;
- station-key continuity.

### Monitoring tests

With fake timers:

- immediate first report;
- 15-minute target boundaries;
- no overlapping cycles;
- overrun and missed-boundary behavior;
- cancellation during collection and waiting;
- configuration reload failure;
- complete NDJSON records;
- child-process cleanup;
- unsupported-host behavior.

### Live canaries

Manual and opt-in only:

- validate gdebenz endpoint sentinel fields;
- validate Yandex pagination and availability structures;
- classify 2GIS as catalogue-readable or challenged;
- never assert that a named station has fuel;
- never run in standard CI;
- obey configured rate limits.

## 17. Trade-offs

### Direct HTTP over browser automation

All current useful data is directly accessible through HTTP. A production browser would add session state, resource cost, and operational fragility without improving availability coverage.

### Pagination over geographic tiling

Bounded pagination is measurable and compatible with the cycle deadline. Tile fan-out would produce redundant requests and potentially infeasible worst-case execution times.

### gdebenz as a first-class but conservatively weighted source

Its JSON transport is clean, while its data remains crowdsourced and its freshness is bucketed. Transport quality therefore does not justify treating its evidence as equal to exact-timestamp Yandex evidence.

### 2GIS as catalogue-only

2GIS materially improves identity matching, anchor resolution, and advertised-grade metadata, but it cannot corroborate live stock.

### Deterministic heuristics over opaque machine learning

Deterministic scoring is explainable, configurable, fixture-testable, and appropriate without a labelled historical dataset. Calibration can later adjust weights without changing interfaces.

### Current-task monitoring over external scheduling

This satisfies the requested lifecycle and avoids external services. It intentionally does not promise monitoring after the host task closes.

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Yandex internal representation changes | Structural validation, contract fixtures, schema-drift health, gdebenz fallback. |
| gdebenz endpoints change | Separate adapter, schema validation, live canary, circuit breaker, Yandex fallback. |
| 2GIS remains challenged | Optional catalogue cache; no availability dependency. |
| Pagination silently repeats or truncates | ID-set repetition detection, explicit page cap, coverage reporting. |
| Nearby stations merge incorrectly | Conservative thresholds, complete-link clustering, brand conflicts, overrides. |
| General gdebenz status becomes AI-95 evidence | Require explicit matching `fuels_now`. |
| Missing freshness appears current | Unknown time has zero current-evidence weight. |
| Branded and plain products are conflated | Concrete product keys and specificity-aware matching. |
| Conflict value loses meaning | Preserve `string | null` and report raw status. |
| Queue presence is mistaken for size | Dedicated non-comparable `PRESENCE` kind. |
| Heuristic probability appears calibrated | Label it estimated availability and show confidence, freshness, and evidence. |
| Monitoring silently becomes detached | Require durable host support and forbid detached processes. |
| Polling burdens services | Cache catalogue data, cap pages, bound concurrency, rate-limit, and use circuit breakers. |

## 19. Legal and operational constraints

The adapters use public but unofficial machine-readable representations. Before distribution, review each service’s current terms, robots policy, and data-use restrictions.

The skill must:

- perform read-only requests;
- minimize request volume;
- avoid CAPTCHA circumvention;
- avoid authentication and browser-session copying;
- avoid bulk redistribution or permanent raw-data archives;
- retain source URL and retrieval time;
- disable raw-response logging by default;
- redact sensitive query values from diagnostics;
- state that fuel can disappear before arrival;
- avoid presenting results as guaranteed or safety-critical.

A legal or operational incompatibility disables only the affected adapter.

## 20. Assumptions and open questions

- No area was supplied. Configuration is invalid until a rectangle, polygon, or at least three unambiguous boundary stations are provided.
- No city-wide default search boundary is invented.
- The gdebenz endpoint paths and fields above form the version-1 adapter contract but remain unofficial.
- `gdebenz.fmask` remains uninterpreted until its bit allocation is verified.
- 2GIS advertised products indicate normal station capability, not current stock.
- Yandex extraction remains dependent on an internal, unversioned server representation.
- Availability percentages are deterministic ranking heuristics, not calibrated probabilities.
- Explicit fuel arguments override defaults for that invocation without rewriting configuration.
- Monitoring continues through source failures and empty results; only an explicit stop ends it.
- Monitoring requires a durable continuation facility in the current Codex host.
- Runtime cache remains outside the skill directory.

## 21. Decision ledger

| Decision | Status | Rationale |
|---|---|---|
| Use modular adapters and deterministic fusion | Adopted | Enables independent testing and partial-source results. |
| Use direct HTTP for all current adapters | Adopted | Current useful data does not require browser execution. |
| Use gdebenz bbox JSON endpoints | Adopted | They provide structured availability data directly. |
| Preserve gdebenz conflict as `string \| null` | Adopted | Avoids losing a meaningful source state. |
| Use bounded-age observation time | Adopted | Represents coarse freshness without inventing timestamps. |
| Treat missing observation time as current-ineligible | Adopted | Fetch time does not establish report freshness. |
| Use queue `PRESENCE` separately from queue size | Adopted | Prevents unknown queue size from entering ordering. |
| Treat 2GIS as catalogue-only | Adopted | It provides no current availability evidence. |
| Use bounded Yandex pagination | Adopted | Provides feasible coverage with explicit completeness. |
| Omit geographic tiling | Adopted | Tiling creates redundant, potentially infeasible request volume. |
| Omit production browser/CAPTCHA fallback | Adopted | It offers no current benefit and adds fragility. |
| Keep fail-closed area resolution | Adopted | Prevents reporting outside the accepted area. |
| Score concrete fuel products independently | Adopted | Prevents branded and plain AI-95 conflation. |
| Separate probability, confidence, freshness, and coverage | Adopted | Communicates distinct evidence properties honestly. |
| Compare queue only when both values are comparable | Adopted | Avoids treating missing data as favourable or unfavourable. |
| Keep monitoring in a durable current task | Adopted | Matches the requested lifecycle. |
| Use a detached daemon or external scheduler | Rejected | Violates current-task ownership. |
| Add offline notifications | Deferred | Requires a separate product and authorization scope. |