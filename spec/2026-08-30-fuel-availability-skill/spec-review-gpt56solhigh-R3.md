## Facts & Constraints (White Hat)

The architecture is technically plausible and now covers most required domains with concrete contracts: pinned dependencies, browser isolation, source capability gating, typed evidence, timing, confidence, monitoring state, cleanup, security, and tests.

The feasibility gate is appropriately conservative. Given the observed CAPTCHA and 502 behavior, V1 may legitimately ship with only one evidence-producing adapter and degraded health records for the others. The definition of done correctly prevents a catalogue-only implementation from being called operational.

Some declared contracts remain incomplete:

- `NormalizedQueue`, `RuntimeConfig`, `MonitoringConfig`, `FreshnessConfig`, `ActivityConfig`, `QueueConfig`, `IdentityConfig`, `RankingConfig`, and `RequestedProductsConfig` are referenced but undefined.
- The required fuel-alias and brand-alias configuration structures are absent.
- Source execution order is unspecified even though the 300-second tick budget may prevent later adapters from running.
- The configured area-specific baseline lacks an `areaHash`, despite snapshots carrying one.
- The default anchor JSON still uses `point`, while `AreaConfig` permits only `lat` and `lon`.

These are implementation-contract defects rather than source-feasibility unknowns.

## Risks & Failure Modes (Black Hat)

### Monitoring ownership and recovery

The monitoring lifecycle remains internally inconsistent.

`MonitorState` has no owner PID or lease, yet orphan cleanup requires that “its recorded owner process is not alive.” More fundamentally, active-agent monitoring has no persistent Node process between ticks. Recording the PID of `monitor-state.mjs` or `collect.mjs` would make healthy monitoring appear orphaned as soon as that command exits.

Recovery also requires `--state <state-path>`, but the specification does not define how a resumed agent finds that path after a crash. A random OS temporary directory and `monitoringId` are insufficient without a task-bound deterministic locator or registry.

Publication ordering contains another contradiction:

1. `prepare` runs before report rendering.
2. Prepared state is required to contain `reportId`.
3. `report.mjs` is responsible for producing `reportId`.
4. The `prepare` command accepts no `reportId`.

The compare-and-swap recovery protocol cannot be implemented consistently until one component owns report-ID generation and the command order reflects that ownership.

### Area and geometry

The default configuration is invalid against its own schema because anchors use `point`. This would fail the promised schema validation before source feasibility begins.

Turf is pinned, but the exact operations remain implicit. The specification should name the Turf functions, buffer units, polygon-closing convention, and behavior when `convex()` returns null.

Geometry is still applied before station reconciliation. A source coordinate shifted just outside the boundary can be discarded before matching an in-bound representation. The rule for selecting a reconciled station’s representative coordinates is also missing.

### Station identity

The match score is now executable, but canonical station construction is not complete:

- No rule selects canonical title, address, brand, latitude, or longitude from merged records.
- Hash-key generation requires a normalized address even though `SourceStation.address` is optional.
- Hash collision handling is unspecified.
- A coordinate shift greater than 30 metres permits only a `MEDIUM` match, which cannot carry the previous key. This conservatively avoids false merges but may repeatedly fabricate new station identities.
- Matching and area filtering do not define how pinned anchors interact with multiple source representations.

These failures primarily cause false “first seen,” lost transitions, duplicate rows, or unstable diffs.

### Product and activity aggregation

Exact product assessments are defined, but the synthetic union algorithm is still incomplete. The general conflict rule could mistakenly treat base AI-95 `OUT_OF_STOCK` and premium AI-95 `IN_STOCK` as opposing evidence even though the union is available. The specification needs an explicit union truth table computed from member assessments and family-scoped observations.

`ActivityEvidence` still models only `eventTimes`, while rolling-count inference depends on count value, window definition, latest timestamp, and schema semantics. `signalsPerHour` exists on `FuelObservation`, but there is no explicit association between that observation and the derived activity record. A weaker implementation could compare unrelated status and activity observations.

### Queue ranking

The original request asks for the smallest queue where data exists. Exact vehicle counts are converted to ordinals, and `RankingTuple` contains only `queueRank`. Therefore one and three known vehicles tie as `SHORT`. Queue is secondary, but when it is reached as a tie-breaker, the implementation should preserve exact comparable counts.

### Coverage validity

Completeness baselines are area-specific in prose but not in schema. Editing the rectangle or polygon can silently apply the previous area’s expected station count.

The design also does not explicitly require source discovery to enumerate all petrol stations independently of availability. If a query returns only currently available stations, a valid shortage can resemble incomplete extraction, and baseline counts fluctuate with fuel status.

### Cleanup and exit handling

Exit code 75 may accompany a valid snapshot containing useful observations and a cleanup warning. `SKILL.md` does not explicitly instruct the agent to validate and render that snapshot despite the nonzero exit. A generic nonzero-exit path could suppress the useful result.

The 300-second tick deadline also needs to reserve cleanup time. An outer hard deadline that kills `collect.mjs` at exactly 300 seconds may prevent its `finally` from running.

## Strengths & Benefits (Yellow Hat)

The design has several strong qualities:

- Browser access is genuinely isolated and scoped.
- The compatibility check no longer creates an extra session.
- The cleanup invariant matches the browser lifecycle instead of requiring instantaneous helper-process disappearance.
- Source capability claims require fixtures and semantic validation.
- Direct, family, and union evidence are more clearly separated.
- Future timestamps and unknown time cannot create false freshness.
- Confidence rules are deterministic and auditable.
- Same-source and correlated-source evidence cannot manufacture independence.
- Unknown monitoring gaps no longer claim continuous availability.
- Source failures, CAPTCHA, cleanup failures, stale baselines, and clock errors are visible.
- Publication precedes committed monitoring state.
- Security covers browser persistence, injection, URL validation, bounded extraction, logs, paths, and prompt injection.
- Test coverage is broad and includes lifecycle, recovery, drift, cancellation, and degraded output.
- The implementation sequence correctly places feasibility before adapter construction.

This is close to a sound implementation plan; the remaining weaknesses are mostly shared-state and aggregation contracts.

## Alternatives & Creative Ideas (Green Hat)

A simpler monitoring transaction would resolve several issues:

1. Derive `reportId` deterministically from the validated snapshot plus previous generation.
2. Render the report.
3. Call `prepare --report-id <id>`.
4. Publish.
5. Commit the exact prepared generation.

Alternatively, make `collect.mjs` assign the immutable report ID and include it in `CollectionSnapshot`.

For ownership, use a deterministic task-scoped runtime directory and a lease timestamp refreshed by every bounded wait return. Do not use a child-process PID as proof that the active agent task is alive.

For station keys, define fallbacks:

- manual or anchor key;
- carried previous key;
- hash of normalized address and representative coordinate;
- if address is absent, hash the sorted source-ID set;
- on hash collision, append a deterministic sorted source-ID digest.

For union assessments, compute exact-member assessments first and then apply a separate union table. Exact negatives for some members must never conflict with an exact positive for another member.

For queues, add `queueVehicleCountRank`, used only when both candidates have comparable fresh counts; otherwise fall back to the ordinal rank.

## Completeness & Process (Blue Hat)

The document is much closer to implementation readiness, but the remaining contradictions affect foundational shared types. They should be fixed before decomposition into adapter and monitoring tasks.

The source feasibility uncertainties are correctly isolated and do not count as prohibited TBDs. However, these unresolved items are outside Open Questions and do block implementation:

- monitor ownership and state discovery;
- report-ID generation order;
- invalid default anchor representation;
- missing configuration types and aliases;
- representative station construction and missing-address key fallback;
- union assessment table;
- rolling activity input schema;
- area-bound baseline identity;
- exact queue ranking.

## Traceability

The Decision Ledger exists, and its rejected and deferred entries appear in the corresponding alternatives section.

Most adopted entries appear in the body. One important traceability failure remains: “Define all referenced snapshot, assessment, station, state, and execution schemas” is marked adopted, but several referenced types remain undefined, especially `NormalizedQueue` and the configuration subtypes.

The ledger also claims atomic prepare/commit and publication-before-commit, but the body’s report-ID ordering prevents that decision from being implemented as specified.

Several substantive body decisions remain unharvested, including exact queue bands, match-score weights, the 90-day baseline expiry, and orphan ownership policy. These could be grouped rather than recorded individually.

## Decomposition Readiness

Most modules can now become independent tasks after a small contract-hardening pass. The following areas still require architectural decisions:

- monitoring state location, ownership, recovery, and report-ID transaction;
- union aggregation;
- canonical reconciled-station construction;
- area-aware baseline management;
- full configuration and alias schema;
- exact queue ranking.

Source adapters can otherwise be implemented independently behind their capability manifests.

## Weak-Model Executability

A weaker model would still have to guess:

- what PID or lease represents a live monitor;
- how recovery locates the state directory;
- who creates `reportId`;
- how `prepare` obtains that ID;
- how merged station fields are selected;
- how a station key is built without an address;
- whether different union members conflict;
- how rolling counts become `ActivityEvidence`;
- how baselines invalidate after area changes;
- whether exact vehicle counts affect ranking;
- how exit code 75 is handled by `SKILL.md`.

Those guesses can change user-visible availability reports.

## Contract Completeness

Before adoption, add:

- all missing configuration and queue interfaces;
- complete fuel-alias, brand-alias, street-dictionary, and requested-product schemas;
- a schema-valid default anchor representation;
- exact Turf operations and representative-coordinate rules;
- deterministic state-directory discovery and active-task lease semantics;
- a consistent report-ID/prepare/publish/commit protocol;
- canonical station-field and key fallback rules;
- a union assessment truth table;
- explicit timeline and rolling-count activity input types;
- `areaHash` in completeness baselines;
- exact-count queue ranking;
- explicit `SKILL.md` handling for valid output accompanied by exit 75;
- a cleanup reserve outside the ordinary tick deadline.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "spec-review",
      "approval_score": 6,
      "would_adopt": false,
      "summary": "The specification now has a strong architecture, conservative source-feasibility gate, credible agent-browser lifecycle, auditable evidence rules, robust security posture, and extensive testing. It is still not implementation-ready as-is because the monitoring ownership and publication transaction are internally inconsistent, the default area fails its own schema, several promised interfaces remain undefined, and station construction, union aggregation, rolling activity, area-specific baselines, and exact queue ranking still require architectural choices. These are concentrated contract defects rather than a need to redesign the overall approach.",
      "phase": "spec-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "Monitoring ownership and recovery",
          "description": "Orphan cleanup requires a recorded live process that is absent from MonitorState and incompatible with an active agent that has no persistent Node process. Recovery also lacks a deterministic way to locate the temporary state directory.",
          "required_change": "Define a task-scoped deterministic state locator and lease-based ownership model, including concurrency exclusion, refresh, expiry, and recovery behavior."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Publication transaction",
          "description": "Prepared state must contain reportId, but prepare runs before report.mjs creates that ID and the prepare command accepts no report ID.",
          "required_change": "Assign report-ID ownership to one component and reorder or change the command interfaces so prepare, publish, recovery, and compare-and-swap commit use the same immutable ID."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Configuration and schemas",
          "description": "Several referenced configuration types and NormalizedQueue are undefined, and the required fuel-alias and brand-alias schemas are missing.",
          "required_change": "Define every referenced interface and the complete JSON Schema, including aliases, requested products, source order, dictionaries, queue normalization, and cross-field validation."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Area and geometry",
          "description": "Default anchors use point even though AreaConfig accepts lat/lon, and the representative-coordinate and boundary-near reconciliation rules are absent.",
          "required_change": "Make the default data schema-valid and specify exact Turf operations, coordinate selection, numerical handling, and geometry/reconciliation ordering."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Station identity",
          "description": "Stable-key rules do not cover missing addresses or collisions, and merged station title, address, brand, and coordinates have no deterministic selection policy.",
          "required_change": "Define canonical field precedence, addressless key fallback, collision handling, and continuity behavior for medium-confidence coordinate drift."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Evidence aggregation",
          "description": "Union assessment can misclassify different exact products as conflicting, while rolling activity depends on fields not represented in ActivityEvidence.",
          "required_change": "Add a product-to-union truth table and explicit event-timeline and rolling-summary activity schemas with observation linkage."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Coverage baselines",
          "description": "Area-specific baselines lack areaHash and the collection contract does not require station enumeration independent of availability.",
          "required_change": "Bind baselines to area and source-contract hashes, define behavior for unmatched areas, and require discovery capable of distinguishing all-negative status from incomplete extraction."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "Queue ranking",
          "description": "Exact known vehicle counts collapse to ordinal ties.",
          "required_change": "Rank comparable exact counts before falling back to ordinal bands."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Exit and cleanup handling",
          "description": "A valid snapshot may accompany exit 75, but caller behavior and cleanup time outside the tick deadline are not explicit.",
          "required_change": "Specify rendering behavior for cleanup-failure output and reserve bounded cleanup time beyond adapter collection."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Source scheduling",
          "description": "Sequential adapter order is unspecified under a shared tick deadline.",
          "required_change": "Add a configured order with the strongest expected evidence source first."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Traceability",
          "description": "The ledger claims complete schemas although referenced types remain missing, and several substantive operational decisions are not harvested.",
          "required_change": "Reconcile the ledger with the completed contracts and add grouped entries for identity, queue, baseline, and ownership decisions."
        }
      ],
      "assumptions": [
        "The review used only the task and specification supplied in the prompt; no prior council artifacts under spec/** were inspected.",
        "At least one source may pass the release gate, but no unverified source capability was assumed.",
        "The active agent runtime may provide the required interruptible wait primitive, but it does not provide a persistent Node process identity between ticks.",
        "A possible duplicate task message is acceptable only when it has the same deterministic reportId and an explicit recovery label.",
        "No repository files, dependencies, git state, or external services were modified."
      ],
      "round": 3,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 6
would_adopt: false
