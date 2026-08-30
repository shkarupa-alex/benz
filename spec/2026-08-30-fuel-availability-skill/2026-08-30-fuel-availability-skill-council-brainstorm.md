# Fuel availability skill — council specification

Status: design approved by the user on 2026-08-30; implementation has not started.

This document is the implementation source of truth. It incorporates the full council synthesis, pre-mortem mitigations, and subsequent user annotations.

## Status and user overrides

The two council proposals did not reach strict convergence after three rounds. Both preferred direct HTTP collectors, but the user subsequently made a binding design choice: all sources must use `agent-browser` as the runtime access path. This synthesis therefore adopts the council's normalization, safety, confidence, ranking, state, and testing ideas while replacing the transport and monitoring mechanisms.

The design is for a personal, low-frequency, read-only Codex skill. It does not submit reports to sources, bypass CAPTCHAs, or promise that unofficial page structures remain stable.

## Recommended architecture

```text
fuel-watch/
├── SKILL.md
├── config/
│   ├── config.json
│   └── config.schema.json
├── scripts/
│   ├── collect.mjs
│   ├── report.mjs
│   ├── monitor.mjs
│   ├── resolve-area.mjs
│   └── lib/
│       ├── browser-runner.mjs
│       ├── sources/{yandex,gdebenz,twogis}.mjs
│       ├── normalize.mjs
│       ├── fuels.mjs
│       ├── geometry.mjs
│       ├── identity.mjs
│       ├── verdict.mjs
│       ├── queue.mjs
│       ├── ranking.mjs
│       ├── diff.mjs
│       └── state.mjs
└── tests/
    ├── fixtures/
    ├── unit/
    ├── integration/
    └── live/
```

Configuration is intentionally stored beside the scripts, as requested. Temporary monitoring state still contains only the previous tick and current availability runs and is deleted when monitoring stops. Separately, every successful on-demand or monitoring collection appends a compact, automatically pruned seven-day forecast history in the user state directory. It contains neither raw pages nor full observations. Manual station identity overrides remain adjacent configuration rather than learned mutable identity data.

## Responsibilities

- `SKILL.md`: recognize on-demand and monitoring requests, invoke scripts, format the response, and instruct the current agent to run the bounded 15-minute monitoring loop until the user stops it.
- `browser-runner.mjs`: the only source transport. Wrap the `agent-browser` CLI, maintain one ephemeral browser session with one sequentially reused tab per collection run, return structured results, enforce timeouts, and translate browser/challenge failures into typed health records.
- Source adapters: navigate and extract one source. They never perform cross-source matching or confidence decisions and never throw for expected source failures.
- `collect.mjs`: run enabled adapters, isolate failures, normalize data, apply geometry, reconcile stations, compute assessments, write a snapshot, and print JSON.
- `report.mjs`: render a current report and, when a previous snapshot exists, a stable change summary.
- Pure libraries: fuel aliases, geometry, matching, verdicts, queue normalization, ranking, and diffing.

## Browser-first source collection

### Common browser contract

```ts
type SourceId = "yandex" | "gdebenz" | "2gis" | "benzonavt";

interface BrowserRunner {
  ensureRunSession(): Promise<BrowserSession>;
  open(url: string): Promise<{ finalUrl: string; pageTextPrefix: string }>;
  waitReady(condition: ReadyCondition): Promise<void>;
  evalJson<T>(expression: string): Promise<T>;
  snapshot(): Promise<BrowserSnapshot>;
  close(): Promise<CleanupResult>;
}

interface SourceAdapter {
  readonly id: SourceId;
  readonly capability: "CURRENT_GRADE" | "CURRENT_FAMILY" | "CATALOG_ONLY" | "CHALLENGE_ONLY";
  collect(request: CollectorRequest, ctx: CollectContext): Promise<SourceResult>;
}

interface CollectorRequest {
  area: ResolvedArea;
  requestedProducts: RequestedProductsConfig;
  fetchedAt: string;
  deadlineAt: string;
}

interface CollectContext {
  browser: BrowserRunner;
  previous?: MonitoringSnapshot;
  config: RuntimeConfig;
}

interface SourceResult {
  source: SourceId;
  health: SourceHealthRecord;
  stations: SourceStation[];
  observations: FuelObservation[];
  queues: QueueObservation[];
  activity: ActivityEvidence[];
}

interface BrowserSession { namespace: string; sessionName: string; }
interface ReadyCondition { anyOfSelectors: string[]; urlRejectPatterns: string[]; timeoutMs: number; }
interface BrowserSnapshot { url: string; title: string; textPrefix: string; }
interface CleanupResult { sessionsRemaining: number; warnings: string[]; }
interface ResolvedArea { label: string; polygon: Array<[number, number]>; areaHash: string; }
```

Exactly one named session exists inside a namespace owned by one collection run. The same tab visits the enabled sources sequentially to minimize memory. The session is never kept alive between on-demand runs or monitoring ticks.

Because browser-only access is a deliberate common dependency, each tick begins with a browser-runtime health probe. The runner enforces a process/session budget, closes orphaned sessions in its own namespace, recreates one failed session once, and reports a browser-wide failure separately from source-specific failures. During active monitoring only, the previous tick may be shown as last-known data with its real age and never as current evidence.

### Browser lifecycle and memory contract

Every on-demand collection and every monitoring tick is a bounded browser transaction:

1. Create a unique namespace such as `fuel-watch-<runId>`.
2. Launch one source session with `--idle-timeout 10s`; never start the agent-browser dashboard, streaming, video, tracing, or persistent restore state.
3. Collect from the enabled sources.
4. In a top-level `finally`, close the run session.
5. Run namespace-scoped `close --all` only as a fallback inside that owned namespace.
6. Verify `session list --json` is empty for the namespace.
7. Return success only after cleanup verification; a cleanup failure is surfaced separately from collection health.

The runner starts from an environment allowlist, not a hand-maintained denylist. It removes every inherited variable whose name starts with `AGENT_BROWSER_` or `AI_GATEWAY_`, plus `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` and lowercase equivalents. It then sets only the pinned executable/config values needed by this skill: owned namespace, unique session name, `AGENT_BROWSER_IDLE_TIMEOUT_MS=10000`, the feasibility-verified allowed domains, and the skill-owned config path. This prevents inherited engine, executable, output-limit, proxy, persistence, or interactive-confirmation settings from silently changing extraction.

Collection has a bounded cleanup reserve of 20 seconds outside the adapter deadline. A valid snapshot accompanied by cleanup failure is still rendered, but the report is marked `CLEANUP_FAILED`, the command exits with code 75, and `SKILL.md` must warn the user and run one more namespace-scoped cleanup verification before proceeding or waiting.

The scripts never issue a global `agent-browser close --all` outside their owned namespace. `SIGINT`, `SIGTERM`, user cancellation, adapter timeout, CAPTCHA, and thrown internal errors all pass through the same cleanup path. A hard process kill is covered by the 10-second daemon idle timeout. Monitoring stop also retries cleanup for the last recorded owned namespace before confirming completion.

Runtime extraction uses page DOM or JavaScript evaluated in the loaded origin. HAR/network recording is a development and repair tool only because persistent HAR files can contain cookies and other sensitive metadata.

### Yandex Maps

1. Open a minimal Volgograd search URL containing only the search text, fuel filters, center/viewport, and pagination parameters needed for the configured area.
2. Wait until station result nodes or the server state script exists.
3. Extract station cards and structured `fuelAvailability` fields using `agent-browser eval` from the loaded page.
4. Collect station ID, coordinates, title, address, per-grade status, grade-owned timestamps/counts when present, station-level `lastSignalTimestamp`/`signalsCountPerHour`, queue status/label, and source URL. Never assign container-level time/count to a grade: the live container can be refreshed by diesel while an AI-95 status is old. Aggregate time remains station/queue context only. When no row owns a timestamp, return the declared limitation `PARTIAL/NO_GRADE_FRESHNESS_METADATA` with `freshnessExpected=false`; do not misreport a completeness regression and do not let the statuses affect the current verdict.
5. Traverse additional pages or scroll batches until an empty/repeated station-ID set or a configured cap. Never stop merely because a page is shorter than an expected page size.
6. Emit `SCHEMA_CHANGED`, `TRUNCATED`, `CHALLENGE`, or `TIMEOUT` explicitly; never convert parser failure into an empty result.

Completeness invariants include minimum fuel-block coverage, timestamp coverage, coordinate coverage, duplicate ratio, station-count baseline for the configured area, and evidence that pagination terminated naturally. A material regression marks the result `PARTIAL` or `SCHEMA_CHANGED`; rankings from partial coverage are labelled incomplete.

Station enumeration is independent of positive availability: the adapter must first account for all station cards/IDs in the configured area and only then attach statuses. This distinguishes an all-negative result from incomplete extraction.

Yandex is expected to be the strongest current-availability and queue source, but it remains an unofficial page representation and is not treated as guaranteed telemetry.

### gdebenz

1. Navigate the run's browser tab to `https://gdebenz.ru/`.
2. Wait for the application to initialize.
3. Use browser-evaluated same-origin JavaScript or the page's already-loaded state to retrieve the station data for the configured bounding box. This is still browser-mediated runtime access and avoids a separate direct HTTP transport.
4. Normalize station IDs, coordinates, name/brand/address, general status, grade-specific fields, freshness bands/timestamps, conflict indicators, and queue-presence signals when exposed.
5. Preserve unknown raw fields as provenance. Do not assume an undocumented freshness-band order until fixtures or cross-source observations validate it.

The automated browser previously received a transient page displaying `502` while the user's normal browser worked. Because the required browser CLI contract does not expose response status, the adapter recognizes only a fixture-validated 502 error-page title/body sentinel. That sentinel is retried once in-session and reported as `HTTP_ERROR`; an arbitrary load failure is not guessed to be HTTP 502.

Grade-blind positive or negative reports never become direct evidence for a specific grade. A source that cannot represent premium AI-95 cannot directly confirm or deny `AI95_PREMIUM`.

### 2GIS

1. Navigate the run's browser tab to a simplified petrol-station search URL.
2. Wait for result cards and inspect station details needed for identity, offered grades, and any current status/queue data visible in the page.
3. Detect `/captcha`, `/museum`, reCAPTCHA text, challenge forms, or a repeated redirect as `CHALLENGE`.
4. Never solve, click through, or bypass CAPTCHA automatically. The report names the source as unavailable for that tick.
5. Static catalogue claims such as "this station normally offers AI-95" have zero current-availability weight. Only explicitly current data with usable freshness metadata becomes an availability observation.

The official 2GIS API is deferred because the user chose one unified `agent-browser` transport. It can be reconsidered later as an optional adapter if the user prefers a registered API key and a stable contract.

### Benzonavt

1. Navigate to `https://benzonavt.ru/` in its ephemeral browser session.
2. Use browser-evaluated same-origin `GET /api/v1/stations?bbox=…`, which is the transport used by the loaded page; do not add an external HTTP client.
3. Normalize stable numeric station ID, coordinates, brand/address, `st.status`, `st.fuels_now`, `st.updated_at`, `st.conflict`, and queue metadata.
4. Treat `fuels_now` as the exhaustive current list: an explicit `95` token is exact current-grade evidence; `st.status=no` or a nonempty current list without any 95 token is family-wide negative evidence. An empty list with a non-negative station status remains unknown. Static `fuels` assortment and prices never prove current availability.
5. Until `st.conflict` semantics are formally validated, any row carrying it emits only `UNCERTAIN` fuel evidence with both raw sides preserved. It cannot recommend a station or establish family-wide absence, regardless of which side says yes/no.
6. Normalize live queue shape `{at,size,until}`: `20_50 → LONG`, `gt50 → VERY_LONG`, and use `queue.at` rather than the fuel timestamp.
7. Keep Benzonavt in the same default `crowd-shared` provenance group as Yandex/gdebenz so correlated crowd data cannot manufacture independent-source confidence.

All four adapters are enabled by default in order `yandex`, `gdebenz`, `2gis`, `benzonavt`, so the strongest expected evidence is collected first under the shared deadline. A source can be disabled in adjacent config. Before release, live feasibility records every required first-party/resource domain for each adapter; a missing allowlisted CDN/resource is `RESOURCE_BLOCKED`, not `SCHEMA_CHANGED`.

## Data model

```ts
type AvailabilityStatus =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "LIMITED"
  | "UNCERTAIN"
  | "UNKNOWN";

type ObservationTime =
  | { kind: "EXACT"; observedAt: string }
  | { kind: "BOUNDED_AGE"; minMinutes: number; maxMinutes: number }
  | { kind: "UNKNOWN" };

interface FuelProduct {
  family: "AI_92" | "AI_95" | "AI_98" | "AI_100" | "DIESEL" | "LPG" | "OTHER";
  variant: "BASE" | "BRANDED" | "PREMIUM" | "UNKNOWN";
  variantKey?: string;
  displayLabel: string;
  specificity: "EXACT_VARIANT" | "FAMILY_ONLY";
}

interface FuelObservation {
  source: SourceId;
  sourceStationId: string;
  product: FuelProduct;
  status: AvailabilityStatus;
  time: ObservationTime;
  signalsPerHour?: number;
  rawStatus: string;
  conflict?: { raw: unknown };
  fetchedAt: string;
  provenanceUrl: string;
}

interface QueueObservation {
  source: SourceId;
  sourceStationId: string;
  time: ObservationTime;
  kind: "VEHICLES" | "ORDINAL" | "PRESENCE" | "TEXT";
  vehicleCount?: number;
  ordinal?: "NONE" | "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";
  rawValue: string;
}

interface AvailabilityRun {
  stationKey: string;
  productKey: string;
  state: "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";
  firstObservedAt: string;
  lastConfirmedAt: string;
  transitionWindow?: { after: string; atOrBefore: string };
  basis: "OBSERVED_TRANSITION" | "FIRST_SEEN" | "SOURCE_REPORTED";
}

interface ActivityEvidence {
  source: SourceId;
  sourceStationId: string;
  product?: FuelProduct;
  gradeLabel?: string;
  kind: "TRANSACTIONS_RESUMED" | "TRANSACTIONS_ONGOING" | "RECENT_SIGNAL" | "ROLLING_SIGNAL_COUNT" | "PETROL_STATUS_SNAPSHOT" | "NONE";
  status?: AvailabilityStatus;
  eventTimes: string[];
  observedAt?: string;
  latestEventAt?: string;
  windowMinutes?: number;
  count?: number;
  precedingGapMinutes?: number;
  gradeSpecific: boolean;
  sourceTerminology: "TRANSACTION" | "REPORT" | "SIGNAL" | "STATUS";
}

interface NormalizedQueue {
  comparable: boolean;
  vehicleCount?: number;
  ordinal?: "NONE" | "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";
  displayText: string;
  freshestAgeMinutes?: number;
  observations: QueueObservation[];
}

interface RequestedProduct {
  productKey: string;
  family: "AI_95";
  variant: "BASE" | "BRANDED" | "PREMIUM";
  variantKey: string;
  aliases: string[];
}

interface RequestedProductsConfig {
  mode: "UNION";
  products: RequestedProduct[];
  includeUnrecognizedAi95Variants: boolean;
}

interface RuntimeConfig {
  area: AreaConfig;
  requestedProducts: RequestedProductsConfig;
  sources: Array<{ id: SourceId; enabled: boolean; order: number; provenanceGroup: string }>;
  monitoring: MonitoringConfig;
  freshness: FreshnessConfig;
  activity: ActivityConfig;
  queue: QueueConfig;
  identity: IdentityConfig;
  ranking: RankingConfig;
}

interface MonitoringConfig { intervalMinutes: 15; waitChunkSeconds: number; compactAfterEmptyTicks: number; }
interface FreshnessConfig { freshMinutes: number; recentMinutes: number; staleMinutes: number; expireMinutes: number; futureSkewSeconds: number; conflictWindowMinutes: number; }
interface ActivityConfig { quietGapMinutes: number; resumeWindowMinutes: number; minimumEvents: number; }
interface QueueConfig { ordinalMaxVehicles: Record<"NONE" | "SHORT" | "MEDIUM" | "LONG", number>; unknownPosition: "AFTER_KNOWN"; }
interface IdentityConfig { maxCoordinateDriftMeters: number; ambiguityMargin: number; brandAliases: Record<string, string[]>; streetDictionary: Record<string, string[]>; manualOverrides: IdentityOverride[]; }
interface RankingConfig { referencePoint?: [number, number]; sourcePriority: SourceId[]; }
interface IdentityOverride { stationKey: string; members: Array<{ source: SourceId; sourceStationId: string }>; }

interface SourceHealthRecord {
  source: SourceId;
  status: "OK" | "PARTIAL" | "CHALLENGE" | "SCHEMA_CHANGED" | "TIMEOUT" | "HTTP_ERROR" | "RESOURCE_BLOCKED" | "DISABLED";
  code?: string;
  message?: string;
}

interface ExecutionWarning { code: "CLEANUP_FAILED" | "PARTIAL_COVERAGE" | "RECOVERED_PUBLICATION"; message: string; }
interface ExecutionEnvelope { snapshot?: MonitoringSnapshot; sourceHealth: SourceHealthRecord[]; warnings: ExecutionWarning[]; exitCode: 0 | 2 | 75; }
```

`config.schema.json` mirrors these interfaces with `additionalProperties: false`, unique source IDs/orders/product keys, coordinate bounds, positive monotonic freshness thresholds, `waitChunkSeconds <= 50`, `intervalMinutes = 15` by default, at least one requested AI-95 product, aliases unique after normalization, and manual-override members unique across station keys. Configuration is validated before any browser starts; invalid config fails closed with a human-readable path.

Fetch time is provenance and never substitutes for observation time.

The default fuel query is a union of `AI_95` base and all configured branded/premium AI-95 variants. Plain AI-95 and each specific premium variant remain distinct products internally. A family-only observation may support the broad family query but cannot prove a particular branded variant.

Default `requestedProducts` contains `AI95_BASE` (`АИ-95`, `АИ 95`, `95`), plus configured branded variants such as `AI95_ECTO`, `AI95_GDRIVE`, `AI95_PULSAR`, `AI95_VPOWER`, `AI95_ULTIMATE` and `AI95_PREMIUM_GENERIC`. The exact brand list is editable in `config.json`; it is data, not hard-coded parser logic. Fuel labels are normalized with Unicode NFKC, lowercase conversion, `ё→е`, Latin/Cyrillic homoglyph folding for the letters used in fuel labels, dash/underscore normalization, punctuation removal, and whitespace collapse. The matcher first requires an AI-95 family token, then chooses the longest exact configured alias. An unrecognized label that clearly belongs to AI-95 is classified as `BRANDED/UNKNOWN`, included in the default union because `includeUnrecognizedAi95Variants` is true, and never presented as a known named variant.

The shipped aliases are at minimum: base (`аи 95`, `95`), Ecto (`экто`, `ecto`), G-Drive (`g drive`, `g-drive`), Pulsar (`пульсар`, `pulsar`), V-Power (`v power`, `v-power`), Ultimate (`ultimate`, `ультимейт`), and generic premium (`премиум`, `premium`). Each row is combined only with an AI-95 family token; a bare marketing word is never enough. New regional brand labels are added to config without changing code.

Union assessment is explicit: any fresh positive exact member makes the union positive unless opposed by a fresh direct negative for that same exact member; negatives for one variant do not negate a positive different variant. The union is `НЕТ` only when fresh direct evidence covers every configured member, or a source explicitly reports family-all AI-95 unavailable. Family-only positive evidence yields at most `СКОРЕЕ ЕСТЬ`; family-only negative evidence cannot negate a fresh exact positive. Verdict rules are evaluated top-down, first match.

## Area configuration

```ts
type AreaConfig =
  | { kind: "rectangle"; south: number; west: number; north: number; east: number }
  | { kind: "polygon"; coordinates: Array<[number, number]> }
  | {
      kind: "station-anchors";
      anchors: Array<{ label: string; sourceId?: string; point: [number, number] }>;
      boundary: "convex-hull";
      bufferMeters: number;
      unresolvedPolicy: "fail-closed";
    };
```

Rectangle is the simple editing format. When the user supplies outermost acceptable stations, `resolve-area.mjs` looks them up through the browser adapters, presents the resolved coordinates for confirmation, then writes schema-valid `point: [lon, lat]` anchors. At least three unique non-collinear anchors are required. Runtime area construction pins `@turf/turf` 7.2.0 and applies `convex(featureCollection(points))`, then `buffer(hull, 0.5, {units: "kilometers", steps: 16})`; membership uses `booleanPointInPolygon(point, polygon, {ignoreBoundary: false})`. Coordinates are rounded only for display, never before geometry.

The initial Volgograd default uses the thirteen user-provided stations below and `bufferMeters: 500`. Read-only Yandex Maps resolution produced these `[lon, lat]` coordinates; implementation revalidates them fail-closed before any later rewrite:

```json
[
  { "label": "Череповецкая ул., 5А", "point": [44.4825478, 48.7042007] },
  { "label": "Ангарская ул., 131Б", "point": [44.4447156, 48.7196496] },
  { "label": "Ангарская ул., 162", "point": [44.4590447, 48.7292752] },
  { "label": "ул. Хорошева, 65А", "point": [44.4760565, 48.7362504] },
  { "label": "просп. Маршала Жукова, 94А", "point": [44.4925045, 48.7393615] },
  { "label": "ул. Рокоссовского, 129Ж", "point": [44.5238774, 48.7307008] },
  { "label": "ул. Рокоссовского, 80А", "point": [44.530817, 48.733956] },
  { "label": "ул. Рокоссовского, 175", "point": [44.525837, 48.748086] },
  { "label": "ул. Пархоменко, 57А", "point": [44.5262303, 48.7235710] },
  { "label": "Глубокоовражная ул., 25", "point": [44.4975444, 48.7076565] },
  { "label": "Симбирская ул., 1Б", "point": [44.4961665, 48.7060969] },
  { "label": "Социалистическая ул., 43", "point": [44.4859626, 48.6943282] },
  { "label": "Череповецкая ул., 21А", "point": [44.4722727, 48.6980531] }
]
```

The convex hull is derived from all thirteen points. Interior anchors remain in config for traceability and later revalidation rather than being discarded after hull construction.

Two additional test stations were checked through `agent-browser`. The supplied 2GIS pages returned CAPTCHA, so coordinates were resolved through browser-mediated Nominatim and compared with the unbuffered hull:

- Ангарская ул., 8А: `[44.4940448, 48.7150466]` — inside the unbuffered hull;
- ул. Рокоссовского, 4Б: `[44.4925455, 48.7101139]` — inside the unbuffered hull.

Both therefore remain inside after the 500-metre outward buffer as well.

Geometry validation rejects reversed bounds, self-intersections, invalid coordinates, and implausibly large areas. Boundary points count as inside.

The representative station coordinate is chosen from the highest identity-confidence observation, then source priority, then freshest observation, with median coordinates used only among tied observations. Area filtering happens after conservative identity reconciliation; an unresolved or ambiguous source station is filtered on its own coordinate. The completeness baseline key includes `sourceId`, `areaHash`, and adapter-contract hash, expires after 90 days, and is never updated from a partial/failed run. A changed area or contract starts with no baseline rather than reusing the previous scope.

Resolved anchor station keys are always included even if a later source coordinate moves a few metres outside the stored hull. This prevents the user's explicitly named outermost station from disappearing because of harmless coordinate drift without silently expanding the entire polygon.

## Station identity

Prefer explicit source IDs and configured identity overrides. Otherwise match conservatively using geographic distance plus normalized brand/name/address, with a one-to-one assignment per source. A coordinate difference of 50–100 metres is tolerated as possible source imprecision but is never sufficient to merge records: nearby stations can genuinely be that close. Conflicting known brands are a hard reject. Ambiguous matches remain separate; a duplicate row is safer than combining observations from different stations.

Automatic merges additionally require address-number agreement when present and a clear margin over the second-best candidate. Queue observations are never transferred across a probabilistic match below the highest match-confidence tier. Every merge stores its provenance and match confidence for later inspection.

Manual cross-source identity overrides are stored in adjacent configuration with source IDs and addresses. No learned registry is accumulated across completed monitoring sessions.

Canonical merged fields are deterministic: manual override values first; otherwise the observation with the strongest identity evidence, then configured source priority, then freshness, then lexical source ID. The stable key is `manual:<id>` when overridden, else a sorted hash of explicit source-ID members. Before a cross-source merge exists, fallback is `source:<source>:<sourceStationId>`; if a source supplies no station ID, use a hash of normalized brand + normalized address + coordinate geohash. Collisions receive a deterministic suffix from the full source URL/coordinate tuple and are emitted as an identity warning. Medium-confidence coordinate drift preserves continuity only when source ID is unchanged; it never authorizes a new cross-source merge.

```ts
interface SourceStation {
  source: SourceId;
  sourceStationId?: string;
  title?: string;
  brand?: string;
  address?: string;
  coordinate: [number, number];
  provenanceUrl: string;
}

interface StationAssessment {
  stationKey: string;
  title: string;
  brand?: string;
  address?: string;
  coordinate: [number, number];
  verdict: "AVAILABLE" | "LIKELY_AVAILABLE" | "CONFLICTING" | "INDIRECT" | "NOT_AVAILABLE" | "NO_FRESH_DATA";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  queue: NormalizedQueue;
  observations: FuelObservation[];
  activity: ActivityEvidence[];
}
```

## Freshness and confidence

Do not expose an uncalibrated percentage as if it were a real probability. The report uses auditable categorical verdicts and confidence:

- verdict: `ЕСТЬ`, `СКОРЕЕ ЕСТЬ`, `ПРОТИВОРЕЧИВО`, `КОСВЕННО`, `НЕТ`, `НЕТ СВЕЖИХ ДАННЫХ`;
- confidence: `высокая`, `средняя`, `низкая`, `нет`;
- every claim includes signal age or an explicit statement that age is unknown;
- approximate ages carry `≈`.

Default freshness bands, configurable beside the scripts:

- fresh: at most 45 minutes;
- recent: more than 45 and at most 180 minutes;
- stale: more than 180 and at most 360 minutes;
- expired: more than 360 minutes;
- unknown time: cannot independently qualify a station as currently available.

Per (station, requested product), ignore expired evidence for the current verdict but keep it visible in provenance. Direct grade-specific evidence dominates inferred or family-only evidence. Opposing fresh direct observations inside a 30-minute conflict window produce `ПРОТИВОРЕЧИВО`, not a confident winner. A clearly newer direct observation may supersede an older one.

`UNKNOWN` evidence never increases confidence. Multiple agreeing sources increase confidence only when their provenance groups are configured as meaningfully independent; Yandex and gdebenz must not automatically be assumed independent merely because they are different websites. A single source can reach high confidence only when it supplies exact fresh timing plus a configured strong signal count; otherwise it is capped at medium.

Base confidence is selected by the highest matching row: at least one fresh exact direct observation is `MEDIUM`; multiple agreeing observations inside one provenance group remain `MEDIUM`; fresh grade-specific resumption with sufficient timeline evidence is `MEDIUM`; family-unspecified or inferred positive evidence is `LOW`; unknown-time or expired evidence is `NONE`. `HIGH` is an upgrade from `MEDIUM` only for two agreeing fresh direct observations from independent configured provenance groups, or one exact fresh direct observation accompanied by the configured strong grade-specific signal count. A matching lower row never downgrades a higher base row.

The full verdict/confidence table is finite and exhaustively tested.

Until real outcomes have been collected, the report calls the ordering **rule-based evidence ranking**, not estimated probability. No long-term calibration log is retained.

### When the requested fuel appeared

Data freshness and availability-run age are separate signals. A recent source timestamp proves only that the status was checked recently; it does not prove a tanker delivered fuel at that moment.

During active monitoring, the temporary previous-tick state tracks uninterrupted availability runs per `(stationKey, productKey)`. An on-demand run uses a source-provided transaction/event timeline when available and otherwise has no prior-run history:

- previous tick `NOT_AVAILABLE`, current tick `AVAILABLE`: report an interval such as "появился между 15:15 и 15:30";
- previous tick `UNKNOWN`, current tick `AVAILABLE`: report "впервые увидели в наличии в 15:30", not "появился в 15:30";
- consecutive `AVAILABLE` ticks: report "наблюдаем в наличии не менее N минут/часов";
- a source-provided explicit transition time may be used as `SOURCE_REPORTED` and is labelled with its source;
- no history and no source transition time: report "время появления неизвестно".

Short contradictory gaps do not automatically reset the run: a configurable two-tick confirmation rule prevents one flaky source from fabricating repeated "new delivery" events. Raw transitions remain in provenance.

An `OBSERVED_TRANSITION` may open only from verdict `AVAILABLE`, or `LIKELY_AVAILABLE` with at least `MEDIUM` confidence. A low-confidence positive tick is tracked as `FIRST_SEEN` and cannot produce the factual phrase “появился между …”. Every appearance/run-age sentence carries the current confidence label. Closing an established run still requires two consecutive negative ticks; `UNKNOWN` does not close it.

### Transaction or signal resumption

Where a service exposes recent grade-specific transactions, reports, or signals, the adapter preserves the event times and the source's own terminology. The skill never renames a generic crowd signal to a payment transaction.

For the requested grade, `TRANSACTIONS_RESUMED` means a configurable long quiet gap (default 60 minutes) followed by at least two new events inside a short window (default 20 minutes). This is the strongest positive heuristic: fuel was apparently unavailable or inactive, then grade-specific activity restarted and may not yet have accumulated a large queue. `TRANSACTIONS_ONGOING` is weaker but still stronger than a status-only claim. Aggregate station activity that cannot be tied to AI-95 may support freshness or demand context but cannot prove AI-95 availability.

Across either monitoring ticks or repeated on-demand runs, a change from zero recent grade-specific events to new events can establish the resumption window even if the source exposes only a rolling count and latest timestamp. A single cold run cannot establish the preceding gap. Monitoring is not required for persistence, but its 15-minute cadence is recommended because sparse manual runs can miss rolling-count transitions.

Rolling summaries are represented separately from event timelines: `{observedAt, windowMinutes, count, latestEventAt, product, observationRefs}`. A `0 → positive` change can establish resumption only when consecutive summaries have the same source/station/product/window and the prior window spans the configured quiet gap; otherwise it is merely `RECENT_SIGNAL`. Future timestamps beyond the configured skew are rejected, and all derived activity retains links to the underlying observations.

## Queue normalization and ranking

Comparable queue data is ordinal or a vehicle count. A presence-only signal renders as "очередь есть, размер неизвестен" and is excluded from shortest-queue comparisons. Unknown queue data is not silently treated as zero.

When two queues expose comparable exact vehicle counts, the smaller exact count sorts first before ordinal fallback. Ordinal bands are used only when exact counts are unavailable. Unknown/incomparable queue remains after all known bands by default; this conservative position is configurable but is not interpreted as evidence of a long queue.

Stations without positive current evidence are excluded from the primary recommendation list. Rank positive stations lexicographically:

1. grade-specific transaction/activity resumption (`TRANSACTIONS_RESUMED` first, then `TRANSACTIONS_ONGOING`, then status-only);
2. number and quality of services currently supporting availability;
3. confidence and directness of the grade-specific evidence;
4. observation freshness;
5. comparable queue size when supplied;
6. recency of the current availability run;
7. distance from a configured reference point or area centroid;
8. stable station key.

This avoids invented arithmetic between availability, queue, freshness, and distance while matching the user's stated priority. Negative, conflicting, and no-data stations may be summarized separately but are never recommended as places to drive.

Queue is desirable but secondary to positive availability, multi-source support, transaction resumption, and freshness. The report labels transaction resumption as a heuristic for a potentially smaller queue, never as a measured queue. `FIRST_SEEN` is weaker than a confirmed `OBSERVED_TRANSITION` and cannot receive the same boost.

## User-facing modes

### On demand

The skill runs `collect.mjs`, then `report.mjs`, and posts one report into the current task. If one source fails, remaining sources still produce a result. If every source fails, the skill reports a degraded run rather than "no petrol".

### Monitoring

Monitoring remains inside the currently running agent task and does not create an automation or daemon:

1. Run and publish one immediate collection.
2. Close and verify cleanup of the browser transaction.
3. Wait until the next 15-minute due time using foreground chunks no longer than 50 seconds, checking for new user input or a stop request between chunks.
4. Run the next collection with a fresh ephemeral browser transaction.
5. Compare only with the previous tick, publish the summary, and repeat.

The concrete wait primitive is a foreground shell `sleep` of at most 45 seconds per chunk. After every chunk the active agent checks newly delivered task input and a `STOP` sentinel in the monitor directory. It never issues one 15-minute sleep or keeps a browser/process alive during the interval. There is no fixed duration cap: monitoring runs until the user stops it or the active task is externally interrupted; an external interruption is reported when execution resumes.

`monitor.mjs init` creates `${TMPDIR}/fuel-watch/<monitorId>/`, prints the immutable `monitorId` and absolute state path, and acquires an atomic lease file. Every state command receives that explicit directory through `--state-dir`; no process scanning is used. The active agent retains the handle in the current task context. Re-entry runs `monitor.mjs recover --state-dir <path>` before checking `dueAt`; an expired lease may be reclaimed only by the same monitor ID, while a live lease rejects a concurrent start. The lease stores no PID assumption, is refreshed at each chunk/tick, and expires after twice the monitoring interval. `STOP` is checked before lease refresh. Cleanup removes the whole task-scoped directory.

```ts
interface MonitoringSnapshot {
  schemaVersion: 1;
  fetchedAt: string;
  areaHash: string;
  queryHash: string;
  assessments: StationAssessment[];
  sourceHealth: SourceHealthRecord[];
}

interface MonitorState {
  schemaVersion: 1;
  monitorId: string;
  generation: number;
  dueAt: string;
  previous?: MonitoringSnapshot;
  availabilityRuns: AvailabilityRun[];
  consecutiveEmptyTicks: number;
  pending?: { reportId: string; snapshotPath: string; nextStatePath: string };
}
```

Outside the temporary monitor directory, `collect.mjs` maintains a compact seven-day history in the user's state directory (or an explicit `--history` path) for both on-demand and monitoring runs. It stores only timestamp, scope hashes, station metadata, every explicit `source:sourceStationId` member, union/per-product verdicts, and grade labels plus rolling window/count/latest-event summaries. Raw pages, HARs, and full observations are not retained. History continuity is resolved by transitive member-ID overlap, so `merged:A+B → source:B → merged:A+B` remains one physical station even without `--previous`. Entries older than seven days are removed on every successful collection, and duplicate retries for the same `fetchedAt`/scope replace rather than duplicate a tick.

The global history read–modify–write is serialized by `proper-lockfile` using an atomic sibling lock directory, a five-second acquisition bound, and a 30-second stale lease maintained by heartbeat. No second persistent reclaim lock exists, so a reclaimer crash cannot permanently wedge history. On upgrade, dead legacy file-form `.lock` and `.lock.reclaim` owners from the previous implementation are removed before acquisition; a live legacy PID remains protected. The lock covers read, pruning, append, forecast calculation, and atomic rename and is released in `finally`. Concurrent collectors therefore retain every tick. A lock timeout surfaces as `HISTORY_UNAVAILABLE`/`HISTORY_LOCK_TIMEOUT` without suppressing the current collection report.

Forecast training uses general petrol-delivery candidates from gasoline grades 92/95/98/100. Diesel is explicitly excluded because its near-continuous availability would bias the sought petrol-restocking pattern; LPG and unrecognized grades are excluded as well. A true per-grade rolling-summary event has highest priority and requires the same source/station/grade/window in consecutive samples, a previous zero count whose window spans the configured quiet gap, and a current count of at least two with a recent latest-event timestamp. A station-level aggregate count must never be copied onto grades or used to raise a grade's confidence: live Yandex evidence on 2026-08-30 showed `signalsCountPerHour` and `lastSignalTimestamp` only on the `fuelAvailability` container, while each 92/95/98/100/DIESEL row contained only `fuelType`, `localizedName`, and `status`; the aggregate is therefore ineligible because diesel cannot be removed from it. With the current source shape, the primary available delivery candidate is a sampled petrol-status transition `OUT_OF_STOCK → IN_STOCK/LIMITED`; multiple gasoline grades changing in one tick raise confidence. Observed union `NOT_AVAILABLE → AVAILABLE` transitions provide a weaker outage-duration fallback. All event types remain tanker-arrival heuristics and do not prove the delivered product mix. The forecast estimates typical Moscow-local time of day from at least two events, in order of same station, normalized brand, then area. Gaps longer than three tick intervals break transition continuity. The report gives a point estimate, interquartile window, signal type, scope, sample size, and confidence, and emits no invented time without enough history.

`report.mjs` alone creates `reportId = sha256(monitorId + generation + snapshotHash)` and renders the report. Then `monitor.mjs prepare --report-id ...` writes an immutable pending next-state file without changing committed state. After the active agent posts that report into this task, `monitor.mjs commit --report-id ...` atomically advances the generation. Recovery re-renders a pending report with the same ID and labels it “повтор после восстановления”; it never invents a new ID. `collect.mjs` does not derive or commit monitor state. A changes section is suppressed whenever `areaHash` or `queryHash` differs from the previous snapshot.

After four consecutive ticks with no fresh grade-specific observation from any source, monitoring remains active to respect the requested cadence but switches repeated null reports to a compact degraded summary. It never floods the task with a full identical empty report.

## Output

Each summary contains:

1. timestamp, area label, and requested grades;
2. source/runtime health (`OK`, `PARTIAL`, `CHALLENGE`, `SCHEMA_CHANGED`, `RESOURCE_BLOCKED`, `TIMEOUT`, `HTTP_ERROR`, `CLEANUP_FAILED`, `DISABLED`), always naming any service blocked by CAPTCHA or another failure;
3. changes since the previous tick;
4. ranked positive and likely-positive stations;
5. conflicting/indirect evidence;
6. counts of negative and no-fresh-data stations;
7. up to three nearest forecasted appearances from the seven-day history, or an explicit cold-start/insufficient-data message;
8. an unconditional warning that reports are crowdsourced/page-derived and may be delayed.

Example row:

```text
1. Лукойл · [ул. Рокоссовского, 1Р](https://yandex.ru/maps/38/volgograd/search/%D1%83%D0%BB.%20%D0%A0%D0%BE%D0%BA%D0%BE%D1%81%D1%81%D0%BE%D0%B2%D1%81%D0%BA%D0%BE%D0%B3%D0%BE%2C%201%D0%A0%2C%20%D0%92%D0%BE%D0%BB%D0%B3%D0%BE%D0%B3%D1%80%D0%B0%D0%B4/)
   95: ЕСТЬ (средняя, 8 мин) · 95+: НЕТ (средняя, 12 мин)
   очередь: большая · 95 появился между 15:45 и 16:00 (средняя уверенность)
   источник: Яндекс · статус обновлён 16:15
```

Every rendered station address is a Yandex Maps link: use the reconciled `[lon, lat]` as an exact map pin when available and a strict RFC3986-encoded Volgograd address search only as fallback, including percent-encoding parentheses that would otherwise terminate a Markdown destination. This applies to ranked recommendations, forecasts, and changed-station rows. No availability claim is rendered without confidence and freshness information. Repeat-report diffs compare verdict, confidence, and queue transitions, not rank movement or harmless age drift inside the same freshness band.

## Failure isolation

Adapters return typed health instead of throwing for expected failures:

- `NETWORK`, `TIMEOUT`, `HTTP_ERROR_PAGE`, `CHALLENGE`, `RESOURCE_BLOCKED`, `BODY_TOO_LARGE`, `SCHEMA_CHANGED`, `TRUNCATED`, `EMPTY_RESULT`, `ABORTED`, `INTERNAL_ADAPTER_ERROR`.

`EMPTY_RESULT` and `SCHEMA_CHANGED` are never conflated. A challenge opens no bypass workflow. One failed source never cancels the remainder of the sequential collection. The browser session is recreated once after a bounded browser-level failure; repeated challenge/4xx responses open a per-source circuit for the current tick and are named in the report.

Monitoring does not auto-stop merely because data is degraded. It continues at the requested cadence and makes degradation prominent until the user stops monitoring.

## Testing and repairability

- Pure unit tests for fuels, geometry, identity, verdicts, queues, ranking, and diffs.
- Recorded, redacted browser-extraction fixtures for all source adapters; no network in unit tests.
- Contract tests against a fake `BrowserRunner` so adapter logic is independent of the CLI process.
- Integration tests with an installed `agent-browser` using local fixture pages.
- Environment-isolation integration test injecting `AGENT_BROWSER_MAX_OUTPUT=1024`, `AGENT_BROWSER_ENGINE=lightpanda`, and `AGENT_BROWSER_EXECUTABLE_PATH=/bin/false` and proving that the skill-owned allowlist makes the run unaffected.
- Browser-wide outage, orphan cleanup, 50-second wait chunking, user-stop interruption, and temporary-state deletion tests.
- A repeated-run soak test executes at least 20 collection cycles and asserts that no owned sessions remain after each cycle and that browser/daemon RSS does not trend upward beyond a defined tolerance after cleanup.
- Opt-in live smoke tests for each source; never run automatically every 15 minutes.
- Challenge, 502, empty page, partial pagination, stale data, unknown time, and schema drift fixtures.
- Exhaustive verdict/confidence table tests, including close conflicting timestamps and grade-blind premium cases.
- Availability-run tests for confirmed transition, low-confidence opening rendered only as first-seen, first-seen-without-history, unknown gaps, two-tick anti-flap confirmation, and source-reported transition time.
- Activity tests for grade-specific gap→resume, ongoing activity, aggregate non-grade-specific activity, rolling-count resumption across two ticks, and cold on-demand runs without enough history.
- Geometry goldens for all eight hull vertices, the three interior anchors, the two user-supplied control stations, boundary-inclusive membership, and the pinned 500-metre buffer.
- Baseline and diff tests proving that changed `areaHash`, `queryHash`, or adapter-contract hash cannot reuse coverage or emit misleading changes.
- Golden Markdown reports and stable diff tests.

When extraction fails because a page changed, development mode may record a redacted HAR/snapshot in a temporary diagnostic directory. Runtime never commits or retains raw HARs by default.

## Legal and operational posture

- Personal, low-volume, read-only use at one run per 15 minutes.
- No CAPTCHA bypass, credential theft, write endpoints, or crowdsourced-report submission.
- Browser automation may still be blocked and unofficial DOM/internal data may change without notice.
- Every source has a config kill switch.
- The report always shows which sources actually contributed to a verdict.

## Decision ledger

| Decision | Status | Rationale | Source |
|---|---|---|---|
| Use `agent-browser` for all source access | adopted | Explicit user decision; one transport and consistent challenge handling | user override |
| Use direct HTTP as the primary runtime transport | rejected | Superseded by user decision after initial access problems | both proposals |
| Keep same-origin evaluated JS inside browser sessions | adopted | Structured extraction without creating a second transport | synthesis |
| Use native current-task heartbeat every 15 minutes | rejected | User explicitly prefers the active agent to perform the wait | synthesis superseded by user |
| Use an agent-driven loop with wait chunks no longer than 50 seconds | adopted | Keeps delivery in the active task without one long sleep or a background browser | user |
| Store editable settings beside scripts | adopted | Explicit user preference | user |
| Retain compact seven-day forecast history outside temporary monitoring state | superseded/adopted | Later user requirement explicitly asks for delivery-time learning from both manual runs and monitoring; raw data and unbounded history remain rejected | user |
| Keep AI-95 base and premium variants separate internally | adopted | Prevents grade-blind false positives and negatives | both proposals/reviews |
| Default query includes base AI-95 and all configured premium variants | adopted | Explicit requirement | user |
| Use categorical auditable confidence instead of pseudo-probability | adopted | No ground-truth calibration supports a percentage | proposal 2 + synthesis |
| Unknown-time evidence cannot qualify current availability | adopted | Fetch time is not observation time | proposal 1/reviews |
| Use lexicographic ranking | adopted | Avoid invented cross-unit weights | proposal 2 |
| Presence-only queue is not comparable as shortest | adopted | Unknown size must not masquerade as a short queue | proposal 1 |
| Conservative station matching and manual overrides | adopted | False merge is worse than a duplicate | both proposals |
| Stop pagination on empty/repeated IDs, not a short page | adopted | Short pages were empirically shown to precede further unique results | council review |
| Never bypass 2GIS CAPTCHA | adopted | Safety, legality, and operational fragility | both proposals/reviews |
| Use official 2GIS API in V1 | deferred | User selected browser-only path; API remains an optional later improvement | proposal 2 + user override |
| Treat Yandex and gdebenz as automatically independent evidence | rejected | Their crowd-report provenance may overlap | council review |
| Persist raw HAR recordings during normal monitoring | rejected | HAR may contain sensitive session metadata and is unnecessary at runtime | agent-browser guidance |
| Label ordering as evidence ranking until calibrated | adopted | No ground truth currently supports a probability claim | premortem |
| Add per-source capability matrix and completeness invariants | adopted | Process-level failure isolation is not the same as useful query coverage | premortem |
| Reconcile monitoring through heartbeat automation identity | rejected | Heartbeat monitoring was superseded by the user's agent-driven loop preference | premortem superseded by user |
| Pin named anchor stations as included | adopted | Coordinate drift must not exclude the boundary station the user explicitly chose | premortem |
| Make browser sessions ephemeral per run/tick with verified cleanup | adopted | Explicit user requirement: no agent-browser memory leak after either mode | user |
| Track current availability-run age separately from data freshness | adopted | User wants recent appearance treated as a proxy for a potentially smaller queue | user |
| Treat grade-specific transaction resumption as the strongest positive heuristic | adopted | A quiet period followed by new activity is the best available sign of a fresh replenishment | user |
| Recommend only stations with positive current evidence | adopted | Stations without availability are irrelevant to the user's decision | user |
| Make queue secondary to activity, multi-source support, and freshness | adopted | Queue is desirable but not the principal criterion | user |
| Sanitize `agent-browser` environment through an allowlist | adopted | Inherited CLI variables could silently alter engine, output limits, proxying, or persistence | final review |
| Make report creation and monitor-state commit a two-step transaction | adopted | A recovered active task must reuse one immutable report ID | final review |
| Key coverage baselines and diffs to area/query/contract hashes | adopted | Scope changes must not look like station changes or extraction regressions | final review |
| Use deterministic field precedence and source-ID-based station keys | adopted | Avoid implementation-dependent merges and continuity | final review |
| Rank exact queue counts before ordinal bands | adopted | Preserve useful precision where sources expose it | final review |

## Open questions for later configuration, not architecture

1. Reference point for distance tie-breaking; default is area centroid.
2. Exact freshness thresholds after a short period of real observations.
3. Full report every tick versus compact changes plus current top results; default is changes plus current top five.


## Requirements and constraints

- Runtime source access is exclusively through `agent-browser`; direct HTTP collectors are outside V1.
- One ephemeral browser session and one sequentially reused tab per collection run.
- Every browser transaction must finish cleanup verification before the run is reported complete.
- Monitoring is performed by the active agent in the current task, with no heartbeat automation, daemon, or wait chunk longer than 50 seconds.
- Monitoring cadence is 15 minutes; browsers remain closed during waits.
- Default requested products are base AI-95 plus all configured premium/branded AI-95 variants.
- The primary recommendation list contains only stations with positive current evidence for a requested product.
- Grade-specific transaction/activity resumption is the strongest heuristic, followed by multi-source support, directness/confidence, freshness, optional queue data, availability-run age, and distance.
- CAPTCHA and every degraded source are named in the user-facing report.
- On-demand and monitoring modes remove temporary run state but retain only the rolling compact seven-day forecast history in the user state directory.
- Default area is the 13-anchor Volgograd convex hull with a 500-metre outward buffer.
- Personal, read-only frequency is at most one collection per 15 minutes during monitoring.

## Operational decisions

- No background browser survives a collection run.
- `agent-browser` runs with an owned namespace and `--idle-timeout 10s`.
- Cleanup executes from a top-level `finally`, then verifies the namespace has no sessions.
- The active agent handles stop input between wait chunks and deletes monitoring temporary state.
- Source failures are isolated, but browser-runtime failure is reported as a common-mode failure.
- Raw HAR files are disabled in normal execution and allowed only as temporary, redacted development diagnostics.

## Rejected / deferred alternatives

- Direct HTTP-first collectors: rejected by explicit user decision.
- Native heartbeat automation: rejected in favor of an active-agent wait loop.
- One 15-minute `sleep`: rejected because the wait must remain interruptible and bounded.
- Persistent browser sessions between ticks: rejected because of memory/resource risk.
- Unbounded or raw snapshot/history storage: rejected. A compact, automatically pruned seven-day verdict history is adopted for the user-requested forecasts.
- Probability percentages: rejected until real outcome calibration exists.
- Automatic station merge based on coordinate proximity alone: rejected because distinct stations can be 50–100 metres apart.
- 2GIS official API: deferred as an optional future transport; V1 uses the unified browser path.
- CAPTCHA solving or bypass: rejected.
- Queue-first ranking: rejected; queue remains secondary.
