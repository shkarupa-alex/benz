## Facts & Constraints (White Hat)

Before judging this spec I checked the one dependency it stakes everything on: `agent-browser` 0.35.1 is installed here, and the CLI surface the spec assumes does exist — `--namespace`, `--session`, `--idle-timeout <time>`, `session list --json` (returns `{"success":true,"data":{"sessions":[]}}` scoped per namespace), `close [--all]`, `eval` (with `-b/--base64` and `--stdin`), `wait --fn/--text/--load`, `batch`. So the transport contract is not fantasy. That matters, because a browser-only V1 whose CLI verbs were invented would be dead on arrival. Several second-order constraints, however, are not addressed:

- `open` has **no documented HTTP-status output** and no `--timeout`. The spec requires detecting gdebenz's 502 and classifying `HTTP_STATUS` — with `open` alone that is not observable. Detection must be defined (page-text heuristic, or `network requests --filter` after navigation).
- Timeout enforcement cannot rely on shell `timeout`: this machine's shell reports `command not found: timeout` (macOS/zsh). Per-command budgets must be enforced from Node (`child_process` `timeout` option + `SIGKILL`), which the spec never says.
- `--max-output <chars>` truncates page output globally. A single `eval` returning dozens of stations with preserved raw provenance fields is exactly the payload that gets silently clipped. The spec lists `BODY_TOO_LARGE`/`TRUNCATED` as error kinds but never defines the eval output-size limit, chunking strategy, or how truncation is *detected* rather than parsed as short data.
- `--idle-timeout` is a **daemon-level** setting applied at daemon launch, and it kills the daemon after inactivity. `10s` is aggressive for a run where the gap between two CLI invocations includes JS extraction, JSON parsing, and pagination logic. A mid-run daemon death would surface as a spurious source failure, and the spec's own "recreate one failed session once" would mask it as flaky sources rather than misconfiguration.
- Volgograd's timezone history is a real trap (UTC+4 in 2018–2020, UTC+3 since Dec 2020). The spec computes every verdict from `now − lastSignalTimestamp` and never states the timestamp format contract (epoch s/ms vs offset-bearing string), the display timezone, or the rule for rejecting ambiguous timestamps.

Data-wise, the empirically observed Yandex fields are `lastSignalTimestamp` (one instant) and `signalsCountPerHour` (a rolling rate). The spec's `ActivityEvidence.eventTimes: string[]` and its `TRANSACTIONS_RESUMED` rule ("≥2 new events within 20 minutes after a ≥60-minute gap") presuppose an **event list that the only working source apparently does not expose**.

## Risks & Failure Modes (Black Hat)

**1. The user's top-priority heuristic may be inert (most serious).** `TRANSACTIONS_RESUMED` is ranking criterion #1 and the user's explicitly strongest signal. But: (a) from `signalsCountPerHour` + one timestamp you cannot reconstruct two events in a 20-minute window; (b) with a 15-minute cadence you get at most one sample per 15 min, so "two events inside 20 minutes" is unobservable from tick deltas; (c) the spec itself rules that station-level aggregate activity "cannot prove AI-95 availability" — and `signalsCountPerHour` is plausibly station-level, not grade-scoped. Combine those and criterion #1 never fires in either mode, ranking silently collapses to criteria 2–5, and the feature the user cared most about ships as dead code with an unfalsifiable spec sentence covering it. The spec needs a concrete derivation formula from the actually-observed fields, a stated fallback when the field is grade-blind, and an explicit acceptance test that fails loudly if the source stops carrying grade-scoped activity.

**2. The monitoring loop's stop mechanism is undefined.** "Wait in foreground chunks ≤50 s, checking for new user input or a stop request between chunks" — *by what mechanism*? An agent mid-turn has no API to poll for queued user messages; in most harnesses a user message either interrupts the turn or is queued invisibly. If the real mechanism is "the harness interrupts the turn," then the 50-second chunking buys nothing beyond making interruption latency bounded, and the cleanup-on-interrupt path runs *only if* the harness lets the agent finish a `finally`. That is precisely the case where an orphaned browser survives — the failure mode the user explicitly demanded be impossible. There is also no defined out-of-band stop (e.g. a sentinel file `STOP` in the runtime dir that each chunk boundary checks), which is the conservative implementable answer.

**3. Unbounded monitoring vs. finite context.** 15 min ÷ 50 s ≈ 18 tool calls per tick, plus a full collection and report, "until the user asks to stop". Nothing in the spec bounds ticks, addresses context exhaustion/compaction mid-loop, or defines resume-after-compaction (the temp state file would survive; the agent's loop intent may not). "Monitoring does not auto-stop merely because data is degraded" is stated; the token/context ceiling is not.

**4. Namespace cleanup contradicts itself.** Namespaces are `fuel-watch-<runId>` (unique per run), yet the runner must "close orphaned sessions in its own namespace" and never act outside it. A unique namespace can contain no orphans from prior runs, so this rule is vacuous exactly when orphans matter (hard kill on tick N, new namespace on tick N+1). "Monitoring stop also retries cleanup for the last recorded owned namespace" covers one namespace, not a crash chain. There is no defined owned-namespace registry file, no enumeration mechanism (`session list` is per-namespace; the spec never says how you discover `fuel-watch-*`), and no TTL for stale runtime dirs. The 10-second daemon idle timeout is the actual safety net — which makes the elaborate verification steps partly theatre unless the registry is specified.

**5. Central types are missing.** `SourceAdapter.collect` returns `Promise<SourceResult>` and `SourceResult` **is never defined**. Same for `CollectorRequest`, `CollectContext`, `ReadyCondition`, `BrowserSnapshot`, `BrowserSession`. Also missing: the snapshot file schema written by `collect.mjs`, the CLI contract (flags, stdin/stdout shape, exit codes) for all three entry scripts, and the runtime state-dir path/file names. Two adapter implementers working in parallel would produce incompatible shapes.

**6. The verdict/confidence table is asserted, not written.** "The full verdict/confidence table is finite and exhaustively tested" — but the table is absent. The prose rules (direct > family-only, 30-minute conflict window, single-source capped at medium unless "exact fresh timing plus a configured strong signal count", `UNKNOWN` never adds confidence) are necessary but not sufficient to determine an output for, say, {fresh direct `LIMITED` from Yandex, recent family-only `IN_STOCK` from gdebenz, groups configured as dependent}. A weaker model will invent the rest.

**7. Identity matching has no numbers.** "Distance plus normalized brand/name/address", "clear margin over the second-best candidate", "highest match-confidence tier", "one-to-one assignment" — no distance ceiling, no string metric or threshold, no margin value, no tier definitions, no assignment algorithm (greedy vs Hungarian). Given the user's explicit warning that distinct stations sit 50–100 m apart, this is the section most likely to be implemented wrong and produce merged-station false positives.

**8. Geometry buffering is under-specified.** "Convex hull expanded outward by 500 metres" has no algorithm. In lat/lon, 500 m is 0.00449° of latitude but 0.00682° of longitude at 48.72°N. Offsetting vertices radially from the centroid is *not* a 500 m buffer and gives different inclusion near corners than a Minkowski sum with a circle. The spec should pin: project to local ENU metres at a fixed origin, Minkowski-sum with an N-segment circle (N stated), reproject, and use ray-casting with boundary-inclusive. "Implausibly large areas" also has no numeric threshold.

**9. Geocoding is an undeclared fourth source.** The anchor coordinates were resolved via browser-mediated Nominatim, and `resolve-area.mjs` is said to "look them up through the browser adapters" — but 2GIS CAPTCHAs and gdebenz may be down, so the real path is a geocoder that appears in no architecture diagram, no config, no kill-switch list, and no legal posture (Nominatim's usage policy and OSM attribution are real obligations).

**10. `BOUNDED_AGE` straddling bands is undefined.** A gdebenz band of "30–90 minutes" spans fresh and recent. No rule (conservative = use `maxMinutes`) is given, yet this directly changes whether a station qualifies as currently available.

**11. Anti-flap vs. current verdict interaction is unspecified.** The two-tick confirmation governs availability-*run* resets; it does not say whether an unconfirmed flip suppresses the station from the primary list or only from the "appeared at" claim.

**12. Concurrency.** Nothing prevents an on-demand run during active monitoring from colliding on the runtime dir or spawning a second browser; no lock file, no state-dir keying.

## Strengths & Benefits (Yellow Hat)

This is genuinely above-average design work, and several parts I tried hard to break held up:

- **Epistemics are the spec's best feature.** Separating fetch time from observation time; refusing pseudo-probabilities in favour of an auditable categorical verdict + confidence; forbidding `UNKNOWN` from raising confidence; refusing to treat Yandex and gdebenz as independent evidence sources merely because they are different domains; and forbidding static 2GIS catalogue claims from carrying current-availability weight. These are exactly the errors this class of tool normally makes.
- **Separating data freshness from availability-run age** is correct and non-obvious, and the four reporting phrasings ("появился между X и Y" / "впервые увидели" / "наблюдаем не менее N" / "время появления неизвестно") map cleanly onto the four evidence states.
- **Lexicographic ranking** instead of invented cross-unit arithmetic is the right call and is directly testable.
- **Never stop pagination on a short page** is a specific, empirically-grounded rule that prevents a classic silent-truncation bug; pairing it with completeness invariants and `SCHEMA_CHANGED ≠ EMPTY_RESULT` is strong.
- **Cleanup discipline** (top-level `finally`, namespace-scoped `close --all` never global, `session list` verification, signal handling, idle-timeout backstop, 20-cycle RSS soak test) is more rigorous than most specs, even with the registry gap above.
- **Conservative identity policy** (duplicate row beats false merge, brand conflict = hard reject, queue never transferred across a weak match) correctly encodes the user's constraint even though it lacks thresholds.
- **Pinning named anchor stations as always-included** is a thoughtful catch that a lesser spec would have missed.

## Alternatives & Creative Ideas (Green Hat)

- **Ship Yandex-only as V1a.** Empirically, 2GIS CAPTCHAs (yielding only static catalogue data with zero availability weight) and gdebenz 502s. So V1 is effectively single-source — yet the spec funds cross-source identity matching, one-to-one assignment, independence-group configuration, and multi-source confidence boosting, all of which are unexercisable and untestable against reality on day one. Cutting V1a to Yandex + full verdict/ranking/monitoring machinery, with the adapter interface in place but the other two adapters default-**disabled**, removes the largest block of speculative code and the repeated automated CAPTCHA triggering. (The spec says every source has a kill switch but never states default enablement — that is itself a gap.)
- **Sample activity faster than you report.** The `TRANSACTIONS_RESUMED` gap→resume detection is starved by a 15-minute sampling rate. A cheap fix that respects the "one collection per 15 minutes" budget: extract, at each tick, the source's *own* historical fields (rolling count, latest timestamp, any per-hour series) and define resumption from the count delta with an explicit inequality, rather than pretending to have an event list. Alternatively state plainly that resumption is monitoring-only and downgrade it to criterion #2 for on-demand.
- **Replace "check for user input" with a sentinel file.** `STOP` / `stop.json` in the runtime dir, checked at every chunk boundary, gives a mechanism that is implementable, testable, and works regardless of harness interrupt semantics — with harness interrupt as the additional path.
- **Owned-namespace registry.** A single `namespaces.json` in the runtime dir listing every namespace this skill has created, cleaned on start and on stop, makes "never touch namespaces you don't own" both enforceable and orphan-proof.
- **Use `agent-browser batch`** for the open→wait→eval sequence: fewer process spawns, less exposure to the 10 s idle window, and a natural place for `--bail` semantics.
- **Golden geometry fixtures already exist** in the task: Ангарская 8А and Рокоссовского 4Б as interior points, plus the three interior anchors and eight hull vertices. The spec should name them as required test cases rather than leaving geometry tests generic.

## Completeness & Process (Blue Hat)

Sections present and coherent: architecture, responsibilities, transport, per-source procedures, data model, area config, identity, freshness/confidence, availability-run age, activity, queue/ranking, both modes, output, failure isolation, testing, legal posture, decision ledger, open questions. Structurally this covers the task's checklist.

Missing or thin: `config.json`/`config.schema.json` content (the spec references both files and scatters thresholds in prose — 45/180/360 min, 60-min gap, 2 events/20 min, two-tick confirmation, four-tick degraded summary, 30-min conflict window — without key names, types, or defaults in one place); the verdict/confidence table; identity thresholds; the per-source **capability matrix** (see Traceability); script CLI/exit-code contracts; snapshot and state file schemas; timeout/retry numbers; report language and timezone; geocoding dependency; default enablement per source; RSS tolerance ("defined tolerance" is a TBD in disguise, outside Open Questions).

The Open Questions section is appropriately small and genuinely configuration-level. The problem is that a dozen *architectural* unknowns are phrased as declarative prose rather than admitted as open, which is more dangerous than an honest TBD.

## Traceability

The Decision Ledger exists and is unusually complete — 30 entries with rationale and provenance. I checked each adopted entry against the body:

- **One clear miss:** "Add per-source capability matrix and completeness invariants" is marked *adopted*, but only the completeness invariants appear (Yandex section). **No capability matrix exists anywhere in the body.** This is not cosmetic: the grade-blind rules ("a source that cannot represent premium AI-95 cannot confirm or deny `AI95_PREMIUM`", "static catalogue claims have zero weight", queue-kind differences) all presuppose a per-source table of which products, statuses, timestamps, queue kinds, and activity terminology each source can express. That table is the input to the verdict engine and it is absent.
- Every rejected/deferred entry does appear in "Rejected / deferred alternatives" or in the relevant body section (HTTP-first, heartbeat, 15-min sleep, persistent sessions, history, probabilities, coordinate-only merge, 2GIS API, CAPTCHA bypass, queue-first ranking, Yandex/gdebenz independence, HAR retention). No orphans found there.
- Minor: two entries ("Use direct HTTP…", "Use official 2GIS API in V1") are phrased as the *option* rather than the decision, so their Status column reads oddly ("rejected"/"deferred" against a positively-phrased decision) — harmless but worth normalising.

## Decomposition Readiness

Partially ready. Cleanly cuttable today: geometry (once the buffer algorithm is pinned), fuel alias normalization, queue normalization, diffing, report rendering, cleanup/lifecycle. **Not cuttable without new architectural decisions:** (a) source adapters — `SourceResult`/`CollectorRequest`/`CollectContext` undefined, so any two adapters will diverge; (b) `verdict.mjs` — the table is missing; (c) `identity.mjs` — every threshold missing; (d) `ranking.mjs` criterion 2 ("number **and quality** of services") is a two-dimensional comparison inside a lexicographic ordering with no stated tiebreak between count and quality; (e) the monitoring loop — stop mechanism undefined; (f) `resolve-area.mjs` — depends on an undeclared geocoder; (g) config — no schema, so every module invents its own key names.

## Weak-Model Executability

A less capable model would guess in at least seven places: the verdict table, identity thresholds and the assignment algorithm, the 500 m buffer algorithm, the Yandex URL/pagination scheme (the spec says "search text, fuel filters, center/viewport, and pagination parameters" without a template or a discovery procedure, and Yandex Maps search is scroll-based rather than page-parameterised), timestamp parsing/timezone, 502 detection given `open`'s output, and eval-output chunking. Vague directives to flag verbatim: "enforce timeouts" (no numbers), "wait for the application to initialize" (no `--fn` condition), "a clear margin over the second-best candidate", "a configured strong signal count", "implausibly large areas", "RSS does not trend upward beyond a defined tolerance", "meaningfully independent" provenance groups. The BrowserRunner interface *is* given with method signatures — good — but four of its parameter/return types are undefined, which negates most of that benefit.

## Contract Completeness

Schemas: the TypeScript data model is the strongest part (`FuelObservation`, `QueueObservation`, `AvailabilityRun`, `ActivityEvidence`, `AreaConfig` are precise and well-typed). Against that, the missing pieces are conspicuous: no `SourceResult`, no config schema, no snapshot/state schemas, no script CLI contracts, no capability matrix, no verdict table. Error cases are enumerated well as a *type list* (`NETWORK` … `INTERNAL_ADAPTER_ERROR`) but several lack detection rules (`HTTP_STATUS`, `BODY_TOO_LARGE`, `TRUNCATED`) and none has a defined retry/backoff beyond "recreate one session once" and "one 502 retry". Limits and thresholds: freshness bands and activity windows are numeric (good); per-source timeouts, total run budget, pagination cap, output-size cap, station-count baseline, area-size limit, match distance, RSS tolerance are all unquantified. Test expectations are listed as categories rather than assertions, and the named golden cases the task already provides (the two interior control stations, the eight hull vertices) are not wired into the test plan. TBDs outside Open Questions: "implementation must re-verify [anchor coordinates] against at least one target map", "defined tolerance", and the deferred independence-group configuration.

---

**Bottom line:** the reasoning quality — epistemics, freshness/run-age separation, lexicographic ranking, cleanup discipline, conservative identity policy — is high, and I could not break the *judgment* layer. What I could break is the *contract* layer: the document reads as a very good design memo, not yet as an implementation source of truth, which is what it claims to be in its own first line. Two findings are substantive design issues rather than documentation gaps: the top-priority `TRANSACTIONS_RESUMED` heuristic likely cannot be computed from the source data actually observed, and the monitoring stop mechanism has no implementable definition. Those two, plus the missing verdict table, adapter return type, config schema, identity thresholds, and capability matrix, should be closed before implementation starts.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "spec-review",
      "approval_score": 6,
      "would_adopt": false,
      "summary": "Architecturally sound and epistemically unusually careful — the separation of fetch time from observation time, categorical verdicts instead of fake probabilities, refusal to treat Yandex and gdebenz as independent, lexicographic ranking, conservative identity policy, and the ephemeral-browser cleanup discipline all survived deliberate attack, and I verified against the installed agent-browser 0.35.1 that the assumed CLI surface (--namespace, --idle-timeout, session list --json, eval, close --all) genuinely exists. But the document claims to be the implementation source of truth and is not yet one: the central adapter return type SourceResult is never defined, the 'finite and exhaustively tested' verdict/confidence table is absent, identity matching has no numeric thresholds, the config.json/config.schema.json it references have no content, the ledger-adopted per-source capability matrix appears nowhere in the body, and the 500 m hull buffer, Yandex URL/pagination scheme, timestamp/timezone parsing, 502 detection and eval output limits are all left to the implementer. Two issues are design-level rather than documentation-level: the user's top-ranked TRANSACTIONS_RESUMED heuristic requires an event timeline that the only working source (lastSignalTimestamp + signalsCountPerHour, possibly station-level rather than grade-scoped) apparently does not expose and that 15-minute sampling cannot reconstruct, and the monitoring loop's 'check for user input between 50-second chunks' has no implementable mechanism, which also puts the guaranteed-cleanup promise at risk. Close those and this is an 8+.",
      "phase": "spec-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "critical",
          "area": "Activity heuristic / ranking",
          "description": "TRANSACTIONS_RESUMED is ranking criterion #1 and the user's strongest stated signal, but it is defined as '>=2 new events within 20 minutes after a >=60-minute gap' over ActivityEvidence.eventTimes[], while the only empirically working source exposes one lastSignalTimestamp plus a rolling signalsCountPerHour. Two events in a 20-minute window cannot be reconstructed from 15-minute sampling, and if signalsCountPerHour is station-level the spec's own grade-blind rule disqualifies it from proving AI-95. Result: criterion #1 silently never fires, ranking collapses to criteria 2-5, and the feature the user cared most about ships inert.",
          "required_change": "Define the exact derivation of precedingGapMinutes and resumption from the fields actually observed (lastSignalTimestamp delta, signalsCountPerHour delta) with a stated inequality; state explicitly whether the source's activity data is grade-scoped and what the heuristic degrades to when it is not; state that cold on-demand runs cannot claim resumption; add a test that fails loudly when the grade-scoped activity field disappears."
        },
        {
          "id": "",
          "severity": "critical",
          "area": "Monitoring lifecycle",
          "description": "'Wait in foreground chunks <=50s, checking for new user input or a stop request between chunks' specifies no mechanism. An agent mid-turn has no API to poll queued user messages; if the real mechanism is harness interruption, the chunking buys nothing and the top-level finally cleanup may not run on interrupt - producing exactly the orphaned browser the user forbade. There is also no bound on monitoring duration and no handling of context exhaustion/compaction during an open-ended loop.",
          "required_change": "Specify a concrete, testable stop path: a sentinel file (e.g. <runtimeDir>/STOP) written by the user or by SKILL.md instructions and checked at every chunk boundary, plus harness interrupt as a secondary path; specify what cleanup runs on each path; state behaviour on context compaction (state file survives, loop re-entry procedure) and whether any maximum tick count applies."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Contracts / data model",
          "description": "SourceAdapter.collect returns Promise<SourceResult> and SourceResult is never defined; CollectorRequest, CollectContext, ReadyCondition, BrowserSnapshot and BrowserSession are likewise undefined. The snapshot file written by collect.mjs, the monitoring state file, and the CLI contracts (flags, stdout shape, exit codes) of collect.mjs/report.mjs/resolve-area.mjs have no schemas. Parallel implementers will produce incompatible shapes.",
          "required_change": "Add full type definitions for every referenced interface, a JSON schema (or TS type) for the snapshot and monitoring state files, and an explicit CLI contract table for the three entry scripts including exit codes for OK / PARTIAL / degraded / cleanup-failed."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Verdict engine",
          "description": "The spec asserts 'the full verdict/confidence table is finite and exhaustively tested' but the table is absent. The prose rules do not determine outputs for mixed cases (e.g. fresh direct LIMITED plus recent family-only IN_STOCK from a dependent provenance group), and terms like 'a configured strong signal count' and 'meaningfully independent' are undefined.",
          "required_change": "Enumerate the verdict x confidence table as an explicit decision table over (evidence directness, status, freshness band, source count, independence group, conflict window), define the strong-signal threshold and the independence-group config format, and define how a BOUNDED_AGE range straddling two freshness bands is classified (recommend: use maxMinutes)."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Station identity",
          "description": "Matching is described only qualitatively: 'geographic distance plus normalized brand/name/address', 'one-to-one assignment', 'a clear margin over the second-best candidate', 'highest match-confidence tier'. No distance ceiling, string metric or similarity threshold, margin value, tier definitions, or assignment algorithm is given - in the very area the user flagged as dangerous (distinct stations 50-100 m apart).",
          "required_change": "Specify the distance ceiling, the normalization pipeline and string-similarity metric with a numeric threshold, the numeric second-best margin, the definition of each match-confidence tier, and the assignment algorithm (greedy vs optimal), with fixture tests covering two real stations 60 m apart under different brands and under the same brand."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Traceability / capability matrix",
          "description": "The Decision Ledger marks 'Add per-source capability matrix and completeness invariants' as adopted, but only the completeness invariants appear in the body. No capability matrix exists, yet the grade-blind evidence rules, the zero-weight rule for static catalogue data, queue-kind handling and activity terminology all depend on it.",
          "required_change": "Add a per-source capability matrix (products representable, status vocabulary, timestamp kind/precision, queue kind, activity terminology, grade-scoping yes/no, expected coverage) and reference it from the verdict and ranking sections."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Configuration",
          "description": "config/config.json and config/config.schema.json are architectural components with no specified content. Thresholds are scattered through prose (45/180/360 min, 60-min gap, 2 events/20 min, 30-min conflict window, two-tick confirmation, four-tick degraded summary, default AI-95 variant aliases, per-source enablement, independence groups, reference point) with no key names, types, or defaults, and no default enablement per source is stated despite every source having a kill switch.",
          "required_change": "Include a complete example config.json with every key referenced anywhere in the spec plus its default value, and a field-by-field description that config.schema.json must enforce; state the V1 default enabled/disabled status of each of the three sources."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Geometry",
          "description": "'Convex hull expanded outward by 500 metres' has no algorithm. At 48.72N, 500 m is 0.00449 deg latitude but 0.00682 deg longitude; radial vertex offset from the centroid is not a 500 m buffer and yields different corner inclusion than a Minkowski sum. 'Implausibly large areas' has no numeric threshold. The two supplied interior control points and the eight hull vertices are not wired into the test plan.",
          "required_change": "Pin the buffering algorithm (project to local ENU metres at a stated origin, Minkowski-sum with an N-segment circle with N specified, reproject, boundary-inclusive ray casting), give a numeric maximum area, and name Angarskaya 8A, Rokossovskogo 4B, the three interior anchors and the eight hull vertices as required geometry fixtures."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Browser transport details",
          "description": "Three concrete transport gaps: (1) --idle-timeout 10s risks killing the daemon mid-run whenever the gap between CLI invocations exceeds 10 s, surfacing as spurious source failure; (2) agent-browser open exposes no HTTP status and no --timeout, so the required 502 detection and per-source timeouts have no defined mechanism, and shell 'timeout' is unavailable on macOS; (3) --max-output truncation of a large eval payload is not addressed, so TRUNCATED/BODY_TOO_LARGE have no detection rule and a clipped station list could be parsed as complete data.",
          "required_change": "Raise the idle timeout above the maximum expected inter-command gap (or justify 10 s with a measured bound) and rely on explicit close; define 502/HTTP-status detection (page-text heuristic and/or network requests inspection); mandate Node child_process timeouts rather than shell timeout, with per-source and per-run numeric budgets; define eval payload chunking, an explicit size cap, and a sentinel-based truncation check."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Cleanup / orphan handling",
          "description": "Namespaces are unique per run (fuel-watch-<runId>), so 'close orphaned sessions in its own namespace' can never find cross-run orphans, and there is no defined registry or enumeration mechanism for previously owned namespaces, nor a TTL for stale runtime directories after a hard kill.",
          "required_change": "Add an owned-namespace registry file in the runtime dir, cleaned on start and stop, plus a stale-runtime-dir TTL sweep at start; state explicitly that the 10 s daemon idle timeout is the backstop for hard kills."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Time handling",
          "description": "Every verdict derives from now minus lastSignalTimestamp, yet the timestamp format contract (epoch seconds vs milliseconds vs offset-bearing string), the report display timezone, and the rule for ambiguous or offset-less timestamps are unspecified. Volgograd's UTC+4/UTC+3 history makes naive local parsing a real correctness hazard.",
          "required_change": "State the accepted timestamp formats per source, mandate conversion to epoch UTC with explicit rejection (ObservationTime UNKNOWN) of offset-less values, state the report display timezone, and add parsing fixtures including an offset-less and a millisecond-epoch case."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Scope / YAGNI",
          "description": "Empirically 2GIS CAPTCHAs (yielding only zero-weight static catalogue data) and gdebenz 502s, so V1 is effectively single-source, yet the spec funds cross-source identity matching, one-to-one assignment, independence groups and multi-source confidence boosting that cannot be exercised or validated on day one - while re-triggering the 2GIS challenge every 15 minutes for no availability value.",
          "required_change": "Declare a V1a slice (Yandex adapter plus full verdict/ranking/monitoring/cleanup machinery, other adapters implemented against the interface but default-disabled), and state the cross-source machinery is validated by fixtures until a second source proves usable."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Area resolution dependency",
          "description": "Anchor geocoding was performed via browser-mediated Nominatim, and resolve-area.mjs is said to use 'the browser adapters' which may all be blocked or down. The geocoder appears in no architecture diagram, config, kill-switch list, or legal posture, despite Nominatim's usage policy and OSM attribution requirements.",
          "required_change": "Declare the geocoding dependency explicitly as a fourth, resolve-time-only adapter with its own config entry, rate limit, attribution note and fail-closed behaviour, or specify manual coordinate entry as the supported fallback."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "Reporting noise",
          "description": "A full report is published every 15 minutes; the compact degraded summary triggers only after four ticks with no fresh grade-specific observation from any source, not when nothing has changed. Open question 3 defers the format, but the default (changes plus top five) should be stated as normative to avoid an implementer shipping full reports."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Duplicates in output",
          "description": "The conservative identity policy deliberately produces duplicate rows for unmatched records, but the output section never says the report flags suspected duplicates, so the user may read two rows as two stations with independent evidence."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Anti-flap interaction",
          "description": "The two-tick confirmation rule governs availability-run resets but does not state whether an unconfirmed flip suppresses the station from the primary recommendation list or only from the appearance-time claim."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Ranking criterion 2",
          "description": "'Number and quality of services currently supporting availability' is a two-dimensional comparison inside a strictly lexicographic ordering with no stated tiebreak between count and quality."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Concurrency",
          "description": "No lock file or state-dir keying prevents an on-demand run from colliding with an active monitoring session, or two monitoring sessions from sharing a runtime directory."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Test expectations",
          "description": "'RSS does not trend upward beyond a defined tolerance' and 'implementation must re-verify anchor coordinates' are TBDs outside the Open Questions section; test items are listed as categories rather than assertions with expected values."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Ledger phrasing",
          "description": "Two ledger rows state the option rather than the decision ('Use direct HTTP as the primary runtime transport' / 'Use official 2GIS API in V1'), making the Status column read inconsistently against positively-phrased adopted rows."
        }
      ],
      "assumptions": [
        "I treated the installed agent-browser 0.35.1 CLI on this machine as the target runtime and validated the spec's CLI assumptions against its --help output and a read-only 'session list --json' probe in an unused namespace; I made no network requests to Yandex, 2GIS or gdebenz.",
        "I assumed signalsCountPerHour and lastSignalTimestamp as described in the task are the complete activity data Yandex exposes, since no event-list field was reported in the empirical observations.",
        "I assumed 'the active agent checks for user input between wait chunks' has no first-class harness API available, since none is described in the spec or the task.",
        "I assumed the report is rendered in Russian based on the example row and verdict vocabulary, since no language configuration is specified.",
        "I did not read any prior council artifacts under spec/**, per instructions; my review is based solely on the task text and the specification quoted above."
      ],
      "round": 1,
      "reviewer": "opus1mhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 6
would_adopt: false
