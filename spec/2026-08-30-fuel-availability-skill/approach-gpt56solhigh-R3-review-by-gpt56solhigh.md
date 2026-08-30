## Facts & Constraints

Proposal 1 has resolved the most consequential prior defect: retrieval time is no longer treated as observation time. Unknown-time evidence has zero current weight and cannot independently qualify a station. It also now has a coherent multi-product assessment, external runtime state, fail-closed area configuration, bounded monitoring waits, comparable-only queue ranking, and an explicit unsupported-host result.

Its architecture is technically feasible with Node 20 built-ins. Yandex and gdebenz can independently produce useful results, so an unavailable 2GIS catalogue does not defeat the multiple-source requirement. Treating 2GIS as catalogue-only is reasonable given the supplied evidence.

Proposal 2 improves its 2GIS posture by choosing the documented API instead of CAPTCHA-prone scraping. However, a key-gated adapter deferred to V2 does not satisfy the requested source in V1, and making its role configurable cannot replace verifying its schema and semantics.

## Risks & Failure Modes

### Proposal 1

The remaining central gap is evidence reduction. The design says to retain the “strongest valid contribution” in each correlation group but does not define:

- Whether strength means signed value, absolute magnitude, freshness, or effective weight.
- What happens when one group contains both positive and negative observations.
- Whether confidence contradiction uses all raw observations or only selected group representatives.
- How `independentGroupWeight` is calculated.
- Whether a neutral `UNKNOWN` observation can increase confidence coverage despite contributing zero log-odds.

This is not merely editorial. Selecting the largest absolute contribution could erase a newer contradiction, while including `UNKNOWN` weight could manufacture confidence from non-information.

Coverage semantics also remain too optimistic. Completing advertised Yandex pages only establishes completion of the source’s advertised listing, not that the search backend returned every station in the geographic area. Gdebenz has no described total-count or pagination contract, so its bbox response cannot be declared complete merely because it returned successfully. The example “complete for both availability sources” is unsupported. Coverage should be multidimensional: request completion, pagination completion, truncation, and geographic completeness—usually unknown.

The pagination deadline arithmetic is closer but still incomplete. Its worst-case validator must include retry backoff, jitter, per-host rate limiting, parsing, and cancellation overhead. The current 60-second calculation leaves only five seconds inside the adapter deadline and assumes concurrency and rate limiting do not interact.

Smaller remaining risks:

- `LIMITED`, `UNCERTAIN`, and `IN_STOCK` are not explicitly classified for the “positive observation” eligibility test.
- Buffering an anchor hull is configured but not given an exact geometric definition.
- Name-only anchor discovery depends heavily on Yandex if 2GIS is challenged and gdebenz lacks an initial bounding hint.
- Configurable URL templates should be restricted to expected HTTPS hosts to avoid accidental or malicious local-network requests.
- Gdebenz freshness-band meanings are treated as facts but are not identified as documented, reverse-engineered, or assumed.

### Proposal 2

Several direct requirement violations remain unchanged.

Monitoring still ends after 12 hours, 48 runs, or four failed cycles. The task requires it to continue until the user asks to stop. A source outage is a reason to publish a degraded summary, not to terminate monitoring.

The 240-second wait remains incompatible with responsive current-task operation. It should yield at most every 60 seconds.

The city-wide default area still violates the user-configured-area requirement. Calling it a “defensible superset” does not make stations inside it acceptable to the user.

The Yandex pagination bug remains explicit: the observed sequence is `25, 24, 13`, while the adapter stops on a short page. It will stop after page 2 and omit page 3.

The discrete verdict model fixes rule precedence but still mishandles bounded time. A freshness band represents an interval, not an exact age. A bounded negative observation should be “clearly newer” only if its entire possible interval is more than the conflict window newer than the positive observation. Imputing one age can turn uncertainty into a definitive `НЕТ`.

Station-level aggregation for the default multi-product query remains undefined. The model assesses `(station, grade)` and the comparator expects a single verdict, but the default request contains plain and premium AI-95. The design does not say which product controls the station’s rank or how that selected product is displayed.

The queue comparator still assigns unknown queue a synthetic value of `1.5`. Unknown therefore beats known medium and long queues and loses to known none and short queues. That is not neutral. Queue comparison should occur only when both stations have fresh comparable queue values.

Fuel semantics remain unsafe:

- Generic gdebenz AI-95 is cloned into inferred premium-AI-95 evidence even though the source cannot distinguish premium fuel.
- Unmasked `fmask` grades become `OUT_OF_STOCK` despite the representation being undocumented.
- Cross-checking `fmask` against `fuels_now` can verify bit decoding, but it does not prove that absent bits have closed-world out-of-stock semantics.
- Band 3 is still imputed as 45 minutes despite being described elsewhere as “less than one hour”; 60 minutes is the conservative maximum.

The 2GIS design has a capability-escalation flaw. Configuration may change `role` from registry to availability even though the availability schema and normalization are unverified. A config field must be allowed to disable a capability, but not invent one. Promoting 2GIS to availability requires validated fields, fixtures, normalization rules, freshness semantics, and an adapter-code change.

Other significant gaps:

- The official 2GIS adapter and named-anchor resolver are deferred to V2 while V1 is called complete.
- API credentials are stored directly in `config.local.json`; an environment-variable reference or protected credential store is safer.
- Mutable state and automatic raw response dumps remain under the installed skill directory.
- The unrestricted recursive Yandex walk and “last matching script wins” rule can accept unrelated embedded business objects.
- Globally distance-sorted greedy matching is still not mutual-best matching.
- Adapters that must never reject can hide programming defects.
- Output such as “95 кончился” can misstate a loss of evidence as a confirmed stock-out.
- Jitter of ±90 seconds conflicts with a literal every-15-minutes publication schedule.
- The proposal lacks an explicit durable-goal/current-task continuation contract.

## Strengths & Benefits

Proposal 1 is now strong enough to serve as the implementation baseline. Particularly good elements include:

- unknown-time evidence is current-ineligible;
- concrete product scoring and selected-product output;
- conservative `fuels_now` semantics;
- uninterpreted `fmask`;
- separate availability, confidence, freshness, queue, and coverage;
- exact, bounded, and unknown observation-time types;
- fail-closed area resolution;
- non-overlapping monotonic monitoring;
- explicit host-capability check;
- no automatic monitoring termination during outages;
- external versioned cache state;
- disabled raw-response retention;
- extensive parser, integration, and lifecycle tests.

Proposal 2’s categorical decision table remains valuable as a presentation layer. Directness, approximate age, conflict-window handling, source-specific explanations, GET/HEAD and host allowlists, heterogeneous identifier treatment, and explicit 2GIS credential health are useful ideas worth carrying into the final synthesis.

## Alternatives & Creative Ideas

Proposal 1 can be completed without architectural change by adding a normative correlation-group reduction contract:

1. Remove expired, unknown-time, and zero-information observations from scoring.
2. Deduplicate identical source/station/product observations.
3. Within each correlation group, select the newest decisive observation per polarity.
4. Preserve both polarities for contradiction calculation.
5. Use at most one effective weight per group for coverage.
6. Exclude `UNKNOWN` entirely from availability and confidence arithmetic.
7. Preserve every discarded observation in provenance.

Coverage should be represented as separate dimensions rather than one overloaded enum:

```text
transport: SUCCESS | PARTIAL | FAILED
pagination: COMPLETE | TRUNCATED | UNKNOWN
geographicCompleteness: UNKNOWN
availabilitySources: [...]
```

A truthful report would say “all advertised Yandex pages collected; gdebenz bbox request completed; geographic completeness cannot be guaranteed.”

For anchor geometry, define the buffered hull as:

```text
inside convex hull OR minimum distance to any hull segment <= bufferMeters
```

This is deterministic and dependency-free.

Proposal 2’s discrete verdict table could be reused as a renderer over Proposal 1’s numerical ranking heuristic. The numeric estimate satisfies probability ordering; the categorical explanation prevents the number from appearing more calibrated than it is.

For 2GIS, implement the key-gated official adapter in V1 even when no key is present. Its default execution result can be `MISSING_CREDENTIAL`, but its registry schema and capability must be fixed in code. Availability promotion should require a later adapter version, not a config toggle.

## Completeness & Process

Proposal 1 is nearly implementation-ready. It needs one final normative pass over correlation reduction, confidence coverage, coverage terminology, and pagination budgeting. These are bounded amendments rather than a redesign.

Proposal 2 has improved its research and legal posture, but it has not converged on the original requirements. The repeated retention of automatic stopping, the broad default area, four-minute waits, short-page termination, deferred required features, and invented unknown-queue ordering makes the design unsuitable for implementation.

Required invariant tests for the accepted design should include:

- `UNKNOWN` observations never increase availability or confidence.
- Both polarities inside one correlation group remain visible to conflict assessment.
- Completing source pagination never implies guaranteed geographic completeness.
- Retry backoff and rate-limit delay are included in deadline validation.
- `LIMITED` is explicitly classified for eligibility.
- A short intermediate page does not terminate pagination.
- Unknown queue never receives an ordinal comparison value.
- A bounded observation becomes decisively newer only when interval ordering proves it.
- The default union query selects and displays one concrete qualifying product.
- Configuration cannot promote an adapter beyond capabilities validated in code.
- Monitoring survives unlimited consecutive source failures and ends only on explicit stop or unavoidable task termination.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "proposal-1",
      "approval_score": 7,
      "would_adopt": false,
      "summary": "Proposal 1 has resolved the prior current-freshness and monitoring defects and is now the correct implementation baseline. I would adopt it after one focused contract revision, but not exactly as written: correlation-group reduction and confidence coverage remain underspecified, UNKNOWN evidence may still inflate coverage depending on implementation, and the output can overstate source and geographic completeness. These issues are local and do not require architectural redesign.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "evidence fusion",
          "description": "Strongest-within-correlation-group selection, polarity preservation, contradiction inputs, and independentGroupWeight are not normatively defined.",
          "required_change": "Specify deterministic temporal and polarity-aware group reduction, retain both polarities for conflict, use one bounded coverage weight per group, and preserve discarded observations only as provenance."
        },
        {
          "id": "",
          "severity": "major",
          "area": "confidence",
          "description": "UNKNOWN has zero log-odds contribution but may still increase confidence coverage because effective group weight is undefined.",
          "required_change": "Explicitly exclude UNKNOWN, expired, unknown-time, and other zero-information evidence from both availability and confidence coverage."
        },
        {
          "id": "",
          "severity": "major",
          "area": "coverage semantics",
          "description": "The design can label coverage complete even though advertised pagination does not prove geographic completeness and gdebenz has no described completeness contract.",
          "required_change": "Separate transport completion, pagination completion, truncation, and geographic completeness; report geographic completeness as unknown unless a source contract proves it."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "deadline validation",
          "description": "Worst-case pagination arithmetic omits retry backoff, jitter, rate-limit scheduling, parsing, and cancellation overhead.",
          "required_change": "Include every configured delay in validation or reserve a documented safety margin and accept explicit deadline truncation."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "eligibility",
          "description": "The statuses considered an explicit positive observation are not listed.",
          "required_change": "Define whether eligibility positives are IN_STOCK only or also LIMITED, and state that UNCERTAIN and UNKNOWN cannot independently qualify."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "geometry",
          "description": "Anchor-hull buffer semantics are not algorithmically specified.",
          "required_change": "Define buffering using minimum distance to hull segments or another exact tested operation."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "network safety",
          "description": "Configurable URL templates are not restricted to expected hosts.",
          "required_change": "Validate HTTPS scheme and an explicit per-adapter host allowlist."
        }
      ],
      "assumptions": [
        "The supplied source observations are accurate for 2026-08-30 but do not establish stable upstream contracts.",
        "No available source can guarantee complete geographic coverage merely by completing one search request or its advertised pages.",
        "UNKNOWN evidence represents absence of information and must not increase confidence."
      ],
      "round": 3,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 7
would_adopt: false
