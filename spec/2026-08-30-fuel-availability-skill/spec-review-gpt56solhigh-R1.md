## Facts & Constraints (White Hat)

The overall approach is feasible, but only as a degraded-tolerant, unofficial-data system:

- Yandex can plausibly provide the strongest V1 observations.
- 2GIS may contribute only station catalogue data because CAPTCHA can make current-data extraction unavailable.
- gdebenz may be unavailable for entire runs.
- Consequently, “multiple services” cannot mean that every recommendation will have multiple-source confirmation. The report must explicitly distinguish source coverage from evidence agreement.

Several essential technical contracts remain unspecified:

- `SourceResult`, `CollectorRequest`, `CollectContext`, normalized station records, snapshots, source health, assessments, and browser errors have no schemas.
- `config.schema.json` is promised but not designed. Fuel aliases, thresholds, source settings, provenance groups, identity overrides, timeouts, pagination caps, station-count baselines, and output settings remain prose.
- No CLI contracts exist for `collect.mjs`, `report.mjs`, or `resolve-area.mjs`: arguments, stdin/stdout format, exit codes, temporary-file ownership, and degraded-success behavior are undefined.
- Node version, dependency policy, required `agent-browser` version, and exact supported CLI features are absent.
- The browser interface does not express session identity, namespace, tab identity, timeouts, cancellation, navigation results, or typed failures. It therefore does not enforce the claimed one-session/one-tab lifecycle.

The area model is internally inconsistent. `station-anchors` declares `lat` and `lon`, while the supplied default uses a non-schema `point: [lon, lat]`. Polygon tuple order is not declared in the type. Buffer projection, hull algorithm, coordinate precision, and maximum acceptable area are also unspecified.

## Risks & Failure Modes (Black Hat)

The largest correctness risk is false station continuity. `stationKey` generation is unspecified, yet it drives diffs, availability runs, anti-flap behavior, and ranking stability. If one source disappears or cluster membership changes, the same station may receive a new key and be reported as a fresh appearance. Conversely, an unstable merge could transfer fuel or queue evidence between nearby stations.

Geometry is applied before reconciliation. That can discard an out-of-bound coordinate from one service before it can be matched to an in-bound representation from another. The opposite ordering can leak genuinely out-of-area stations into the result. The specification needs an explicit boundary/reconciliation rule.

The central availability decision is not implementable as written:

- The promised “full verdict/confidence table” is absent.
- “Clearly newer,” “strong signal count,” “meaningfully independent,” and direct-versus-family dominance are undefined.
- Exact and bounded observation times cannot be compared without rules.
- `LIMITED`, `UNCERTAIN`, conflicting evidence, future timestamps, clock skew, and malformed ages lack mappings.
- Activity evidence has no expiry or formal relationship to `AVAILABLE`.
- Transaction or signal resumption may reflect telemetry recovery rather than replenishment. It must not independently recommend a station unless the eligibility rule explicitly says so and labels the inference.

The default union query introduces further ambiguity. It is unclear whether a station’s rank is computed per product or across all requested AI-95 products. Support for base AI-95 from one service and a premium variant from another must not become false multi-source confirmation of one product.

The availability-run rules conflict. One paragraph reports a `NOT_AVAILABLE → AVAILABLE` transition immediately, while another requires two-tick confirmation. The state model contains no pending transition, consecutive-confirmation counter, or reset rule.

Operational guarantees are overstated:

- `SIGKILL` cannot execute `finally` or delete monitoring state.
- A daemon idle timeout may remove browser resources but not the temporary state file.
- “Return success only after cleanup verification” can suppress otherwise useful source results, conflicting with the degradation requirement. Collection outcome and cleanup outcome should be separate report dimensions.
- The exact monitoring wait primitive is unspecified. Cadence could become completion-plus-15-minutes, drift indefinitely, or issue back-to-back ticks after a long collection.
- Configuration reload during monitoring and overlapping/reentrant monitoring requests are not addressed.

Security and privacy details are also missing. Configuration-driven URLs need an HTTPS host allowlist; evaluated JavaScript must not interpolate untrusted aliases or addresses; provenance URLs need query sanitization; extracted “raw fields” need a whitelist and size limit; and ephemeral sessions should use isolated storage rather than any signed-in/default browser profile.

## Strengths & Benefits (Yellow Hat)

The specification makes several strong decisions:

- It honors the binding browser-only runtime requirement.
- Per-source failure isolation is central rather than incidental.
- CAPTCHA is detected and reported without bypass.
- Browser cleanup is treated as a correctness property and tested repeatedly.
- Fetch time is correctly separated from observation time.
- Fuel family and premium variants remain distinct internally.
- Unknown-time evidence cannot masquerade as fresh evidence.
- Coordinate proximity alone cannot merge stations.
- Conflicting fresh evidence is exposed rather than averaged away.
- Queue absence is not treated as a zero-length queue.
- Only positively supported stations enter the primary recommendation list.
- Rule-based ranking is honestly described instead of being marketed as calibrated probability.
- Monitoring keeps minimal state and distinguishes “first seen” from an observed transition.
- The test plan includes schema drift, CAPTCHA, partial pagination, stale evidence, cleanup, anti-flap behavior, and report stability.

These choices directly address the most dangerous user-facing failure: confidently recommending the wrong station.

## Alternatives & Creative Ideas (Green Hat)

The architecture can remain intact while becoming much more deterministic:

- Define a versioned adapter contract with separate `health`, `coverage`, `observations`, and `diagnostics` fields. Cleanup health should sit beside, not overwrite, collection health.
- Add an explicit capability matrix stating, per source, whether it can provide identity, current grade status, exact freshness, activity timeline, and queue data.
- Express recommendation eligibility as a truth table before confidence or ranking. For example, require at least one non-expired positive grade-specific observation, or a narrowly defined qualifying activity-resumption case.
- Rank individual `(station, product)` candidates first, then aggregate them into station rows without combining evidence across products.
- During monitoring, conservatively match current station clusters against the previous tick and carry forward the prior key only for an unambiguous match. Otherwise allocate a new key and suppress transition claims.
- Use a monotonic, start-to-start schedule: `nextDue = previousDue + 15 minutes`, with a defined rule for missed deadlines and no catch-up bursts.
- Treat cleanup as a two-layer protocol: normal `finally` cleanup plus startup/stop scavenging of expired owned namespaces and state directories.
- Replace vague completeness prose with per-source configurable numeric invariants and a baseline-learning procedure that does not require retained monitoring history.

## Completeness & Process (Blue Hat)

The document is architecturally thoughtful but not yet implementation-ready. It describes intended behavior more clearly than executable contracts.

The following de facto TBDs occur outside Open Questions:

- preliminary default coordinates must be reverified;
- timeout and process budgets;
- pagination and scroll caps;
- completeness thresholds and station-count baselines;
- strong-signal threshold;
- matching distances, score margin, and confidence tiers;
- implausibly large area threshold;
- body/extraction size limit;
- soak-test RSS tolerance;
- scheduling drift and missed-tick policy.

Testing is broad but cannot yet be written independently because expected outcomes are missing for the verdict table, identity assignment, activity eligibility, queue comparison, state transitions, and source-health mapping.

Some scope can be reduced. A “per-source circuit for the current tick” has little value when each source is visited sequentially only once or twice. A bounded retry policy is enough. Development HAR support could also be deferred until an actual extractor repair workflow needs it.

## Traceability

The Decision Ledger exists, and most adopted and rejected decisions appear in the body. However, traceability is incomplete:

- Rejection of automatic Yandex/gdebenz independence is not listed in “Rejected / Deferred Alternatives.”
- Rejection of persistent raw HAR storage is not listed there.
- The adopted capability-matrix decision is not actually realized; no matrix is present.
- The completeness-invariant decision appears only as qualitative prose without the promised thresholds.
- Several substantive body decisions are absent from the ledger: the convex-hull buffer rule, two-tick anti-flap policy, single-tab sequential navigation, retry policy, source-health taxonomy, and provisional coordinate revalidation.

## Decomposition Readiness

The directory structure suggests natural tasks, but at least five tasks would require fresh architectural decisions:

1. Configuration and CLI contracts.
2. Browser lifecycle and cancellation.
3. Station normalization, stable identity, and boundary interaction.
4. Verdict, confidence, activity eligibility, and product aggregation.
5. Monitoring state machine, scheduling, interruption, and recovery.

Those tasks cannot currently be delegated independently because their shared data and error contracts are missing.

## Weak-Model Executability

A weaker implementation model would have to guess at phrases such as:

- “clear margin over the second-best candidate”;
- “highest match-confidence tier”;
- “clearly newer”;
- “configured strong signal count”;
- “minimum fuel-block coverage”;
- “station-count baseline”;
- “process/session budget”;
- “implausibly large areas”;
- “defined tolerance”;
- “meaningfully independent.”

The source-adapter prose also lacks exact extraction priority, selectors/state-path versioning, termination limits, and retry timing. This invites mutually incompatible implementations.

## Contract Completeness

Before adoption, the specification needs:

- complete configuration and runtime-state schemas;
- complete request, station, source-result, coverage, assessment, snapshot, and report schemas;
- exact CLI signatures and exit semantics;
- one unified source-health/error taxonomy;
- an exhaustive verdict/confidence/eligibility table;
- a formal activity-resumption and anti-flap state machine;
- deterministic station-key and previous-tick reconciliation rules;
- explicit geometry algorithms and coordinate order;
- per-product ranking and station aggregation rules;
- exact queue comparison rules across ordinal and vehicle-count data;
- numeric timeouts, caps, thresholds, and test tolerances;
- pinned runtime/dependency requirements;
- an exact monitoring scheduling and crash-recovery contract;
- accepted default coordinates or a deterministic, testable validation gate.

The conservative conclusion is that the architecture should be retained, but implementation should not start until those contracts are added.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "spec-review",
      "approval_score": 5,
      "would_adopt": false,
      "summary": "The specification has a strong safety posture and sound high-level architecture, especially around browser-only collection, source isolation, freshness, conservative identity matching, cleanup, and degraded reporting. It is not implementation-ready because its core contracts are missing: configuration and CLI schemas, source-result and health models, the promised verdict table, activity eligibility, stable station identity, monitoring state transitions, exact browser lifecycle semantics, numeric limits, and deterministic geometry rules. Several ledger entries are also incompletely traced. These omissions would force implementers to make consequential architectural decisions and could produce false availability or fresh-delivery claims.",
      "phase": "spec-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "Verdict and ranking",
          "description": "The exhaustive verdict/confidence table is absent, activity evidence has no formal eligibility or expiry rule, and default union-query evidence can be incorrectly combined across products.",
          "required_change": "Add complete per-product eligibility, verdict, confidence, conflict, freshness, activity, aggregation, and lexicographic ranking tables with deterministic tie rules."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Station identity",
          "description": "Canonical stationKey generation and continuity across source outages or changing cluster membership are unspecified, making monitoring transitions and diffs unreliable.",
          "required_change": "Define deterministic within-tick clustering, canonical-key selection, previous-tick reconciliation, ambiguity handling, match thresholds, and interaction with geometry filtering."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Interfaces and configuration",
          "description": "Core schemas and executable contracts are missing, including SourceResult, normalized stations, snapshots, assessments, source health, configuration, runtime state, and script CLI behavior.",
          "required_change": "Provide complete types and JSON schemas plus command arguments, stdout/stderr formats, exit codes, degraded-success semantics, and temporary-file ownership."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Monitoring lifecycle",
          "description": "The anti-flap rule conflicts with immediate transition reporting, and cadence, missed deadlines, interruption, crash recovery, and state cleanup are not specified as a state machine.",
          "required_change": "Define pending and confirmed states, counters, reset rules, a monotonic start-to-start schedule, missed-tick policy, stop semantics, and startup scavenging."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Browser and source adapters",
          "description": "The browser interface does not enforce namespaces, one-tab reuse, timeouts, cancellation, or typed navigation failures; extraction priorities, retries, caps, and capability coverage remain qualitative.",
          "required_change": "Pin the agent-browser contract/version and specify invocation, isolation, timeout, retry, extraction, pagination, coverage, cleanup, and error-mapping behavior per source."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Area configuration",
          "description": "The supplied default anchors do not conform to AreaConfig, coordinate order is ambiguous, buffering is undefined, and the default coordinates remain provisional.",
          "required_change": "Unify the schema, declare lon/lat order, select a geodesic or projected hull-buffer algorithm, define limits and boundary behavior, and provide accepted coordinates or a deterministic validation gate."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Contract thresholds",
          "description": "Numerous implementation-critical limits are described only as configured or defined later, outside the Open Questions section.",
          "required_change": "Supply defaults and validation ranges for timeouts, extraction sizes, pagination caps, coverage baselines, signal counts, identity thresholds, area limits, and soak-test tolerances."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "Traceability",
          "description": "Rejected automatic source independence and persistent HAR retention are missing from the rejected/deferred section, while several substantive body decisions are absent from the ledger.",
          "required_change": "Reconcile the ledger bidirectionally with the body and rejected/deferred alternatives."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Scope",
          "description": "A per-source circuit breaker scoped to one sequential tick and development HAR machinery appear more elaborate than V1 requires.",
          "required_change": "Prefer bounded retries and defer repair tooling until needed."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Security",
          "description": "URL allowlisting, isolated browser storage, safe eval parameterization, provenance sanitization, and raw-field limits are not explicit.",
          "required_change": "Add concrete browser-input and extracted-data security constraints."
        }
      ],
      "assumptions": [
        "The review is based only on the task and specification supplied in the prompt; no prior council artifacts were inspected.",
        "The required agent-browser CLI exists, but no unmentioned namespace, tab, or idle-timeout behavior was assumed.",
        "V1 uses no authenticated source accounts and must remain useful when Yandex is the only source returning current availability.",
        "No implementation, repository modification, dependency change, git operation, or external-service action was authorized."
      ],
      "round": 1,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 5
would_adopt: false
