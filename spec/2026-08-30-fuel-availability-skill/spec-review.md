# Fuel availability skill — council specification

Status: design approved by the user on 2026-08-30; implementation has not started.

This document is the implementation source of truth.

# Synthesized design: fuel availability skill

## Purpose and scope

The skill is a personal, low-frequency, read-only Codex skill for checking AI-95 availability at petrol stations in a configured Volgograd area.

It supports:

- one on-demand check;
- active monitoring every 15 minutes in the current agent task;
- base AI-95 and configured branded or premium AI-95 variants;
- categorical, auditable verdicts;
- current queue evidence when available;
- temporary availability-run and activity-resumption tracking during monitoring.

It does not:

- submit crowd reports;
- solve or bypass CAPTCHAs;
- use credentials or persistent browser profiles;
- use Node-side HTTP collectors;
- retain long-term monitoring history;
- claim that page-derived data is authoritative;
- treat static catalogue data as current availability.

## Conservative implementation assumptions

- All runtime source access uses the `agent-browser` CLI.
- Same-origin JavaScript evaluated inside an already opened source page is browser-mediated and allowed.
- JavaScript evaluated in the page may read DOM, already-loaded application state, and same-origin resources only.
- Source schemas and capabilities remain disabled until verified through the feasibility gate.
- The tested browser contract is `agent-browser >=0.35.1 <0.36.0`.
- Node.js 20 or newer is required.
- Source pages are public and unauthenticated.
- The skill never loads a Chrome profile, restore state, state file, auth-vault entry, extension, user-attached browser, or existing CDP session.
- User-facing reports are in Russian. Configuration, schemas, logs, and tests use English identifiers.
- No source is presumed to expose current fuel status, observation time, activity history, or queue data.
- At least one adapter must expose validated grade-specific current status before V1 is considered operational.
- Monitoring is supported only when the current agent runtime provides an interruptible wait primitive that returns on user steering or after at most 50 seconds. There is no `sleep`, daemon, automation, or background-loop fallback.
- The system clock is assumed broadly correct. Source timestamps more than five minutes in the future are rejected as unusable timing evidence.
- Configuration contains no secrets. Authenticated proxies are outside V1.

## Definition of done

V1 is operational only when all of the following hold:

1. The installed `agent-browser` version and required commands pass compatibility checks.
2. At least one source passes the current-grade-status capability gate.
3. Every enabled capability has a redacted fixture and contract test.
4. Every enabled source has a stored completeness baseline.
5. Fetch time is never substituted for source observation time.
6. Browser cleanup succeeds after every integration and soak-test cycle.
7. The complete verdict and confidence decision tables pass exhaustive tests.
8. Monitoring state, cancellation, publication acknowledgement, and deletion tests pass.
9. Live smoke tests distinguish valid negative observations from empty, challenged, or broken extraction.
10. All user-facing claims include freshness and confidence.

If no source passes the current-status gate, implementation terminates with a source-feasibility report. A static station catalogue is not a successful substitute.

## Release-gated source feasibility

Source feasibility is the first implementation milestone.

For each source, a read-only feasibility pass must:

1. Create a fresh owned namespace.
2. Open the intended public source page.
3. Detect redirects, challenges, and initialization failures.
4. Identify the smallest stable DOM or page-state extraction contract.
5. Determine which capabilities are genuinely present.
6. Establish observation-time semantics.
7. Establish pagination or scrolling termination.
8. Capture a minimal redacted fixture.
9. Record an area-specific completeness baseline.
10. Close the session and verify the namespace has no active sessions.

A capability is enabled only when:

- its meaning is known;
- its fixture contains positive, absent, and malformed examples;
- its adapter contract test passes;
- its output has a defined normalization rule;
- its timing semantics are known or explicitly normalize to `UNKNOWN`;
- its runtime absence has a defined health outcome.

The feasibility pass may classify a source as:

- current-status capable;
- catalogue-only;
- challenge-only;
- temporarily unavailable;
- unsupported because its schema cannot be interpreted safely.

A challenge-only adapter may remain enabled solely to report `CHALLENGE`; it contributes no station or availability evidence.

## Architecture

```text
fuel-watch/
├── SKILL.md
├── package.json
├── package-lock.json
├── config/
│   ├── agent-browser.json
│   ├── config.json
│   ├── config.schema.json
│   └── identity-overrides.json
├── schemas/
│   ├── snapshot.schema.json
│   ├── monitor-state.schema.json
│   ├── source-result.schema.json
│   └── execution-envelope.schema.json
├── scripts/
│   ├── collect.mjs
│   ├── report.mjs
│   ├── resolve-area.mjs
│   ├── monitor-state.mjs
│   └── lib/
│       ├── browser-runner.mjs
│       ├── process-runner.mjs
│       ├── source-contract.mjs
│       ├── sources/
│       │   ├── yandex.mjs
│       │   ├── gdebenz.mjs
│       │   └── twogis.mjs
│       ├── normalize.mjs
│       ├── sanitize.mjs
│       ├── fuels.mjs
│       ├── temporal.mjs
│       ├── geometry.mjs
│       ├── identity.mjs
│       ├── verdict.mjs
│       ├── activity.mjs
│       ├── queue.mjs
│       ├── ranking.mjs
│       ├── availability-runs.mjs
│       ├── diff.mjs
│       └── state.mjs
└── tests/
    ├── fixtures/
    │   ├── yandex/
    │   ├── gdebenz/
    │   └── twogis/
    ├── unit/
    ├── contract/
    ├── integration/
    ├── monitoring/
    ├── soak/
    ├── golden/
    └── live/
```

Runtime-generated files live only in a private OS temporary directory.

Pinned runtime dependencies:

- `ajv@8.17.1` for JSON Schema validation;
- `@turf/turf@7.2.0` for convex hulls, buffering, polygon validation, area, distance, and boundary-inclusive point checks.

`package-lock.json` is committed. No Node browser-automation library is used.

## Data flow

```text
validated config
    ↓
browser compatibility check
    ↓
one owned browser transaction
    ↓
sequential source adapters
    ↓
typed source results and health
    ↓
normalization and area filtering
    ↓
station reconciliation
    ↓
product assessments and activity
    ↓
availability-run preparation
    ↓
ranking and diff
    ↓
versioned snapshot
    ↓
deterministic Markdown report
    ↓
monitor-state commit after report publication
```

Page-derived data is never sent back into browser commands except as a value passed through a fixed, typed operation after validation.

## Component responsibilities

### `SKILL.md`

- Recognize on-demand and monitoring requests.
- Validate that monitoring has an interruptible wait primitive.
- Create explicit temporary paths.
- Invoke scripts through fixed commands.
- Treat script output as untrusted data.
- Publish reports in the current task.
- After successful publication, acknowledge and commit prepared monitoring state.
- Handle user stop or cancellation.
- Never start an automation, background monitor, persistent browser, or skill-owned daemon.
- Never fall back to a long `sleep`.

### `process-runner.mjs`

- Use `child_process.spawn` with an argument array and `shell: false`.
- Capture stdout and stderr separately.
- Enforce command deadlines and output limits while the process runs.
- Abort the client process on timeout.
- Report whether termination was graceful, `SIGTERM`, or forced `SIGKILL`.
- Never interpolate page text, URLs, JavaScript, or paths into shell source.
- Never assume terminating the CLI client has terminated the browser session; namespace cleanup remains mandatory.

### `browser-runner.mjs`

- Check the CLI version before launching a browser.
- Create one unique namespace and one named session per collection.
- Use one pinned tab sequentially.
- Run the in-transaction health probe without closing the session.
- Send fixed JavaScript through stdin.
- Enforce the single-tab invariant after every navigation and extraction batch.
- Recreate a failed session at most once.
- Close only sessions inside the owned namespace.
- Verify the owned namespace has no active sessions.
- Record cleanup independently from source health.

### Source adapters

Each adapter:

- owns source navigation, readiness, challenge detection, pagination, and extraction;
- declares a versioned capability manifest;
- emits only validated capabilities;
- applies source-specific timestamp and status mappings;
- bounds and sanitizes extracted data before returning it;
- never reconciles stations;
- never calculates verdicts, confidence, or rank;
- converts expected failures into typed health;
- may throw only for unexpected programming defects.

### `collect.mjs`

- Validate configuration and optional monitor state.
- Start one browser transaction.
- Run enabled adapters sequentially.
- Preserve completed source results if later sources fail.
- Normalize observations.
- Apply geometry.
- Reconcile stations.
- Compute product and union assessments.
- Prepare availability-run state without committing it.
- Produce a versioned snapshot.
- Always run cleanup from a top-level `finally`.
- Emit a valid degraded snapshot when possible.

### `report.mjs`

- Validate snapshot and previous-state schemas.
- Render deterministic Markdown.
- Render exact product and union evidence separately.
- Show source and browser health.
- Escape untrusted strings.
- Produce a stable `reportId`.
- Never infer current availability from static catalogue data, rank, distance, or fetch time.

### `monitor-state.mjs`

Operations:

- `init`: create a private monitoring directory and generation-zero state;
- `prepare`: calculate next state without mutating committed state;
- `commit`: atomically commit a prepared state after publication;
- `recover`: handle an uncommitted prepared report conservatively;
- `cleanup`: close a recorded namespace if needed and delete state.

A prepared state includes its expected prior generation and `reportId`. `commit` is compare-and-swap: it fails if the committed generation changed.

If the agent crashes after publishing but before committing, the next invocation cannot prove delivery. It republishes the same idempotent `reportId`, labels it as a recovered repeat, and then commits. A possible duplicate report is preferred to silently losing a transition.

### Pure libraries

Fuel normalization, temporal logic, geometry, identity, verdicts, activity, queues, ranking, availability runs, diffs, and sanitization are deterministic and independently testable.

## Browser CLI contract

Every browser command uses explicit global arguments:

```text
agent-browser
  --config <absolute-path>/config/agent-browser.json
  --namespace fuel-watch-<128-bit-random-run-id>
  --session collector
  --idle-timeout 10s
  --pin-tab
  --allowed-domains <validated-union-of-enabled-source-domains>
  --json
  <command>
```

The namespace identifier consists only of lowercase ASCII letters, digits, and hyphens.

`config/agent-browser.json` contains only explicitly approved non-persistent launch defaults. Project or user browser defaults must not leak into the run.

The runner removes these inherited environment variables before launch:

```text
AGENT_BROWSER_PROFILE
AGENT_BROWSER_RESTORE
AGENT_BROWSER_RESTORE_SAVE
AGENT_BROWSER_STATE
AGENT_BROWSER_SESSION_NAME
AGENT_BROWSER_AUTO_CONNECT
AGENT_BROWSER_CDP
AGENT_BROWSER_EXTENSIONS
AGENT_BROWSER_INIT_SCRIPTS
AGENT_BROWSER_ENABLE
AGENT_BROWSER_HEADED
AGENT_BROWSER_STREAM_PORT
AGENT_BROWSER_ANNOTATE
AGENT_BROWSER_SCREENSHOT_DIR
AGENT_BROWSER_PROVIDER
AGENT_BROWSER_PLUGINS
AI_GATEWAY_API_KEY
AI_GATEWAY_MODEL
```

It supplies its own:

```text
AGENT_BROWSER_NAMESPACE
AGENT_BROWSER_SESSION
AGENT_BROWSER_IDLE_TIMEOUT_MS
AGENT_BROWSER_ALLOWED_DOMAINS
AGENT_BROWSER_CONFIG
```

Generic proxy environment variables are removed. V1 does not support authenticated proxies. A future unauthenticated proxy would require an explicit configuration field and contract tests.

Required CLI features:

- `--config`;
- `--namespace`;
- `--session`;
- `--idle-timeout`;
- `--pin-tab`;
- `--allowed-domains`;
- JSON output;
- `open`;
- `eval --stdin`;
- `tab list`;
- `tab close`;
- `session list`;
- `close`;
- `close --all`.

### Compatibility and health checks

There are two distinct checks.

The compatibility check:

1. Runs `agent-browser --version`.
2. Parses the version strictly.
3. Rejects versions outside `>=0.35.1 <0.36.0`.
4. Does not launch a browser.

The in-transaction health probe:

1. Opens `about:blank` in the collection session.
2. Evaluates a fixed expression returning `{ "ok": true }`.
3. Lists tabs.
4. Requires exactly one pinned controlled tab.
5. Continues into the first source without closing the session.

This preserves the one-session-per-collection contract. Cleanup happens only after all enabled adapters have run or the tick is aborted.

## Browser lifecycle

Each collection is one bounded browser transaction:

1. Generate the run ID and namespace.
2. Persist the namespace in the private temporary run record.
3. Check CLI compatibility.
4. Open one session and pinned tab.
5. Run the in-transaction health probe.
6. Visit enabled sources sequentially.
7. After every navigation:
   - validate the final main-frame URL;
   - detect challenge state;
   - list tabs;
   - close unexpected tabs in the owned session.
8. In a top-level `finally`, close the named session.
9. If named close fails, invoke:

```text
agent-browser --namespace <owned-namespace> close --all
```

10. Invoke:

```text
agent-browser --namespace <owned-namespace> session list --json
```

11. Require the owned namespace’s active-session list to be empty.
12. Record cleanup status.

The documented production cleanup invariant is “no active browser session remains in the owned namespace.” The short-lived internal `agent-browser` helper process may remain until the configured 10-second idle timeout; this is not a persistent monitoring daemon or a resource leak. Soak tests additionally verify that the namespace-owned helper exits within 15 seconds.

The implementation never kills processes by a global name or issues unscoped `close --all`.

## Browser and extraction budgets

| Limit | Default |
|---|---:|
| Ordinary browser command | 30 seconds |
| Navigation/readiness operation | 45 seconds |
| One source adapter | 90 seconds |
| Entire tick | 300 seconds |
| Session recreation | once per tick |
| Pagination/scroll batches per source | 20 |
| Stations per source | 500 |
| Records per extraction chunk | 250 |
| One evaluated JSON result | 2 MiB |
| Total extracted payload per source | 8 MiB |
| Captured stderr per command | 256 KiB |
| Captured stdout per non-extraction command | 1 MiB |
| Grace after `SIGTERM` | 2 seconds |
| Helper-process idle termination | 10 seconds |
| Soak-test helper exit allowance | 15 seconds |

Payload limits are enforced while reading streams. The implementation must not first buffer an unbounded result and then measure it.

Timeout, cancellation, `SIGINT`, `SIGTERM`, challenge, adapter exception, and report failure all converge on namespace cleanup.

## Command interfaces

### Collection

```text
node scripts/collect.mjs
  --config <absolute-config-path>
  --mode on-demand|monitor
  --output <absolute-snapshot-path>
  [--monitor-state <absolute-state-path>]
```

### Reporting

```text
node scripts/report.mjs
  --config <absolute-config-path>
  --snapshot <absolute-snapshot-path>
  [--previous <absolute-previous-snapshot-path>]
  --format markdown
```

### Monitoring state

```text
node scripts/monitor-state.mjs init
  --config <path>
  --output <state-directory>

node scripts/monitor-state.mjs prepare
  --state <state-path>
  --snapshot <snapshot-path>
  --output <prepared-state-path>

node scripts/monitor-state.mjs commit
  --state <state-path>
  --prepared <prepared-state-path>
  --report-id <report-id>

node scripts/monitor-state.mjs recover
  --state <state-path>

node scripts/monitor-state.mjs cleanup
  --state <state-path>
```

### Area resolution

```text
node scripts/resolve-area.mjs
  --config <path>
  --output <area-proposal-path>
```

The resolver emits a proposal and never edits configuration. Applying a confirmed proposal is a later explicit implementation action.

### Execution envelope

Every script prints exactly one JSON envelope to stdout:

```ts
interface ExecutionEnvelope {
  schemaVersion: 1;
  command: "collect" | "report" | "monitor-state" | "resolve-area";
  ok: boolean;
  degraded: boolean;
  startedAt: string;
  finishedAt: string;
  outputPath?: string;
  reportId?: string;
  warnings: ExecutionWarning[];
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

Human diagnostics go to stderr. Page-derived text is excluded from stderr unless sanitized and bounded.

### Exit codes

| Code | Meaning |
|---:|---|
| 0 | Valid output produced, including degraded source output |
| 2 | Invalid arguments or configuration |
| 65 | Input, snapshot, or state schema invalid |
| 69 | Required runtime unavailable or incompatible |
| 70 | Unrecoverable internal failure before valid output |
| 74 | Atomic file I/O failure |
| 75 | Browser or state cleanup could not be verified |

A source outage alone does not produce a nonzero exit if a valid degraded snapshot is emitted.

## Core schemas

```ts
type SourceId = "yandex" | "gdebenz" | "2gis";

type SourceHealth =
  | "OK"
  | "PARTIAL"
  | "CHALLENGE"
  | "SCHEMA_CHANGED"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "DISABLED";

type SourceErrorCode =
  | "NETWORK"
  | "TIMEOUT"
  | "HTTP_STATUS"
  | "CHALLENGE"
  | "BODY_TOO_LARGE"
  | "SCHEMA_CHANGED"
  | "TRUNCATED"
  | "EMPTY_RESULT"
  | "BASELINE_STALE"
  | "CLOCK_INVALID"
  | "ABORTED"
  | "INTERNAL_ADAPTER_ERROR";

type BrowserHealth =
  | "OK"
  | "INCOMPATIBLE"
  | "START_FAILED"
  | "COMMAND_FAILED"
  | "CLEANUP_FAILED";

interface SourceHealthRecord {
  source: SourceId;
  health: SourceHealth;
  errorCode?: SourceErrorCode;
  message?: string;
  httpStatus?: number;
  retryCount: number;
  capabilitiesAttempted: SourceCapability[];
  capabilitiesContributed: SourceCapability[];
  coverage?: CoverageMetrics;
}

type SourceCapability =
  | "STATION_IDENTITY"
  | "COORDINATES"
  | "CATALOGUE_GRADES"
  | "CURRENT_GRADE_STATUS"
  | "OBSERVATION_TIME"
  | "SIGNAL_COUNT"
  | "EVENT_TIMELINE"
  | "QUEUE_PRESENCE"
  | "QUEUE_ORDINAL"
  | "QUEUE_VEHICLE_COUNT";

interface SourceCapabilityManifest {
  source: SourceId;
  contractVersion: string;
  validatedAt: string;
  fixtureSetVersion: string;
  capabilities: Record<
    SourceCapability,
    "REQUIRED" | "OPTIONAL" | "UNSUPPORTED"
  >;
}
```

`OPTIONAL` means the capability has validated semantics but may be absent for an individual station or tick. It never means unverified.

## Products and observations

```ts
type FuelFamily =
  | "AI_92"
  | "AI_95"
  | "AI_98"
  | "AI_100"
  | "DIESEL"
  | "LPG"
  | "OTHER";

interface ExactFuelProduct {
  productKey: string;
  family: FuelFamily;
  variant: "BASE" | "BRANDED" | "PREMIUM" | "UNKNOWN";
  variantKey?: string;
  displayLabel: string;
}

type ObservationSubject =
  | {
      kind: "EXACT_PRODUCT";
      product: ExactFuelProduct;
    }
  | {
      kind: "FAMILY_PRESENT_UNSPECIFIED";
      family: FuelFamily;
      displayLabel: string;
    }
  | {
      kind: "FAMILY_ALL_PRODUCTS";
      family: FuelFamily;
      displayLabel: string;
    };

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
      originalValue: string;
      sourceTimeZone: string;
    }
  | {
      kind: "BOUNDED_AGE";
      minMinutes: number;
      maxMinutes: number;
    }
  | {
      kind: "UNKNOWN";
      reason:
        | "ABSENT"
        | "UNPARSEABLE"
        | "UNVERIFIED_SEMANTICS"
        | "FUTURE_CLOCK_SKEW";
    };

interface FuelObservation {
  observationId: string;
  source: SourceId;
  sourceStationId: string;
  subject: ObservationSubject;
  status: AvailabilityStatus;
  time: ObservationTime;
  signalsPerHour?: number;
  rawStatus: string;
  fetchedAt: string;
  provenanceUrl: string;
  conflict?: {
    code: string;
    sanitizedRaw?: unknown;
  };
}
```

Plain `АИ-95` is an exact base product only when the source contract distinguishes it from branded variants. Otherwise it becomes `FAMILY_PRESENT_UNSPECIFIED`.

A negative observation applies to every AI-95 variant only when the source explicitly expresses that scope and the adapter emits `FAMILY_ALL_PRODUCTS`.

Fetch time is provenance only.

## Source stations and coverage

```ts
interface QueueObservation {
  observationId: string;
  source: SourceId;
  sourceStationId: string;
  time: ObservationTime;
  kind: "VEHICLES" | "ORDINAL" | "PRESENCE" | "TEXT";
  vehicleCount?: number;
  ordinal?: "NONE" | "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";
  rawValue: string;
}

interface ActivityEvidence {
  evidenceId: string;
  source: SourceId;
  sourceStationId: string;
  product?: ExactFuelProduct;
  kind:
    | "TRANSACTIONS_RESUMED"
    | "TRANSACTIONS_ONGOING"
    | "RECENT_SIGNAL"
    | "NONE";
  eventTimes: string[];
  precedingGapMinutes?: number;
  gradeSpecific: boolean;
  sourceTerminology: "TRANSACTION" | "REPORT" | "SIGNAL";
}

interface SourceStation {
  source: SourceId;
  sourceStationId: string;
  title: string;
  brand?: string;
  address?: string;
  lat?: number;
  lon?: number;
  sourceUrl: string;
  fuels: FuelObservation[];
  queues: QueueObservation[];
  activity: ActivityEvidence[];
}

interface CoverageMetrics {
  stationCount: number;
  expectedStationCount: number;
  stationCountRatio: number;
  idCoverage: number;
  coordinateCoverage: number;
  fuelBlockCoverage: number;
  observationTimeCoverage: number;
  duplicateIdRatio: number;
  baselineObservedAt: string;
  paginationTermination:
    | "NATURAL_EMPTY"
    | "REPEATED_ID_SET"
    | "CAP_REACHED"
    | "NOT_APPLICABLE";
}

interface SourceResult {
  source: SourceId;
  health: SourceHealthRecord;
  stations: SourceStation[];
  fetchedAt: string;
}
```

Raw strings are limited to 128 Unicode characters. Sanitized diagnostic fragments are limited to 4 KiB per record. Raw HTML, scripts, cookies, headers, storage, and arbitrary page-state objects are prohibited in runtime snapshots.

## Reconciled stations and identity provenance

```ts
type MatchConfidence = "EXACT" | "HIGH" | "MEDIUM" | "SEPARATE";

interface StationSourceLink {
  source: SourceId;
  sourceStationId: string;
  matchConfidence: MatchConfidence;
  distanceMeters?: number;
  matchScore?: number;
  matchedFields: string[];
  manualOverride: boolean;
}

interface ReconciledStation {
  stationKey: string;
  title: string;
  brand?: string;
  address?: string;
  lat: number;
  lon: number;
  pinnedAnchor: boolean;
  sourceLinks: StationSourceLink[];
  fuels: FuelObservation[];
  queues: QueueObservation[];
  activity: ActivityEvidence[];
}
```

## Assessments

```ts
type Verdict =
  | "AVAILABLE"
  | "LIKELY_AVAILABLE"
  | "CONFLICTING"
  | "INDIRECT"
  | "NOT_AVAILABLE"
  | "NO_FRESH_DATA";

type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

type FreshnessBand =
  | "FRESH"
  | "RECENT"
  | "STALE"
  | "EXPIRED"
  | "UNKNOWN";

interface RankingTuple {
  activityRank: number;
  supportingServiceRank: number;
  independentGroupRank: number;
  directnessRank: number;
  confidenceRank: number;
  freshnessRank: number;
  freshnessUpperAgeMinutes: number;
  queueRank: number;
  runBasisRank: number;
  runAgeMinutes: number;
  distanceMeters: number;
  stationKey: string;
}

interface StationAssessment {
  assessmentKey: string;
  stationKey: string;
  queryKey: string;
  productKey?: string;
  verdict: Verdict;
  confidence: Confidence;
  freshness: FreshnessBand;
  freshnessDisplay: string;
  supportingSources: SourceId[];
  supportingProvenanceGroups: string[];
  positiveObservationIds: string[];
  negativeObservationIds: string[];
  supersededObservationIds: string[];
  indirectEvidenceIds: string[];
  activityEvidenceIds: string[];
  queue?: NormalizedQueue;
  availabilityRun?: AvailabilityRun;
  rankingTuple?: RankingTuple;
}
```

`rankingTuple` is present only for `AVAILABLE` and `LIKELY_AVAILABLE`.

## Monitoring state

```ts
interface AvailabilityRun {
  stationKey: string;
  productKey: string;
  stableState: "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";
  firstObservedAt?: string;
  lastConfirmedAt?: string;
  lastConfirmedNegativeAt?: string;
  transitionWindow?: {
    after: string;
    atOrBefore: string;
  };
  basis?: "OBSERVED_TRANSITION" | "FIRST_SEEN" | "SOURCE_REPORTED";
  pendingState?: "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";
  pendingCount: number;
}

interface MonitorState {
  schemaVersion: 1;
  monitoringId: string;
  generation: number;
  createdAt: string;
  previousPublishedSnapshot?: CollectionSnapshot;
  availabilityRuns: Record<string, AvailabilityRun>;
  dueAt?: string;
  lastTickStartedAt?: string;
  consecutiveDegradedTicks: number;
  lastOwnedNamespace?: string;
  prepared?: {
    expectedGeneration: number;
    reportId: string;
    snapshotPath: string;
    preparedAt: string;
  };
}
```

## Collection snapshot

```ts
interface CollectionSnapshot {
  schemaVersion: 1;
  runId: string;
  mode: "on-demand" | "monitor";
  startedAt: string;
  finishedAt: string;
  areaHash: string;
  queryHash: string;
  browser: {
    version: string;
    health: BrowserHealth;
    recreated: boolean;
    message?: string;
  };
  cleanup: {
    ok: boolean;
    closeMethod: "NAMED" | "NAMESPACE_ALL" | "NOT_STARTED";
    remainingSessions: string[];
    message?: string;
  };
  sources: SourceResult[];
  stations: ReconciledStation[];
  assessments: StationAssessment[];
  nextMonitorState?: MonitorState;
}
```

## Source capability matrix

Capabilities are provisional until the feasibility gate resolves them into adapter manifests.

| Capability | Yandex | gdebenz | 2GIS |
|---|---|---|---|
| Station identity | release-gated required | release-gated required | release-gated required or challenge-only |
| Coordinates | release-gated required | release-gated required | release-gated required |
| Static offered grades | optional candidate | optional candidate | catalogue candidate |
| Current grade status | release-gated candidate | release-gated candidate | disabled unless independently validated |
| Observation time | candidate; never inferred | candidate; bounded time allowed | disabled unless explicitly current |
| Signal count | optional candidate | optional candidate | unsupported by default |
| Event timeline | unsupported until proven | optional candidate | unsupported by default |
| Queue presence | optional candidate | optional candidate | optional only if explicitly current |
| Queue ordinal/count | optional candidate | optional candidate | unsupported by default |

“Candidate” exists only during implementation. Production manifests contain only `REQUIRED`, `OPTIONAL`, or `UNSUPPORTED`.

Default provenance groups:

```text
yandex  → crowd-overlap
gdebenz → crowd-overlap
2gis    → catalogue
```

Yandex and gdebenz count as separate contributing services but not as independent corroboration unless future evidence justifies changing their configured groups.

2GIS catalogue data has zero current-availability weight.

## Browser-first source collection

### Common navigation rules

- Construct URLs with `URL` and `URLSearchParams`.
- Require `https:`.
- Require the configured origin before navigation.
- Revalidate the final main-frame URL after redirects.
- Permit only resource domains recorded by the feasibility pass.
- A redirect outside the allowlist is a source failure.
- Same-origin evaluated requests must derive their URL from the current validated origin.
- Page-returned URLs are never opened without validation.
- Source text never becomes JavaScript source.

### Yandex Maps

1. Construct a minimal validated search URL for the configured area.
2. Wait for a validated result sentinel, state sentinel, challenge, or error.
3. Extract only fixed allowlisted fields.
4. Use chunks of at most 250 records.
5. Continue pagination or scrolling until:
   - no new station IDs appear;
   - the same complete ID set appears twice;
   - the batch cap is reached.
6. Never stop because one page is shorter than expected.
7. Mark cap termination `TRUNCATED` and health `PARTIAL`.

Names such as `fuelAvailability` are conceptual until fixtures prove their presence and semantics.

### gdebenz

1. Open `https://gdebenz.ru/`.
2. Wait for the validated application-ready sentinel.
3. Read already-loaded state or use same-origin evaluated JavaScript.
4. Apply bounding-box restriction in the page where feasible.
5. Retry one transient 502 in the same tick and session.
6. Use freshness bands only after their ordering and boundaries are validated.
7. Map unverified freshness semantics to `ObservationTime.UNKNOWN`.

Grade-blind reports cannot confirm or deny a specific premium product. Aggregate station activity cannot prove AI-95 availability.

### 2GIS

1. Open the validated petrol-station search URL.
2. Detect `/captcha`, `/museum`, reCAPTCHA text, challenge forms, and repeated redirects before extraction.
3. Stop immediately on challenge.
4. Never click, solve, bypass, or invoke a challenge plugin.
5. Treat “normally offers AI-95” as catalogue evidence.
6. Use current status or queue data only after explicit freshness validation.

The official 2GIS API remains deferred.

## Completeness invariants

Every evidence-producing source stores:

- `expectedStationCount`;
- `minimumStationCount`;
- `baselineObservedAt`;
- `baselineMaxAgeDays`, default 90;
- contract and fixture versions;
- per-field thresholds.

Default thresholds:

| Invariant | Required for `OK` |
|---|---:|
| Station count | `max(minimumStationCount, floor(expectedStationCount × 0.70))` |
| Source-ID coverage | at least 99% |
| Coordinate coverage | at least 95% |
| Fuel-block coverage | at least 80% for current-status-capable sources |
| Usable-time coverage | at least 80% of observations represented as current |
| Duplicate-ID ratio | at most 2% |
| Pagination | natural termination or explicitly not applicable |
| Baseline age | at most 90 days |

A stale baseline produces `BASELINE_STALE` and public health `PARTIAL`; it does not silently recalibrate itself. Updating a baseline requires an explicit development fixture refresh, not accumulated monitoring history.

Failure mapping:

| Condition | Internal code | Public health |
|---|---|---|
| Required schema missing | `SCHEMA_CHANGED` | `SCHEMA_CHANGED` |
| Valid but incomplete coverage | `TRUNCATED` or coverage detail | `PARTIAL` |
| Expected non-empty area returns zero | `EMPTY_RESULT` | `PARTIAL` |
| Payload exceeds limit | `BODY_TOO_LARGE` | `PARTIAL` |
| CAPTCHA or challenge | `CHALLENGE` | `CHALLENGE` |
| Network failure | `NETWORK` | `HTTP_ERROR` |
| HTTP failure | `HTTP_STATUS` | `HTTP_ERROR` |
| Deadline | `TIMEOUT` | `TIMEOUT` |
| Invalid source clock | `CLOCK_INVALID` | `PARTIAL` |
| Disabled adapter | none | `DISABLED` |

Successful process exit alone never produces `OK`.

## Area configuration

Coordinates use GeoJSON order `[longitude, latitude]`.

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
      coordinates: Array<[longitude: number, latitude: number]>;
    }
  | {
      kind: "station-anchors";
      anchors: Array<{
        label: string;
        source?: SourceId;
        sourceStationId?: string;
        lat?: number;
        lon?: number;
        stationKey?: string;
      }>;
      boundary: "convex-hull";
      bufferMeters: number;
      unresolvedPolicy: "fail-closed";
    };
```

Validation rejects:

- reversed rectangle bounds;
- invalid latitude or longitude;
- fewer than three unique non-collinear anchors;
- self-intersection;
- polygon area above 500 km²;
- buffer below zero or above 5000 metres.

Boundary points count as inside.

The default area uses these eleven anchors with a 500-metre buffer:

```json
[
  { "label": "Череповецкая ул., 5А", "point": [44.4825478, 48.7042007] },
  { "label": "Ангарская ул., 131Б", "point": [44.4447156, 48.7196496] },
  { "label": "Ангарская ул., 162", "point": [44.4590447, 48.7292752] },
  { "label": "ул. Хорошева, 65А", "point": [44.4760565, 48.7362504] },
  { "label": "просп. Маршала Жукова, 94А", "point": [44.4925045, 48.7393615] },
  { "label": "ул. Рокоссовского, 129Ж", "point": [44.5238774, 48.7307008] },
  { "label": "ул. Пархоменко, 57А", "point": [44.5262303, 48.7235710] },
  { "label": "Глубокоовражная ул., 25", "point": [44.4975444, 48.7076565] },
  { "label": "Симбирская ул., 1Б", "point": [44.4961665, 48.7060969] },
  { "label": "Социалистическая ул., 43", "point": [44.4859626, 48.6943282] },
  { "label": "Череповецкая ул., 21А", "point": [44.4722727, 48.6980531] }
]
```

Coordinates and source IDs must be reverified during implementation. The resolver emits a proposal without editing configuration.

Eight points form the preliminary hull. Череповецкая 5А, Глубокоовражная 25, and Симбирская 1Б remain interior control anchors.

Control points expected inside the unbuffered hull:

- Ангарская ул., 8А: `[44.4940448, 48.7150466]`;
- ул. Рокоссовского, 4Б: `[44.4925455, 48.7101139]`.

Resolved anchor station IDs are pinned as included. Coordinate drift does not expand the polygon and does not remove an explicitly named boundary station.

## Station identity

Matching order:

1. configured manual override;
2. exact source identity within one source;
3. conservative automatic cross-source match;
4. previous-tick continuity match during monitoring;
5. otherwise separate.

Automatic candidates require coordinates within 100 metres.

Hard rejects:

- conflicting known brands;
- conflicting known house numbers;
- distance above 100 metres;
- one-to-many assignment;
- non-mutual best match.

Normalization:

- Unicode NFKC;
- lowercase;
- Russian `ё` normalized to `е`;
- punctuation removed;
- street-type abbreviations mapped through a fixed dictionary;
- house corpus and suffix retained separately;
- brand aliases stored in configuration;
- street similarity uses trigram Jaccard similarity.

Match score:

```text
distanceScore = max(0, 1 - distanceMeters / 100)
streetScore   = trigramJaccard(normalizedStreetA, normalizedStreetB)
houseScore    = 1 when exact, otherwise 0
brandScore    = 1 when equal, 0 when one or both are unknown
matchScore    =
    0.45 × distanceScore +
    0.30 × streetScore +
    0.15 × houseScore +
    0.10 × brandScore
```

Accepted tiers:

- `HIGH`:
  - distance at most 30 metres; and
  - exact house address, or matching brand plus street similarity at least 0.85;
- `MEDIUM`:
  - distance at most 100 metres;
  - exact house number;
  - street similarity at least 0.85;
  - no brand conflict.

The mutual-best candidate must exceed the second-best score by at least 0.15. Otherwise records remain separate.

Queue data transfers only across manual, exact, or `HIGH` matches.

### Stable station keys

Key order:

1. configured manual `stationKey`;
2. configured pinned-anchor `stationKey`;
3. previous monitoring tick’s station key after a `HIGH` or exact continuity match;
4. deterministic hash of:
   - normalized address including house;
   - rounded coordinates at approximately ten-metre precision;
   - normalized brand when present.

The previous-tick continuity rule is temporary monitoring state, not a persistent learned registry. Ambiguous continuity creates a new separate key and a report warning rather than reusing a possibly wrong key.

## Fuel query semantics

The default request is a union of:

- base AI-95;
- every configured branded or premium AI-95 variant.

Exact products remain separate internally.

For a union query:

- exact positive evidence for any member may qualify the station;
- `FAMILY_PRESENT_UNSPECIFIED` may produce only `LIKELY_AVAILABLE`;
- family-unspecified evidence is never assigned to a named variant;
- a family-level negative applies only when explicitly scoped to `FAMILY_ALL_PRODUCTS`.

For an exact premium query, family-only observations are indirect and cannot enter a recommendation list.

Each exact product receives its own assessment. The union receives a separate synthetic `queryKey`; union state is not stored under an exact product key.

## Temporal normalization

All snapshot timestamps use UTC ISO 8601 with a trailing `Z`. Reports convert them to `Europe/Moscow`.

Exact source timestamps:

- retain the original sanitized value;
- require a verified source timezone when no offset is embedded;
- reject invalid calendar values;
- reject timestamps more than five minutes after `fetchedAt`;
- classify rejected future values as `UNKNOWN/FUTURE_CLOCK_SKEW`.

Bounded ages:

- require `0 ≤ minMinutes ≤ maxMinutes`;
- calculate an interval relative to `fetchedAt`;
- classify freshness using `maxMinutes`, the conservative boundary.

Freshness defaults:

| Band | Conservative age |
|---|---|
| `FRESH` | at most 45 minutes |
| `RECENT` | over 45 and at most 180 minutes |
| `STALE` | over 180 and at most 360 minutes |
| `EXPIRED` | over 360 minutes |
| `UNKNOWN` | no usable source time |

Stale, expired, and unknown-time evidence cannot independently establish current availability.

## Verdict algorithm

User-facing mapping:

| Internal | Russian |
|---|---|
| `AVAILABLE` | `ЕСТЬ` |
| `LIKELY_AVAILABLE` | `СКОРЕЕ ЕСТЬ` |
| `CONFLICTING` | `ПРОТИВОРЕЧИВО` |
| `INDIRECT` | `КОСВЕННО` |
| `NOT_AVAILABLE` | `НЕТ` |
| `NO_FRESH_DATA` | `НЕТ СВЕЖИХ ДАННЫХ` |

Evaluation order:

1. Select observations logically applicable to the exact product or union.
2. Normalize time intervals.
3. Exclude stale, expired, and unknown-time records from current decisions.
4. Separate direct status, family-unspecified, activity, and indirect evidence.
5. Resolve definitely superseded direct status.
6. Detect unresolved opposing evidence.
7. Apply the verdict table.
8. Apply the exact confidence table.
9. Retain excluded and superseded evidence in provenance.

### Conflict and supersession

Exact time is a point interval. Bounded age is an interval.

Opposing evidence is unresolved when:

- both sides are fresh or recent;
- their intervals overlap or are separated by at most 30 minutes;
- neither side is definitely newer by more than 30 minutes.

New evidence definitely supersedes old evidence when:

```text
new.earliestPossibleTime >
old.latestPossibleTime + conflictWindow
```

Opposing current observations from the same source are still a conflict unless the adapter contract explicitly identifies one as a correction or replacement.

### Verdict table

| Current applicable evidence | Verdict |
|---|---|
| Unresolved opposing direct or grade-specific activity evidence | `CONFLICTING` |
| Exact `IN_STOCK`, fresh | `AVAILABLE` |
| `FAMILY_ALL_PRODUCTS` `IN_STOCK`, fresh, for union query | `AVAILABLE` |
| Exact `IN_STOCK`, recent | `LIKELY_AVAILABLE` |
| Exact `LIMITED`, fresh or recent | `LIKELY_AVAILABLE` |
| Fresh grade-specific `TRANSACTIONS_RESUMED` | `LIKELY_AVAILABLE` |
| Fresh grade-specific `TRANSACTIONS_ONGOING` | `LIKELY_AVAILABLE` |
| Fresh or recent family-unspecified positive for union query | `LIKELY_AVAILABLE` |
| Applicable exact or family-all `OUT_OF_STOCK`, fresh or recent, without current positive | `NOT_AVAILABLE` |
| Only fresh `UNCERTAIN`, catalogue, aggregate activity, non-grade-specific activity, or recent signal evidence | `INDIRECT` |
| Only stale, expired, unknown-time, `UNKNOWN`, or no evidence | `NO_FRESH_DATA` |

Fresh out-of-stock evidence opposed by fresh grade-specific resumed or ongoing activity is `CONFLICTING`.

A standalone `RECENT_SIGNAL` never establishes availability unless the source contract defines it as grade-specific activity and it satisfies the stronger ongoing-activity rule.

## Confidence algorithm

Confidence is deterministic and does not use a fallback phrase such as “one tier lower.”

First apply verdict-specific base confidence:

| Verdict and evidence | Base confidence |
|---|---|
| `NO_FRESH_DATA` | `NONE` |
| `INDIRECT` | `LOW` |
| `CONFLICTING` | `LOW` |
| `AVAILABLE` from one fresh exact direct observation | `MEDIUM` |
| `AVAILABLE` from fresh family-all evidence for a union | `MEDIUM` |
| `LIKELY_AVAILABLE` from recent exact `IN_STOCK` | `LOW` |
| `LIKELY_AVAILABLE` from fresh exact `LIMITED` | `MEDIUM` |
| `LIKELY_AVAILABLE` from recent exact `LIMITED` | `LOW` |
| `LIKELY_AVAILABLE` from fresh grade-specific resumption | `MEDIUM` |
| `LIKELY_AVAILABLE` from fresh grade-specific ongoing activity | `LOW` |
| `LIKELY_AVAILABLE` from family-unspecified evidence | `LOW` |
| `NOT_AVAILABLE` from one fresh exact or family-all direct observation | `MEDIUM` |
| `NOT_AVAILABLE` from one recent exact or family-all direct observation | `LOW` |

Upgrade `AVAILABLE` or `NOT_AVAILABLE` to `HIGH` only when either condition holds:

1. At least two configured independent provenance groups each provide fresh, agreeing, direct evidence; or
2. One source provides fresh exact direct evidence, the capability manifest validates `SIGNAL_COUNT`, and `signalsPerHour` meets that source’s configured strong threshold.

No other verdict can be `HIGH`.

Rules:

- Multiple observations from one source count once.
- Multiple sources in one provenance group count once for independence.
- Same-source status and activity are not independent.
- `UNKNOWN` never increases confidence.
- Correlated source agreement may improve ranking support count but not confidence.
- Single-source high confidence is disabled while `strongSignalThresholds` is empty.

## Activity evidence

Defaults:

- quiet gap: 60 minutes;
- resumption window: 20 minutes;
- minimum new events: 2.

`TRANSACTIONS_RESUMED` requires:

- grade-specific evidence;
- a demonstrated preceding gap of at least 60 minutes;
- at least two later events inside 20 minutes;
- fresh event times.

`TRANSACTIONS_ONGOING` requires fresh grade-specific events without a demonstrated preceding gap.

Rolling-count resumption across monitoring ticks requires:

- previous count zero;
- current count at least two;
- current latest timestamp newer than the prior latest timestamp;
- a demonstrable 60-minute preceding gap;
- unchanged source count semantics and window definition.

A counter reset, window-size change, missing previous timestamp, or source schema-version change invalidates rolling-count inference.

Cold on-demand collection claims resumption only when current page history demonstrates the gap and later events.

Reports preserve `TRANSACTION`, `REPORT`, or `SIGNAL` terminology.

## Availability runs

Verdict mapping:

- `AVAILABLE`, `LIKELY_AVAILABLE` → `AVAILABLE`;
- `NOT_AVAILABLE` → `NOT_AVAILABLE`;
- all others → `UNKNOWN`.

Rules:

- stable negative followed by available:
  - basis `OBSERVED_TRANSITION`;
  - report “появился между X и Y”;
- unknown followed by available:
  - basis `FIRST_SEEN`;
  - report “впервые увидели в наличии в Y”;
- consecutive available:
  - report “наблюдаем в наличии не менее N”;
- validated source transition time:
  - basis `SOURCE_REPORTED`;
  - name the source;
- no history:
  - report “время появления неизвестно”.

An established available run closes only after two consecutive `NOT_AVAILABLE` ticks. `UNKNOWN` does not close it but also does not extend `lastConfirmedAt`.

When a run remains available after an unknown gap, the report says:

```text
ранее наблюдали в наличии; непрерывность не подтверждена
```

It must not claim a continuous minimum duration across the unknown gap.

On-demand mode does not invent run history.

## Queue normalization

Vehicle bands:

| Count | Ordinal |
|---:|---|
| 0 | `NONE` |
| 1–3 | `SHORT` |
| 4–7 | `MEDIUM` |
| 8–15 | `LONG` |
| 16+ | `VERY_LONG` |

Rules:

1. Unknown-time, stale, and expired queues are excluded from comparison.
2. Vehicle counts are converted to ordinal before cross-source comparison.
3. Fresh data wins over recent data.
4. Within the same freshness band, a definitely newer queue supersedes an older one.
5. Equally current conflicting queues use the worse ordinal and show the conflict.
6. Presence-only renders “очередь есть, размер неизвестен”.
7. Text-only values remain provenance unless mapped by a validated source contract.
8. Missing queue data is unknown, never zero.

Queue never establishes fuel availability.

## Ranking

Recommendation eligibility:

- `AVAILABLE` → primary list;
- `LIKELY_AVAILABLE` → separate likely-positive list;
- all other verdicts → excluded from recommendations.

Ranking uses the following ascending tuple:

```text
activityRank:
  0 resumed
  1 ongoing
  2 status-only

supportingServiceRank:
  negative count of distinct supporting sources

independentGroupRank:
  negative count of supporting provenance groups

directnessRank:
  0 exact
  1 family-all
  2 family-unspecified
  3 activity-only

confidenceRank:
  0 high
  1 medium
  2 low

freshnessRank:
  0 fresh
  1 recent

freshnessUpperAgeMinutes:
  lower is better

queueRank:
  0 none
  1 short
  2 medium
  3 long
  4 very-long
  5 unknown or incomparable

runBasisRank:
  0 source-reported or observed transition
  1 first-seen
  2 continuing or unknown

runAgeMinutes:
  shorter confirmed age first; unknown sorts last

distanceMeters:
  lower is better

stationKey:
  lexical final tie-breaker
```

Activity resumption is a heuristic for possibly smaller queues, never proof of delivery or measured queue length.

Rank movement alone is not a meaningful diff.

## Monitoring contract

### Runtime capability gate

Before monitoring starts, `SKILL.md` must establish that the current agent runtime can:

- wait for at most 50 seconds;
- return control after the timeout;
- return early on new user input or cancellation;
- continue the same task afterward.

If this capability is unavailable, monitoring is reported as unsupported in the current runtime. The skill does not substitute `sleep`, a shell loop, automation, or daemon.

### Tick sequence

1. Initialize monitoring state.
2. Run an immediate collection.
3. Prepare next monitoring state.
4. Render the report and obtain `reportId`.
5. Publish the report into the current task.
6. Commit the prepared state using `reportId`.
7. Compute the next due time.
8. Wait in chunks of at most 50 seconds; default 45.
9. Inspect new user input after every chunk.
10. Start the next tick only when due.
11. Repeat until stopped.

Cadence:

```text
nextDueAt =
  max(previousDueAt + 15 minutes,
      lastTickStartedAt + 15 minutes)
```

Missed ticks are not replayed. Slow ticks do not trigger catch-up bursts.

No browser remains open during waits.

### Publication and recovery

Prepared state does not replace committed state.

`commit` requires:

- matching `reportId`;
- matching expected generation;
- a valid prepared snapshot;
- successful report publication by the active agent.

If publication succeeds but commit fails, the next run repeats the same report with the same `reportId` and a recovery label. Duplicate delivery is acceptable; losing an availability transition is not.

### Temporary state

State contains only:

- previous published normalized snapshot;
- availability runs;
- pending anti-flap states;
- stable station-key continuity;
- due time;
- last tick start;
- degraded-tick count;
- last owned namespace;
- prepared publication metadata.

State directory:

- mode `0700`;
- files mode `0600`;
- atomic same-directory rename;
- absolute canonical paths;
- no symlinks.

Orphan cleanup may delete a monitoring directory only when:

- its recorded owner process is not alive;
- it is older than 30 minutes;
- its schema and ownership marker are valid;
- namespace cleanup has been attempted.

### Degraded repetition

After four consecutive ticks with no fresh grade-specific evidence from any source:

- monitoring continues;
- the first degraded report remains full;
- subsequent identical reports become compact;
- source-health changes always restore a full report;
- any new positive, negative, conflict, or queue change restores a full report.

### Stop sequence

1. Interrupt an active collection if present.
2. Run namespace cleanup.
3. Delete prepared and committed monitoring files.
4. Delete the monitoring directory.
5. Verify absence.
6. Confirm stop only after cleanup succeeds.

Cleanup failure is reported explicitly.

## On-demand mode

On-demand mode:

1. creates a private temporary directory;
2. runs one collection;
3. renders one report;
4. deletes snapshot and temporary state in a `finally`;
5. verifies browser-session cleanup;
6. leaves no intentional state.

A hard process kill may leave a normalized temporary file until conservative orphan or OS temporary cleanup.

All-source failure renders a degraded collection, never “no petrol.”

## Failure isolation

Expected failures:

- `NETWORK`;
- `TIMEOUT`;
- `HTTP_STATUS`;
- `CHALLENGE`;
- `BODY_TOO_LARGE`;
- `SCHEMA_CHANGED`;
- `TRUNCATED`;
- `EMPTY_RESULT`;
- `BASELINE_STALE`;
- `CLOCK_INVALID`;
- `ABORTED`;
- `INTERNAL_ADAPTER_ERROR`.

A failed source does not cancel later sources unless:

- the user cancelled;
- the entire tick deadline expired;
- the browser runtime entered unrecoverable common-mode failure.

Browser recovery:

1. Preserve completed source results.
2. Close the failed named session.
3. Recreate it once in the same namespace.
4. Repeat the in-transaction health probe.
5. Retry the interrupted source only when the failure is classified transient.
6. Continue with remaining sources.

Do not recreate or retry after:

- CAPTCHA;
- deterministic 4xx;
- schema mismatch;
- payload cap;
- explicit cancellation.

`EMPTY_RESULT` and `SCHEMA_CHANGED` remain distinct.

Monitoring does not auto-stop due to degraded data.

## Security and untrusted content

Source pages are untrusted.

The implementation must:

- use fixed local extraction programs;
- pass JavaScript through stdin;
- never execute page-returned JavaScript;
- never interpret source text as agent instructions;
- require HTTPS and allowlisted origins;
- restrict browser resource domains with `--allowed-domains`;
- validate the main-frame URL after redirects;
- sanitize provenance URLs and retain only allowlisted query parameters;
- strip NUL, bidi overrides, terminal escapes, and non-printing controls;
- normalize Unicode before identity comparison;
- escape Markdown;
- bound strings, arrays, recursion depth, and JSON sizes;
- redact keys suggesting tokens, cookies, authorization, credentials, or sessions;
- reject path traversal and symlinks;
- avoid logging raw evaluated payloads.

Normal runtime disables:

- HAR;
- screenshots;
- video;
- tracing;
- streaming;
- dashboard;
- profiles;
- restore state;
- extensions;
- persistent storage;
- auth vaults;
- user-attached browsers;
- external plugins.

Development diagnostics may create temporary redacted fixtures or HARs only when explicitly enabled. They are deleted after repair and never retained by normal monitoring.

## Output contract

Every report contains:

1. timestamp, area, and requested products;
2. browser and cleanup health;
3. source health and capability limitations;
4. changes since the previous published tick;
5. primary positive stations;
6. likely-positive stations;
7. conflict and indirect sections;
8. negative and no-fresh-data counts;
9. an unconditional warning.

Example:

```text
Проверка: 16:15 МСК · центральный Волгоград · АИ-95 и 95+

Источники:
Яндекс: OK
gdebenz: PARTIAL (нет пригодного времени)
2ГИС: CHALLENGE (CAPTCHA, данные этого запуска не использованы)

1. Лукойл · ул. Рокоссовского, 1Р
   АИ-95: ЕСТЬ (средняя уверенность, 8 мин)
   95+: НЕТ (низкая уверенность, 12 мин)
   очередь: большая
   АИ-95 появился между 15:45 и 16:00
   источник: Яндекс · статус обновлён в 16:07

Предупреждение: сведения получены из краудсорсинговых и страничных
источников, могут запаздывать или быть ошибочными. Перед поездкой
проверяйте ситуацию на месте.
```

No availability claim is rendered without confidence and freshness. Unknown time is explicit.

Meaningful diffs:

- verdict;
- confidence;
- contributing-source set;
- source-health transition;
- queue ordinal;
- confirmed availability transition;
- loss or restoration of continuity.

Ignored diffs:

- rank movement alone;
- harmless age drift inside the same band;
- formatting changes;
- identical compact degradation.

## Configuration contract

`config.schema.json` rejects unknown fields and validates all ranges.

```ts
interface FuelWatchConfig {
  schemaVersion: 1;
  runtime: RuntimeConfig;
  monitoring: MonitoringConfig;
  freshness: FreshnessConfig;
  activity: ActivityConfig;
  queue: QueueConfig;
  identity: IdentityConfig;
  ranking: RankingConfig;
  provenanceGroups: Record<SourceId, string>;
  strongSignalThresholds: Partial<Record<SourceId, number>>;
  requestedProducts: RequestedProductsConfig;
  area: AreaConfig;
  sources: Record<SourceId, SourceConfig>;
}

interface SourceConfig {
  enabled: boolean;
  mode: "EVIDENCE" | "CATALOGUE_ONLY" | "CHALLENGE_ONLY";
  startUrl: string;
  allowedOrigins: string[];
  allowedResourceDomains: string[];
  contractVersion: string;
  fixtureSetVersion: string;
  capabilities: SourceCapabilityManifest["capabilities"];
  expectedStationCount?: number;
  minimumStationCount?: number;
  baselineObservedAt?: string;
  baselineMaxAgeDays: number;
  completeness: {
    minimumIdCoverage: number;
    minimumCoordinateCoverage: number;
    minimumFuelBlockCoverage: number;
    minimumObservationTimeCoverage: number;
    maximumDuplicateIdRatio: number;
    minimumStationRatio: number;
  };
}
```

An `EVIDENCE` source requires baseline fields. A `CHALLENGE_ONLY` source does not.

Required defaults:

```json
{
  "schemaVersion": 1,
  "runtime": {
    "nodeMinimumMajor": 20,
    "agentBrowserPath": "agent-browser",
    "agentBrowserVersionRange": ">=0.35.1 <0.36.0",
    "commandTimeoutMs": 30000,
    "navigationTimeoutMs": 45000,
    "adapterTimeoutMs": 90000,
    "tickTimeoutMs": 300000,
    "idleTimeout": "10s",
    "maxSessionRecreations": 1,
    "maximumEvalBytes": 2097152,
    "maximumSourceBytes": 8388608
  },
  "monitoring": {
    "cadenceMinutes": 15,
    "waitChunkSeconds": 45,
    "compactAfterDegradedTicks": 4,
    "availabilityResetTicks": 2,
    "orphanMinimumAgeMinutes": 30
  },
  "freshness": {
    "freshMinutes": 45,
    "recentMinutes": 180,
    "staleMinutes": 360,
    "conflictWindowMinutes": 30,
    "maximumFutureSkewMinutes": 5
  },
  "activity": {
    "quietGapMinutes": 60,
    "resumptionWindowMinutes": 20,
    "minimumEvents": 2
  },
  "queue": {
    "shortMaxVehicles": 3,
    "mediumMaxVehicles": 7,
    "longMaxVehicles": 15
  },
  "identity": {
    "maximumDistanceMeters": 100,
    "highConfidenceDistanceMeters": 30,
    "minimumStreetSimilarity": 0.85,
    "minimumSecondBestMargin": 0.15
  },
  "ranking": {
    "referencePoint": "area-centroid"
  },
  "provenanceGroups": {
    "yandex": "crowd-overlap",
    "gdebenz": "crowd-overlap",
    "2gis": "catalogue"
  },
  "strongSignalThresholds": {}
}
```

Source start URLs, domains, baselines, manifests, and fixture versions are populated by the feasibility milestone. This is a release-produced configuration artifact, not a runtime guess.

Secrets and authenticated proxy URLs are rejected.

## Testing and acceptance

### Unit tests

Cover:

- aliases, variants, and union scopes;
- temporal parsing and future skew;
- bounded-age intervals;
- exhaustive verdict/confidence combinations;
- conflict and supersession;
- geometry and buffer behavior;
- address normalization and exact match scoring;
- ambiguity and mutual-best matching;
- stable station-key continuity;
- activity history and rolling counters;
- queue comparison;
- availability-run unknown gaps;
- ranking tuples;
- publication IDs and state generations;
- diffs;
- Unicode and Markdown sanitization.

### Contract tests

- Fake `BrowserRunner` for every adapter.
- Positive, absent, malformed, challenged, oversized, and truncated fixtures.
- Manifest and fixture-version consistency.
- Unknown freshness maps to `UNKNOWN`.
- Missing required fields map to `SCHEMA_CHANGED`.
- Catalogue-only observations cannot enter recommendations.
- Challenge-only sources emit no stations.

### Integration tests

Using installed `agent-browser` and local fixture pages:

- version rejection;
- dedicated config isolation;
- environment clearing;
- `--allowed-domains`;
- one namespace/session/tab;
- pinned-tab behavior;
- stdin evaluation;
- stream byte limits;
- navigation and adapter deadlines;
- popup cleanup;
- session recreation;
- scoped `close --all`;
- empty-session verification;
- no profile or restore files.

### Monitoring tests

- interruptible wait capability gate;
- immediate first tick;
- no wait over 50 seconds;
- no browser during waits;
- no catch-up burst;
- publication before commit;
- compare-and-swap rejection;
- recovered duplicate report;
- stop during wait;
- stop during collection;
- state deletion;
- orphan cleanup;
- four-tick compact degradation;
- unknown gap does not extend continuous availability.

### Soak tests

Run at least 20 collection cycles.

After each cycle:

- session list is empty;
- no browser process owned by the cycle remains;
- the namespace helper exits within 15 seconds;
- no restore or profile file exists;
- temporary output is removed;
- process count does not grow;
- no residual owned RSS remains after process exit.

Tests may inspect owned PIDs or process ancestry. Production code must not kill by global process name.

### Live tests

Opt-in only.

Verify:

- structurally valid station extraction;
- baseline plausibility;
- challenge classification;
- timestamp semantics;
- valid negative versus empty extraction;
- pagination termination;
- capability contribution;
- cleanup.

A live test does not require a positive fuel result.

### Golden reports

Cover:

- positive and likely-positive;
- exact versus family evidence;
- base versus premium;
- all-source failure;
- CAPTCHA;
- partial coverage;
- stale baseline;
- clock skew;
- conflicts;
- unknown time;
- presence-only queue;
- activity resumption;
- first seen;
- observed transition;
- unknown continuity gap;
- cleanup failure;
- recovered duplicate publication;
- compact degradation.

## Implementation sequence

1. Create package metadata, pinned dependencies, schemas, and dedicated browser configuration.
2. Implement typed process execution and streamed byte limits.
3. Run source feasibility and record redacted fixtures, manifests, domains, and baselines.
4. Implement pure temporal, fuel, geometry, verdict, confidence, activity, queue, identity, and ranking libraries.
5. Implement and contract-test the browser runner.
6. Implement adapters one at a time behind kill switches.
7. Require at least one adapter to pass the current-status release gate.
8. Implement snapshots, reconciliation, and cleanup.
9. Implement reports and golden fixtures.
10. Implement monitoring prepare, publication acknowledgement, commit, recovery, and cleanup.
11. Add cancellation, integration, and soak tests.
12. Run opt-in live smoke tests.
13. Declare V1 operational only after all definition-of-done gates pass.
14. Widen the browser version range only after rerunning compatibility and integration tests.

## Legal and operational posture

- Personal, read-only, low-volume use.
- One monitoring collection starts at most every 15 minutes.
- Page resources and pagination inside a tick are part of that collection.
- No CAPTCHA bypass, credential use, report submission, write endpoint, stealth plugin, or authenticated proxy.
- Browser automation may be blocked or restricted.
- Unofficial page contracts may change.
- Every source has a kill switch.
- Reports name contributing and degraded sources.
- The operator remains responsible for applicable terms and law.

## Requirements and constraints

- Runtime source access is exclusively through `agent-browser`.
- Node-side direct source HTTP is outside V1.
- Same-origin evaluated access is limited to the validated current origin.
- One namespace, one ephemeral session, and one pinned sequential tab per tick.
- Browser cleanup requires an empty owned session list.
- The browser helper may live only until its 10-second idle timeout.
- Monitoring remains in the active task.
- Monitoring requires a runtime interruptible wait capability.
- No heartbeat, automation, background loop, long sleep, or persistent skill-owned daemon.
- Wait chunks are at most 50 seconds.
- Monitoring cadence is 15 minutes without catch-up bursts.
- Default products are base and configured premium/branded AI-95.
- Only positive and likely-positive current evidence enters recommendations.
- Grade-specific activity resumption is the strongest ranking heuristic.
- Queue remains secondary.
- Every degraded source and CAPTCHA is named.
- On-demand mode leaves no intentional state.
- Monitoring stores one previous published tick and active-run state only.
- Default area is the 11-anchor Volgograd hull with a 500-metre buffer.
- Source schemas and capabilities require feasibility fixtures.
- Page content is bounded, sanitized, and never treated as instructions.
- V1 is blocked if no source exposes validated current status.

## Operational decisions

- No browser session survives a tick.
- A short-lived `agent-browser` helper process is allowed only within the configured idle timeout.
- Compatibility fails closed outside the tested version range.
- A dedicated browser config and explicit environment prevent inherited persistence.
- Browser resource access uses an allowlist.
- Cleanup uses a top-level `finally`, named close, scoped fallback, and empty-session verification.
- Source failures are isolated.
- Browser common-mode failure is reported separately.
- Monitoring publication precedes compare-and-swap state commit.
- Ambiguous post-publication recovery may duplicate but never silently lose a report.
- Hard-kill residue is handled by idle timeout and conservative orphan cleanup.
- Raw HAR, screenshots, video, traces, streaming, profiles, restore state, and plugins are disabled normally.
- Baselines never self-update from monitoring.
- No source capability is inferred from undocumented fields.

## Decision ledger

| Decision | Status | Rationale | Source |
|---|---|---|---|
| Use `agent-browser` for all source access | adopted | Explicit user decision; one transport and consistent challenge handling | user override |
| Use direct HTTP as the primary runtime transport | rejected | Superseded by the user’s browser-only decision | both proposals |
| Keep same-origin evaluated JS inside browser sessions | adopted | Structured extraction without creating a Node-side source transport | synthesis |
| Use native current-task heartbeat every 15 minutes | rejected | User explicitly prefers the active agent to perform the wait | synthesis superseded by user |
| Use an agent-driven loop with wait chunks no longer than 50 seconds | adopted | Keeps delivery interruptible in the active task | user |
| Store editable settings beside scripts | adopted | Explicit user preference | user |
| Retain only previous-tick temporary state during active monitoring | adopted | Minimum state required for transitions and diffs without long-term history | user |
| Keep AI-95 base and premium variants separate internally | adopted | Prevents grade-blind false positives and negatives | both proposals/reviews |
| Default query includes base AI-95 and configured premium variants | adopted | Explicit requirement | user |
| Use categorical auditable confidence instead of pseudo-probability | adopted | No ground-truth calibration supports percentages | proposal 2 + synthesis |
| Unknown-time evidence cannot qualify current availability | adopted | Fetch time is not observation time | proposal 1/reviews |
| Use lexicographic ranking | adopted | Avoids invented arithmetic across incompatible dimensions | proposal 2 |
| Presence-only queue is not comparable as shortest | adopted | Unknown size must not masquerade as a short queue | proposal 1 |
| Use conservative station matching and manual overrides | adopted | False merge is worse than duplicate rows | both proposals |
| Stop pagination on empty/repeated IDs, not a short page | adopted | Short pages can precede further unique results | council review |
| Never bypass 2GIS CAPTCHA | adopted | Safety, legality, and operational fragility | both proposals/reviews |
| Use official 2GIS API in V1 | deferred | Browser-only V1 is the binding user choice | proposal 2 + user override |
| Treat Yandex and gdebenz as automatically independent | rejected | Their crowd-report provenance may overlap | council review |
| Persist raw HAR during monitoring | rejected | HAR may contain sensitive session metadata | agent-browser guidance |
| Label ordering as evidence ranking until calibrated | adopted | No ground truth supports probability claims | pre-mortem |
| Add per-source capability matrix and completeness invariants | adopted | Process success does not prove useful query coverage | pre-mortem |
| Reconcile monitoring through heartbeat automation identity | rejected | Superseded by the active-agent loop | pre-mortem superseded by user |
| Pin named anchor stations as included | adopted | Coordinate drift must not remove explicitly chosen boundary stations | pre-mortem |
| Use ephemeral browser sessions with verified cleanup | adopted | Prevents cross-run state and memory accumulation | user |
| Track availability-run age separately from freshness | adopted | Recent appearance is a distinct queue-related heuristic | user |
| Treat grade-specific activity resumption as the strongest positive heuristic | adopted | It is the strongest available sign of newly resumed supply or activity | user |
| Recommend only stations with positive current evidence | adopted | Negative and unknown stations are not useful driving recommendations | user |
| Make queue secondary to activity, support, directness, and freshness | adopted | Queue is useful but not the principal criterion | user |
| Require a source-feasibility release gate | adopted | Current page capabilities and schemas are not yet verified | round-1 refinement |
| Fail closed on untested `agent-browser` versions | adopted | The CLI is a runtime contract and 0.x releases may change behavior | round-1 refinement |
| Use a dedicated browser config and clear persistence-related environment | adopted | Prevents accidental profile, restore-state, dashboard, or extension use | round-1 refinement |
| Use fixed numeric process, payload, pagination, and cleanup budgets | adopted | Makes failure behavior implementable and testable | round-1 refinement |
| Use atomic monitoring-state prepare/commit | adopted | Ensures diffs reference the previous published tick | round-1 refinement |
| Define family-positive and family-negative claim scopes explicitly | adopted | Prevents invalid inference across base and premium products | round-1 refinement |
| Disable single-source high-confidence thresholds by default | adopted | Signal-count semantics are not calibrated yet | round-1 refinement |
| Treat page content as untrusted data | adopted | Prevents prompt injection, shell injection, path abuse, and unsafe provenance retention | round-1 refinement |
| Block V1 operational release if no source exposes validated current status | adopted | A catalogue-only implementation would not satisfy the user’s goal | round-1 refinement |
| Gate monitoring on a runtime interruptible-wait capability | adopted | Active-task monitoring cannot safely emulate interruption with shell sleep | round-2 refinement |
| Distinguish compatibility checking from the in-session browser health probe | adopted | Preserves the one-session transaction contract | round-2 refinement |
| Define browser cleanup as empty owned sessions while allowing only bounded helper shutdown | adopted | Matches the CLI lifecycle without weakening the no-leak requirement | round-2 refinement |
| Pass an explicit browser domain allowlist and clear persistence environment variables | adopted | Makes browser isolation enforceable instead of aspirational | round-2 refinement |
| Define all referenced snapshot, assessment, station, state, and execution schemas | adopted | Removes contract gaps for downstream implementation | round-2 refinement |
| Use deterministic confidence rules without an unspecified fallback | adopted | Makes the verdict table exhaustive and testable | round-2 refinement |
| Validate source clocks and refuse future-skewed timing evidence | adopted | Prevents false freshness from clock or parsing errors | round-2 refinement |
| Carry station keys through previous-tick high-confidence continuity | adopted | Stabilizes diffs without creating permanent learned identity state | round-2 refinement |
| Publish before compare-and-swap monitor-state commit | adopted | Keeps committed state aligned with reports actually emitted to the task | round-2 refinement |
| Prefer possible idempotent duplicate publication over silent transition loss | adopted | No external delivery receipt exists in the active-task model | round-2 refinement |
| Expire completeness baselines without self-calibrating from monitoring | adopted | Avoids stale assumptions and contaminated baselines | round-2 refinement |
| Use exact pinned schema and geometry dependencies | adopted | Removes dependency-selection ambiguity | round-2 refinement |
| Reject global process-name killing during cleanup | rejected | It could terminate unrelated browser sessions or user processes | round-2 refinement |

## Rejected / deferred alternatives

- Direct HTTP-first collectors: rejected by explicit user decision.
- Native heartbeat automation: rejected in favor of the active-agent wait loop.
- One 15-minute `sleep`: rejected because waits must remain interruptible.
- Shell-loop monitoring when the runtime lacks interruptible wait: rejected.
- Persistent browser sessions between ticks: rejected because of state, privacy, and memory risk.
- Long-term snapshot or calibration history: rejected.
- Probability percentages: rejected until ground-truth calibration exists.
- Automatic station merge based on proximity alone: rejected.
- Automatic reliance on undocumented source fields: rejected.
- Automatic Yandex/gdebenz independence: rejected.
- Single-source high confidence from an unvalidated signal count: rejected.
- 2GIS official API: deferred.
- CAPTCHA solving, stealth plugins, or bypass: rejected.
- Queue-first ranking: rejected.
- Static catalogue stations in recommendation lists: rejected.
- Profiles, restore state, auto-connect, CDP attachment, credentials, or plugins: rejected.
- Authenticated proxies: rejected for V1.
- Persistent raw diagnostics: rejected.
- Untested browser versions without a compatibility gate: rejected.
- Global `close --all` or process-name killing: rejected.
- Automatic baseline learning from monitoring: rejected.
- Treating unknown gaps as continuous availability: rejected.
- Committing monitoring state before publication: rejected because an undelivered report could become the comparison baseline.

## Open questions for later configuration

These do not block implementation:

1. Distance reference point. Default: area centroid.
2. Freshness thresholds after real observations. Default: 45/180/360 minutes.
3. Full monitoring report versus changes plus top five. Default: changes plus current top five.
4. Queue bands after source comparison. Default: 0, 1–3, 4–7, 8–15, 16+.
5. Whether provenance groups can later be separated. Default: Yandex and gdebenz remain one group.
6. Whether validated source signal counts should enable single-source high confidence. Default: disabled.
7. Baseline refresh interval after operational experience. Default: 90 days.