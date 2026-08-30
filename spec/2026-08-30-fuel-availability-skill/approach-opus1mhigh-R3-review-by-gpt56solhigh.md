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
      "target_id": "proposal-2",
      "approval_score": 3,
      "would_adopt": false,
      "summary": "Proposal 2 improves explainability and gives 2GIS a more defensible official-API path, but it still violates core requirements and retains several known correctness bugs. Monitoring terminates without user instruction, the default area is invented, waits are too long, Yandex pagination still stops on the demonstrated intermediate short page, multi-product ranking is undefined, unknown queue is assigned an invented rank, and unverified configuration can promote 2GIS to an availability source. It requires substantial redesign before implementation.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "critical",
          "area": "monitoring lifecycle",
          "description": "Monitoring terminates after fixed budgets or four failed cycles instead of continuing until the user explicitly stops it.",
          "required_change": "Remove default duration, run-count, and outage termination; continue degraded summaries and retries until explicit stop or unavoidable host/task termination."
        },
        {
          "id": "",
          "severity": "major",
          "area": "monitor responsiveness",
          "description": "The proposed wait blocks for up to 240 seconds.",
          "required_change": "Yield or poll at intervals no longer than 60 seconds and define use of the current task's durable continuation mechanism."
        },
        {
          "id": "",
          "severity": "major",
          "area": "area configuration",
          "description": "The design silently substitutes a Volgograd-wide bbox for the missing user-configured acceptable area.",
          "required_change": "Fail closed until an area is configured; retain the city bounds only as an explicit example."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Yandex pagination",
          "description": "Stopping on a short page would omit the observed third page after the observed 24-item second page.",
          "required_change": "Remove short-page termination and stop on validated last-page metadata, empty/repeated pages, zero-new-ID criteria, deadline, or hard cap."
        },
        {
          "id": "",
          "severity": "major",
          "area": "bounded-time verdicts",
          "description": "Freshness bands are reduced to one imputed age, allowing approximate evidence to become decisively newer and produce НЕТ.",
          "required_change": "Retain minimum and maximum ages and apply decisive-newer rules only when interval ordering proves the required conflict-window separation."
        },
        {
          "id": "",
          "severity": "major",
          "area": "multi-product ranking",
          "description": "The comparator expects one station verdict, but no aggregation rule exists for the default AI95 plus premium/branded query.",
          "required_change": "Assess concrete products independently, select the best eligible exact product for the union query, and display that product as the cause of rank."
        },
        {
          "id": "",
          "severity": "major",
          "area": "queue ordering",
          "description": "Unknown queue is assigned 1.5 and therefore receives an invented relative position.",
          "required_change": "Compare queue only when both candidates have fresh comparable queue observations."
        },
        {
          "id": "",
          "severity": "major",
          "area": "fuel semantics",
          "description": "Generic AI95 is cloned into premium evidence and absent undocumented fmask grades become OUT_OF_STOCK.",
          "required_change": "Keep family-only evidence at the family-query level, never project it into premium variants, and treat absent mask grades as unknown without independently verified closed-world semantics."
        },
        {
          "id": "",
          "severity": "major",
          "area": "2GIS capability",
          "description": "Configuration can promote an unverified registry adapter to availability, while the adapter itself is deferred to V2.",
          "required_change": "Implement the key-gated registry adapter in V1 with fixed code-declared capabilities; require validated schemas, freshness semantics, fixtures, and code changes before enabling availability."
        },
        {
          "id": "",
          "severity": "major",
          "area": "required scope",
          "description": "Named-anchor resolution and 2GIS integration are deferred while V1 is described as the complete requirement.",
          "required_change": "Include both capabilities in V1, even if 2GIS normally reports MISSING_CREDENTIAL or unavailable."
        },
        {
          "id": "",
          "severity": "major",
          "area": "state and diagnostics",
          "description": "Mutable state and automatic raw-body dumps remain beneath the installed skill.",
          "required_change": "Move runtime state to a configurable external directory and make sanitized raw-body capture opt-in."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "credentials",
          "description": "The 2GIS API key is stored directly in config.local.json.",
          "required_change": "Prefer an environment-variable name or protected credential store and redact the key from every diagnostic path."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "identity",
          "description": "Distance-sorted greedy matching is still described more strongly than its one-to-one guarantees justify.",
          "required_change": "Require reciprocal-best matches or document and test second-choice assignment behavior."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "output semantics",
          "description": "Phrases such as 'fuel ended' can turn loss of support or freshness into a confirmed stock-out.",
          "required_change": "Use 'no longer supported by current evidence' unless a fresh direct negative observation caused the transition."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "adapter errors",
          "description": "The must-never-reject contract can hide programming defects.",
          "required_change": "Return expected operational failures as data but classify unexpected exceptions at the pipeline boundary."
        }
      ],
      "assumptions": [
        "A documented 2GIS API key may be unavailable, but the adapter can still exist and report MISSING_CREDENTIAL.",
        "An adapter capability cannot safely be elevated solely by configuration.",
        "The original explicit-stop requirement overrides the proposal's preferred monitoring safety budgets."
      ],
      "round": 3,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 3
would_adopt: false
