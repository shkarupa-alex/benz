# Synthesized design: fuel availability skill

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

Configuration is intentionally stored beside the scripts, as requested. The skill keeps no long-term monitoring history: an on-demand run leaves no state, while active monitoring keeps only the previous tick and the current availability-run state in a temporary runtime directory. That directory is deleted when monitoring stops. Manual station identity overrides belong in adjacent configuration, not in an accumulating history database.

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
type SourceId = "yandex" | "gdebenz" | "2gis";

interface BrowserRunner {
  ensureRunSession(): Promise<BrowserSession>;
  open(url: string): Promise<void>;
  waitReady(condition: ReadyCondition): Promise<void>;
  evalJson<T>(expression: string): Promise<T>;
  snapshot(): Promise<BrowserSnapshot>;
  close(): Promise<void>;
}

interface SourceAdapter {
  readonly id: SourceId;
  collect(request: CollectorRequest, ctx: CollectContext): Promise<SourceResult>;
}
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

The scripts never issue a global `agent-browser close --all` outside their owned namespace. `SIGINT`, `SIGTERM`, user cancellation, adapter timeout, CAPTCHA, and thrown internal errors all pass through the same cleanup path. A hard process kill is covered by the 10-second daemon idle timeout. Monitoring stop also retries cleanup for the last recorded owned namespace before confirming completion.

Runtime extraction uses page DOM or JavaScript evaluated in the loaded origin. HAR/network recording is a development and repair tool only because persistent HAR files can contain cookies and other sensitive metadata.

### Yandex Maps

1. Open a minimal Volgograd search URL containing only the search text, fuel filters, center/viewport, and pagination parameters needed for the configured area.
2. Wait until station result nodes or the server state script exists.
3. Extract station cards and structured `fuelAvailability` fields using `agent-browser eval` from the loaded page.
4. Collect station ID, coordinates, title, address, per-grade status, `lastSignalTimestamp`, `signalsCountPerHour`, queue status/label, and source URL.
5. Traverse additional pages or scroll batches until an empty/repeated station-ID set or a configured cap. Never stop merely because a page is shorter than an expected page size.
6. Emit `SCHEMA_CHANGED`, `TRUNCATED`, `CHALLENGE`, or `TIMEOUT` explicitly; never convert parser failure into an empty result.

Completeness invariants include minimum fuel-block coverage, timestamp coverage, coordinate coverage, duplicate ratio, station-count baseline for the configured area, and evidence that pagination terminated naturally. A material regression marks the result `PARTIAL` or `SCHEMA_CHANGED`; rankings from partial coverage are labelled incomplete.

Yandex is expected to be the strongest current-availability and queue source, but it remains an unofficial page representation and is not treated as guaranteed telemetry.

### gdebenz

1. Navigate the run's browser tab to `https://gdebenz.ru/`.
2. Wait for the application to initialize.
3. Use browser-evaluated same-origin JavaScript or the page's already-loaded state to retrieve the station data for the configured bounding box. This is still browser-mediated runtime access and avoids a separate direct HTTP transport.
4. Normalize station IDs, coordinates, name/brand/address, general status, grade-specific fields, freshness bands/timestamps, conflict indicators, and queue-presence signals when exposed.
5. Preserve unknown raw fields as provenance. Do not assume an undocumented freshness-band order until fixtures or cross-source observations validate it.

The automated browser previously received a transient 502 while the user's normal browser worked. Therefore a single 502 is retried in-session and reported as a source-health event, not evidence that the service is unusable.

Grade-blind positive or negative reports never become direct evidence for a specific grade. A source that cannot represent premium AI-95 cannot directly confirm or deny `AI95_PREMIUM`.

### 2GIS

1. Navigate the run's browser tab to a simplified petrol-station search URL.
2. Wait for result cards and inspect station details needed for identity, offered grades, and any current status/queue data visible in the page.
3. Detect `/captcha`, `/museum`, reCAPTCHA text, challenge forms, or a repeated redirect as `CHALLENGE`.
4. Never solve, click through, or bypass CAPTCHA automatically. The report names the source as unavailable for that tick.
5. Static catalogue claims such as "this station normally offers AI-95" have zero current-availability weight. Only explicitly current data with usable freshness metadata becomes an availability observation.

The official 2GIS API is deferred because the user chose one unified `agent-browser` transport. It can be reconsidered later as an optional adapter if the user prefers a registered API key and a stable contract.

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
  kind: "TRANSACTIONS_RESUMED" | "TRANSACTIONS_ONGOING" | "RECENT_SIGNAL" | "NONE";
  eventTimes: string[];
  precedingGapMinutes?: number;
  gradeSpecific: boolean;
  sourceTerminology: "TRANSACTION" | "REPORT" | "SIGNAL";
}
```

Fetch time is provenance and never substitutes for observation time.

The default fuel query is a union of `AI_95` base and all configured branded/premium AI-95 variants. Plain AI-95 and each specific premium variant remain distinct products internally. A family-only observation may support the broad family query but cannot prove a particular branded variant.

## Area configuration

```ts
type AreaConfig =
  | { kind: "rectangle"; south: number; west: number; north: number; east: number }
  | { kind: "polygon"; coordinates: Array<[number, number]> }
  | {
      kind: "station-anchors";
      anchors: Array<{ label: string; sourceId?: string; lat?: number; lon?: number }>;
      boundary: "convex-hull";
      bufferMeters: number;
      unresolvedPolicy: "fail-closed";
    };
```

Rectangle is the simple editing format. When the user supplies outermost acceptable stations, `resolve-area.mjs` looks them up through the browser adapters, presents the resolved coordinates for confirmation, then writes a convex-hull polygon. At least three unique non-collinear anchors are required.

The initial Volgograd default uses the eleven user-provided stations below and `bufferMeters: 500`. A preliminary read-only geocoding pass produced these `[lon, lat]` coordinates; implementation must re-verify them against at least one target map before committing the final config:

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

Eight of the eleven points form the convex hull. Череповецкая 5А, Глубокоовражная 25, and Симбирская 1Б are interior control anchors. All eleven remain in config for traceability and later revalidation.

Two additional test stations were checked through `agent-browser`. The supplied 2GIS pages returned CAPTCHA, so coordinates were resolved through browser-mediated Nominatim and compared with the unbuffered hull:

- Ангарская ул., 8А: `[44.4940448, 48.7150466]` — inside the unbuffered hull;
- ул. Рокоссовского, 4Б: `[44.4925455, 48.7101139]` — inside the unbuffered hull.

Both therefore remain inside after the 500-metre outward buffer as well.

Geometry validation rejects reversed bounds, self-intersections, invalid coordinates, and implausibly large areas. Boundary points count as inside.

Resolved anchor station keys are always included even if a later source coordinate moves a few metres outside the stored hull. This prevents the user's explicitly named outermost station from disappearing because of harmless coordinate drift without silently expanding the entire polygon.

## Station identity

Prefer explicit source IDs and configured identity overrides. Otherwise match conservatively using geographic distance plus normalized brand/name/address, with a one-to-one assignment per source. A coordinate difference of 50–100 metres is tolerated as possible source imprecision but is never sufficient to merge records: nearby stations can genuinely be that close. Conflicting known brands are a hard reject. Ambiguous matches remain separate; a duplicate row is safer than combining observations from different stations.

Automatic merges additionally require address-number agreement when present and a clear margin over the second-best candidate. Queue observations are never transferred across a probabilistic match below the highest match-confidence tier. Every merge stores its provenance and match confidence for later inspection.

Manual cross-source identity overrides are stored in adjacent configuration with source IDs and addresses. No learned registry is accumulated across completed monitoring sessions.

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

### Transaction or signal resumption

Where a service exposes recent grade-specific transactions, reports, or signals, the adapter preserves the event times and the source's own terminology. The skill never renames a generic crowd signal to a payment transaction.

For the requested grade, `TRANSACTIONS_RESUMED` means a configurable long quiet gap (default 60 minutes) followed by at least two new events inside a short window (default 20 minutes). This is the strongest positive heuristic: fuel was apparently unavailable or inactive, then grade-specific activity restarted and may not yet have accumulated a large queue. `TRANSACTIONS_ONGOING` is weaker but still stronger than a status-only claim. Aggregate station activity that cannot be tied to AI-95 may support freshness or demand context but cannot prove AI-95 availability.

During monitoring, a change from zero recent grade-specific events to new events can establish the resumption window even if the source exposes only a rolling count and latest timestamp. In an on-demand cold run, resumption is claimed only when the current page itself exposes enough event history to demonstrate the preceding gap.

## Queue normalization and ranking

Comparable queue data is ordinal or a vehicle count. A presence-only signal renders as "очередь есть, размер неизвестен" and is excluded from shortest-queue comparisons. Unknown queue data is not silently treated as zero.

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

The wait implementation must not issue one 15-minute `sleep` or keep a browser/process alive during the interval. A small temporary state file contains only the previous tick, current availability-run state, due time, and consecutive failure count. It is deleted on stop, cancellation, or normal monitoring completion.

After four consecutive ticks with no fresh grade-specific observation from any source, monitoring remains active to respect the requested cadence but switches repeated null reports to a compact degraded summary. It never floods the task with a full identical empty report.

## Output

Each summary contains:

1. timestamp, area label, and requested grades;
2. source health (`OK`, `PARTIAL`, `CHALLENGE`, `SCHEMA_CHANGED`, `TIMEOUT`, `HTTP_ERROR`, `DISABLED`), always naming any service blocked by CAPTCHA or another failure;
3. changes since the previous tick;
4. ranked positive and likely-positive stations;
5. conflicting/indirect evidence;
6. counts of negative and no-fresh-data stations;
7. an unconditional warning that reports are crowdsourced/page-derived and may be delayed.

Example row:

```text
1. Лукойл · ул. Рокоссовского, 1Р
   95: ЕСТЬ (средняя, 8 мин) · 95+: НЕТ
   очередь: большая · 95 появился между 15:45 и 16:00
   источник: Яндекс · статус обновлён 16:15
```

No availability claim is rendered without confidence and freshness information. Repeat-report diffs compare verdict, confidence, and queue transitions, not rank movement or harmless age drift inside the same freshness band.

## Failure isolation

Adapters return typed health instead of throwing for expected failures:

- `NETWORK`, `TIMEOUT`, `HTTP_STATUS`, `CHALLENGE`, `BODY_TOO_LARGE`, `SCHEMA_CHANGED`, `TRUNCATED`, `EMPTY_RESULT`, `ABORTED`, `INTERNAL_ADAPTER_ERROR`.

`EMPTY_RESULT` and `SCHEMA_CHANGED` are never conflated. A challenge opens no bypass workflow. One failed source never cancels the remainder of the sequential collection. The browser session is recreated once after a bounded browser-level failure; repeated challenge/4xx responses open a per-source circuit for the current tick and are named in the report.

Monitoring does not auto-stop merely because data is degraded. It continues at the requested cadence and makes degradation prominent until the user stops monitoring.

## Testing and repairability

- Pure unit tests for fuels, geometry, identity, verdicts, queues, ranking, and diffs.
- Recorded, redacted browser-extraction fixtures for all source adapters; no network in unit tests.
- Contract tests against a fake `BrowserRunner` so adapter logic is independent of the CLI process.
- Integration tests with an installed `agent-browser` using local fixture pages.
- Browser-wide outage, orphan cleanup, 50-second wait chunking, user-stop interruption, and temporary-state deletion tests.
- A repeated-run soak test executes at least 20 collection cycles and asserts that no owned sessions remain after each cycle and that browser/daemon RSS does not trend upward beyond a defined tolerance after cleanup.
- Opt-in live smoke tests for each source; never run automatically every 15 minutes.
- Challenge, 502, empty page, partial pagination, stale data, unknown time, and schema drift fixtures.
- Exhaustive verdict/confidence table tests, including close conflicting timestamps and grade-blind premium cases.
- Availability-run tests for confirmed transition, first-seen-without-history, unknown gaps, two-tick anti-flap confirmation, and source-reported transition time.
- Activity tests for grade-specific gap→resume, ongoing activity, aggregate non-grade-specific activity, rolling-count resumption across two ticks, and cold on-demand runs without enough history.
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
| Retain only previous-tick temporary state during active monitoring | adopted | User does not want a stored history; minimum state is needed for transitions and diffs | user |
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

## Open questions for later configuration, not architecture

1. Reference point for distance tie-breaking; default is area centroid.
2. Exact freshness thresholds after a short period of real observations.
3. Full report every tick versus compact changes plus current top results; default is changes plus current top five.
