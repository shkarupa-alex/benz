## Facts & Constraints (White Hat)

The revised design is substantially more concrete. I verified locally that installed `agent-browser` 0.35.1 exposes the key claimed features: namespaces, sessions, idle timeout, pinned tabs, JSON output, `eval --stdin`, session listing, and scoped commands. The pinned version range is therefore plausible.

The release-gated feasibility pass is the correct response to uncertain source capabilities. It prevents the implementation from pretending that static catalogue data is current availability.

Several contracts are still incomplete:

- `ReconciledStation`, `StationAssessment`, `MonitorState`, browser/process results, execution envelopes, ranking tuples, and prepared-state schemas are referenced but undefined.
- The configuration example leaves `sources`, `area`, and `requestedProducts` as empty objects. This omits the requested fuel-alias schema and the exact per-source configuration.
- JSON Schema and geometry dependencies are said to be pinned, but the packages and algorithms are not selected.
- Default adapter execution order is unspecified despite the whole-tick deadline. The strongest source should run first.
- The feasibility pass necessarily discovers page contracts during implementation, but its permissible outputs and manifest-update procedure should be explicit so it cannot silently change architecture.

## Risks & Failure Modes (Black Hat)

The most serious remaining correctness problem is station continuity. Matching thresholds are now specified, but:

- the normalized match-score formula is absent;
- address, street, house-number, and brand normalization are undefined;
- the string-similarity algorithm is unnamed;
- canonical `stationKey` construction is missing;
- current clusters are not reconciled against the previous tick.

A station can therefore acquire a different key when one source fails, fabricating “first seen” or transition events. This also destabilizes diffs and availability-run state.

Area filtering still occurs before reconciliation. A shifted coordinate can be discarded before matching an in-area representation. Reconciliation-first has the opposite risk of importing an out-of-area neighbour. The specification needs a deterministic rule, such as filtering source records provisionally, reconciling boundary-near candidates within the identity cap, and qualifying a cluster only through a selected authoritative coordinate or pinned anchor.

The default anchor data still does not conform to `AreaConfig`: the type accepts `lat`/`lon`, while the JSON uses `point`. The hull-buffer algorithm is also unspecified—planar versus geodesic buffer, projection, polygon closure, and numerical tolerance can produce different boundaries.

Monitoring orphan detection is not viable as written. The active monitor is an agent task, not one persistent OS process. Each Node command exits between ticks, so “recorded process is no longer alive” may be true while monitoring is healthy. After 30 minutes, another invocation could delete live monitoring state. A task-owned lease or explicit monitor identifier is required.

Temporal handling lacks defensive rules:

- future source timestamps could become falsely fresh;
- clock skew tolerance is absent;
- invalid ISO timestamps and negative bounded ages are unspecified;
- timezone parsing for localized Russian timestamps is unspecified;
- `UNCERTAIN` fresh evidence has no verdict row.

Union-query behavior is better but not exhaustive. A family-unspecified positive combined with exact negatives for some—but not all—variants needs a deterministic union result. `FuelObservation.product` also remains awkward for family-scoped claims: a `FAMILY_ALL_PRODUCTS` claim should identify a family subject, not masquerade as one specific product.

Activity evidence still lacks a direct normalized observation/window field. Rolling counts may expose only a count and latest timestamp, while `ActivityEvidence.eventTimes` implies actual event timestamps. The adapter-to-activity contract needs to represent both timelines and rolling summaries explicitly.

Queue handling loses useful precision. Exact vehicle counts are converted to ordinal bands and ranking uses only the ordinal, so queues of one and three vehicles tie despite the original requirement to prefer the smallest queue when data exists. Unknown queue ordering is also undefined.

Coverage baselines are not tied to `areaHash`. Changing the user-configured area can make the default station-count baseline invalid. Also, completeness only works if collection enumerates all stations independently of current availability; a search returning only stations with available fuel would make a legitimate shortage look like broken extraction.

Operationally, exit code 75 is ambiguous. The specification says a valid snapshot may exist and must report cleanup failure, but a generic caller may treat the nonzero exit as fatal and never invoke `report.mjs`. `SKILL.md` needs an explicit exit-code handling table.

Finally, indefinite active-task monitoring cannot be guaranteed across application shutdown, task eviction, or agent interruption. The design should state that monitoring is best-effort for the lifetime of the active task and define the next-entry recovery message.

## Strengths & Benefits (Yellow Hat)

The previous review’s largest gaps were addressed well:

- Runtime and browser versions are pinned.
- Browser access is isolated, unauthenticated, and fail-closed.
- Source feasibility is a first-class release gate.
- Numeric command, adapter, tick, pagination, payload, and cleanup budgets now exist.
- Source health and capability records are explicit.
- Claim scopes prevent several base-versus-premium inference errors.
- Verdict, confidence, conflict, freshness, activity, queue, and availability-run rules are substantially more auditable.
- Monitoring uses atomic prepare/commit semantics.
- Hard-kill residue and cleanup failures are acknowledged instead of denied.
- Security addresses shell injection, prompt injection, unsafe paths, control characters, and persistent browser state.
- Testing now covers browser contracts, cancellation, monitoring cadence, cleanup, schema drift, and golden reports.
- Traceability of the earlier rejected choices is much improved.

The design is no longer vague at the architectural level. Its remaining issues are concentrated in a handful of shared contracts.

## Alternatives & Creative Ideas (Green Hat)

A few focused changes would simplify implementation:

- Define a canonical station cluster key as an active-monitor identifier carried forward only by an unambiguous previous-tick match. On-demand keys can use a deterministic sorted source-ID composite.
- Separate `ClaimSubject` from `FuelProduct`: the subject can be an exact product, an unspecified family member, or the whole family.
- Represent activity input as either `EVENT_TIMELINE` or `ROLLING_SUMMARY`, then derive the existing activity verdicts centrally.
- Make coverage configuration keyed by `areaHash`; when no matching baseline exists, retain structural coverage checks and mark station-count coverage `UNVALIDATED`.
- Preserve exact queue count as the ranking key when both candidates have counts; fall back to ordinal only for mixed or ordinal-only data.
- Use a monitor lease refreshed during each bounded wait chunk. Lease metadata is operational state, not monitoring history.
- Pass the union of validated source/resource domains through `agent-browser --allowed-domains`, rather than merely validating top-level navigation URLs.
- Define source order in configuration with a conservative default of Yandex, gdebenz, then 2GIS.

## Completeness & Process (Blue Hat)

The implementation sequence is sensible, but steps 1 and 3 still require architectural work rather than execution:

1. Selecting schema and geometry libraries.
2. Defining missing core types and the full configuration schema.
3. Designing station-key continuity and the match-score formula.
4. Defining task ownership for monitoring state.
5. Completing temporal, union, activity, and queue edge-case tables.

The feasibility milestone is correctly isolated and does not count as an architectural gap by itself; volatile source selectors cannot reasonably be frozen before that pass.

## Traceability

The Decision Ledger exists, and every ledger entry marked rejected or deferred appears in the rejected/deferred section. Adopted entries are represented in the body.

The ledger is not yet lossless. Substantive body decisions absent from it include:

- Node.js 20;
- Russian report language;
- queue vehicle bands;
- identity thresholds and mutual-best matching;
- start-to-start cadence and no catch-up;
- two-tick availability reset;
- exit-code semantics;
- the 500 km² area limit;
- the exact freshness/activity defaults;
- source baseline thresholds.

These can be grouped into a few ledger rows rather than recorded individually.

## Decomposition Readiness

The source adapters, pure libraries, browser runner, reporter, and tests are separable. However, implementation tasks cannot proceed independently until shared contracts are completed for:

- configuration and normalized schemas;
- station identity and stable keys;
- geometry/reconciliation ordering;
- monitoring ownership and state;
- evidence aggregation and queue ranking.

Without those, different implementers can produce incompatible snapshots and state transitions.

## Weak-Model Executability

A weaker model would still need to guess:

- the station matching score and string normalization;
- stable station-key generation;
- the geometry library and buffer semantics;
- full fuel-alias and source configuration shapes;
- how family-scoped observations populate `FuelProduct`;
- the verdict for fresh `UNCERTAIN`;
- future-timestamp and clock-skew handling;
- rolling-count activity representation;
- exact-count versus ordinal queue ordering;
- how exit code 75 should be consumed;
- what process identifies a live active-agent monitor.

These are consequential, not cosmetic choices.

## Contract Completeness

Before adoption, the specification should add:

- the missing normalized, reconciled, assessment, monitor-state, process, browser, execution-envelope, and ranking schemas;
- full `sources`, `area`, fuel aliases, and `requestedProducts` configuration schemas;
- an exact matching-score and canonical-key contract;
- an explicit geometry implementation and boundary-reconciliation rule;
- future-time, timezone, malformed-time, and `UNCERTAIN` handling;
- complete union aggregation and family-subject semantics;
- distinct activity timeline and rolling-summary inputs;
- exact queue-count ranking and unknown-queue ordering;
- area-hash-bound coverage baselines;
- live-monitor ownership/lease semantics;
- caller behavior for every exit code;
- selected dependency packages and versions.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "spec-review",
      "approval_score": 6,
      "would_adopt": false,
      "summary": "The revision resolves most high-level architecture, safety, browser lifecycle, release-gating, evidence, and testing concerns, and its stated agent-browser 0.35.1 feature assumptions are locally plausible. It is still not ready for implementation as-is because stable station identity, full configuration and snapshot schemas, monitoring-state ownership, geometry semantics, temporal edge cases, union aggregation, activity representation, and exact queue ranking remain underdefined. These gaps can fabricate availability transitions or produce incompatible module implementations, but they are concentrated enough that one further contract-hardening revision should make the design adoptable.",
      "phase": "spec-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "Station identity and continuity",
          "description": "The normalized match-score formula, string normalization, canonical stationKey generation, and previous-tick cluster reconciliation are missing.",
          "required_change": "Define exact normalization and scoring algorithms, deterministic canonical keys, and conservative previous-tick key carry-forward with ambiguity suppression."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Interfaces and configuration",
          "description": "ReconciledStation, StationAssessment, MonitorState, browser/process results, execution envelopes, ranking tuples, and the full source, area, fuel-alias, and requested-product schemas are absent.",
          "required_change": "Add complete TypeScript interfaces and JSON Schema shapes, including validation ranges and cross-field invariants."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Monitoring lifecycle",
          "description": "Orphan detection relies on a persistent process even though active-agent monitoring has no persistent Node process, and active-task loss behavior is unspecified.",
          "required_change": "Define task-owned monitor identity or lease semantics, concurrent-monitor exclusion, stale-state recovery, and best-effort termination behavior when the active task disappears."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Geometry and default area",
          "description": "Default anchors use a point field not accepted by AreaConfig, buffer/projection semantics are undefined, and filtering-before-reconciliation can lose valid boundary evidence.",
          "required_change": "Unify the anchor schema, select and pin the geometry algorithm/library, define numerical tolerances, and specify boundary-near reconciliation and qualification order."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Evidence contracts",
          "description": "Fresh UNCERTAIN evidence, future timestamps, timezone parsing, family-scoped claim subjects, mixed union evidence, and rolling-count activity inputs lack deterministic handling.",
          "required_change": "Complete the temporal validation and verdict tables, separate family from product claim subjects, and add explicit timeline and rolling-summary activity schemas."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Coverage and source enumeration",
          "description": "Station-count baselines are not bound to areaHash, and the spec does not require enumeration independent of current availability.",
          "required_change": "Key baselines by source contract and areaHash, define unvalidated-area behavior, and require station discovery that can distinguish a valid all-negative result from incomplete extraction."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Queue ranking",
          "description": "Exact vehicle counts are reduced to ordinal bands, so different known queue sizes can tie, and unknown queue ordering is undefined.",
          "required_change": "Preserve and rank exact comparable counts before ordinal fallback, and place unknown or presence-only queues deterministically without treating them as short."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "Browser containment",
          "description": "Source URLs are validated, but the design does not explicitly pass validated resource-domain unions through agent-browser network containment.",
          "required_change": "Use --allowed-domains where feasible and contract-test required page resources."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Exit handling",
          "description": "Exit code 75 may accompany a valid reportable snapshot, but SKILL.md caller behavior is not specified.",
          "required_change": "Define which nonzero exits still require rendering an existing validated snapshot."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Traceability",
          "description": "The ledger covers the major refinement decisions but omits several substantive thresholds and operational choices present in the body.",
          "required_change": "Add grouped ledger rows for runtime baseline, identity, timing, queue, area, and exit-code decisions."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Dependencies",
          "description": "Schema and geometry dependencies are promised but not selected.",
          "required_change": "Name the packages and supported versions or specify a dependency-free algorithm."
        }
      ],
      "assumptions": [
        "The review used only the task and specification supplied in the prompt and did not inspect prior council artifacts under spec/**.",
        "Local agent-browser help and version output were treated as authoritative for the installed 0.35.1 CLI contract; no website was opened.",
        "Source selectors and internal page-state paths are legitimately deferred to the release-gated feasibility pass.",
        "Monitoring is expected to operate only while the active Codex task remains alive; no external scheduler or daemon may be introduced.",
        "No repository files, dependencies, git state, or external services were modified."
      ],
      "round": 2,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 6
would_adopt: false
