## Facts & Constraints

Proposal 1 has substantially converged. It now correctly separates availability-capable sources from catalogue-only 2GIS, uses explicit observation-time types, avoids inferring missing gdebenz grades as out of stock, compares queues only when comparable, fails closed on missing area configuration, stores runtime state outside the skill, and continues monitoring through ordinary source failures.

Its direct-HTTP strategy is technically plausible given the supplied empirical observations. Treating 2GIS as best-effort catalogue enrichment is reasonable because its advertised products cannot establish current stock. Omitting a production browser fallback is therefore an acceptable trade-off, provided the source is visibly reported as unavailable rather than represented as successfully covered.

Proposal 2 improves explainability by replacing arbitrary weighted arithmetic with a decision table. However, it has not corrected several previously identified requirement conflicts, and it introduces gaps between its categorical verdict model and the required station ranking.

The empirical source findings in both proposals remain provisional contracts. Fixtures can pin observed structures, but they cannot make Yandex HTML, gdebenz freshness bands, or 2GIS catalogue fields stable or documented.

## Risks & Failure Modes

### Proposal 1

The major unresolved problem remains fetch-time-only evidence. When `/api/comments` fails, Proposal 1 says gdebenz station records receive `FETCH_TIME_ONLY` quality and cannot exceed low confidence. Candidate eligibility nevertheless requires only a non-expired positive observation, while expiration is undefined for an observation whose actual age is unknown. The current formula can treat the fetch as age zero, produce an availability estimate above `0.60`, and place the station under “currently available.” Fetch time proves retrieval time, not report time. Fetch-time-only evidence should be diagnostic or uncertain unless corroborated by a non-expired bounded/exact positive observation.

The pagination timing budget is also internally inconsistent. The first page must be fetched before pages 2–20 can be planned. Nineteen remaining pages at concurrency four require five waves; if every request consumes an eight-second attempt plus one retry, those waves alone can consume roughly 80 seconds, before the first page, retry jitter, throttling, parsing, and aggregation. That does not reliably fit an 80-second adapter deadline or 90-second cycle deadline. Partial results are acceptable, but the design should not assert a worst-case guarantee it cannot meet.

Additional specification gaps remain:

- `effectiveIndependentGroupWeight`, “strongest valid contribution,” positive weight, and negative weight are not fully defined. In particular, `UNKNOWN` evidence must not increase coverage merely because a source returned a record.
- The treatment of multiple contradictory observations inside one correlation group needs a deterministic temporal rule. Selecting one by absolute contribution can discard newer evidence.
- Yandex timestamp validation should explicitly cover seconds-versus-milliseconds errors, future clock skew, and implausible ages.
- Following every advertised page proves completion of the advertised result set, not full geographic station coverage. `CoverageAssessment` should distinguish pagination completion from source completeness.
- Optional convex-hull buffering lacks an algorithmic contract. A distance-to-hull boundary definition would avoid pretending that a general polygon-offset operation is trivial.
- A three-anchor minimum is valid for a polygon but does not support the useful case of two named stations defining opposite corners of a rectangle.

### Proposal 2

Proposal 2 still directly violates the monitoring lifecycle. It stops after 12 hours, 48 runs, or four total-source failures. The original requirement says monitoring continues until the user asks to stop. Resource guards may emit warnings, open per-source circuits, or reduce collection, but they cannot become default terminal conditions.

Its four-minute wait chunks are also inappropriate for responsive Codex operation. The design should yield or poll at most every 60 seconds. A stop sentinel checked inside the process does not help if the agent is unavailable to translate a conversational stop request into that sentinel.

The default city-wide bbox still contradicts the user-configured-area requirement. It is not conservative: it can recommend stations the user considers unacceptable. The supplied bounds can be an example, but absent configuration must fail closed.

The Yandex pagination bug remains. The proposal observed page sizes `25, 24, 13` but says to stop on a short page. It would stop at page 2 and miss page 3. Termination must use zero new IDs, an empty or repeated page, a validated last-page marker, or a hard cap.

The verdict table contains a first-match logic defect:

- Rule 2 declares `НЕТ` whenever an out-of-stock observation is newer than every in-stock observation.
- Rule 3 intends observations within 30 minutes to be contradictory.
- Because Rule 2 comes first, an out-of-stock report newer by one minute produces `НЕТ`, making the conflict window ineffective.

Bounded-age evidence makes this worse: an imputed approximate age should not defeat an exact positive observation unless the entire bounded interval proves it is decisively newer.

Other major issues include:

- There is no station-level aggregation contract for the default multi-product request. Verdicts are per station and grade, while the comparator accepts one `grade`. The design never specifies how AI-95, premium AI-95, and multiple branded variants produce one station rank.
- Removing numerical probability is defensible, but the replacement does not fully rank likelihood. Within one verdict/confidence class, queue can be consulted before corroboration count, directness detail, or source quality. The skill needs an explicit evidence-strength tuple before queue ordering.
- Unknown queue is still assigned a synthetic position of `1.5`. It therefore beats a known medium queue and loses to a known short queue. That is an assumption, not neutrality. Queue should be compared only when both candidates have fresh comparable values.
- General gdebenz AI-95 evidence is cloned into an inferred premium-AI-95 observation. A source that does not distinguish premium fuel supplies no evidence for a premium-only request. Its AI-95 evidence already supports the default union because plain AI-95 is acceptable; variant cloning is unnecessary and misleading.
- Unmasked grades in undocumented `fmask` become `OUT_OF_STOCK`. Cross-checking the bitmask against `fuels_now` can detect a mapping mismatch, but it does not prove that absence has closed-world “out of stock” semantics.
- `fresh_band: 3` is imputed as 45 minutes despite the other revised proposal describing the source bucket as “less than one hour.” If the latter is accurate, 60 minutes is the conservative upper bound.
- The globally distance-sorted greedy matcher is not mutual-best matching. After one candidate is consumed, it can assign another station to a second-best candidate that would not reciprocally select it.
- Raw parser-failure bodies are captured automatically. They should be opt-in, sanitized, and stored outside the installed skill.
- Runtime state remains under the installed skill’s `state/` directory rather than an external configurable state directory.
- V1 defers both named-anchor resolution and the 2GIS adapter while claiming to deliver the whole user-facing requirement. Both are explicitly requested capabilities.
- The recursive Yandex walk remains too permissive and the “last script wins” rule too brittle. Extraction should be limited by validated result-container, query, identifier, availability, and geometry sentinels.
- The adapter “must never reject” rule can hide programming defects. Expected source failures should be returned as health data; unexpected defects should reject and be classified at the pipeline boundary.

## Strengths & Benefits

Proposal 1 is now strong in the areas most likely to affect real-world correctness:

- explicit source roles and capability declarations;
- conservative use of `fuels_now`;
- no `fmask` interpretation without verification;
- concrete-product isolation for branded fuel;
- bounded-age modeling for coarse freshness;
- separate availability, confidence, and freshness;
- queue-presence versus queue-size separation;
- availability-first ranking with queue comparison only between comparable values;
- visible truncation and source-health reporting;
- monotonic, non-overlapping monitoring;
- fail-closed geometry;
- external runtime state and disabled raw-body retention;
- extensive parser, scoring, integration, and monitoring tests.

Proposal 2’s strongest contribution is explainability. An enumerable verdict table is easier to audit than a collection of uncalibrated floating-point constants. Its distinctions among direct, inferred, stale, approximate, and conflicting evidence are useful. Heterogeneous gdebenz identifiers, GET/HEAD-only enforcement, non-persistence of user-submitted IDs, byte-stable output, and explicit `КОСВЕННО` rendering are also good design decisions.

## Alternatives & Creative Ideas

The best final design remains Proposal 1 with a small amount of Proposal 2’s categorical explainability.

Keep Proposal 1’s estimated availability score for ordering, but render it primarily as a probability band—such as “likely,” “possible,” or “weak support”—alongside the numeric estimate only as a documented heuristic. Confidence should remain separate. This satisfies the probability-ranking requirement without letting an uncalibrated percentage dominate the user-facing explanation.

Use a strict observation-time eligibility matrix:

| Time kind | May qualify alone as current? | Freshness treatment |
|---|---:|---|
| Exact | Yes | Actual age |
| Bounded age | Yes, using maximum age | Conservative bound |
| Fetch-time only | No | Unknown |
| Cached/expired | No | Historical only |

For multi-product queries, calculate assessments independently and select the best eligible exact product. Family-only evidence can support a family-union assessment, but must not be projected into a named branded variant.

For contradictory correlated observations, first reduce each correlation group using a documented temporal state rule, then combine independent groups. Unknown observations should remain provenance only and contribute neither likelihood nor coverage.

Pagination should combine advertised metadata with defensive termination:

1. Fetch the first page.
2. Establish a bounded page plan.
3. Continue despite an isolated short page.
4. Stop on validated last-page metadata, empty page, repeated fingerprint, zero new IDs over a configured streak, deadline, or hard cap.
5. Report separately whether pagination completed and whether source-wide geographic completeness is knowable.

For monitoring, keep Proposal 1’s immediate report, monotonic targets, skipped-tick behavior, and explicit-stop-only lifecycle. Poll the foreground process in no more than 60-second intervals.

## Completeness & Process

Proposal 1 is close to implementation-ready but still needs normative definitions for unknown-age eligibility, evidence-group reduction, coverage semantics, and deadline arithmetic. Those changes are local and do not require architectural redesign.

Proposal 2 remains internally inconsistent despite its improved explanation model. Its direct requirement violations—automatic termination, invented area, incomplete V1 scope, and broken pagination—must be corrected before implementation. The verdict-table approach can be salvaged, but only after repairing rule precedence, bounded-time comparison, multi-product aggregation, and probability-ordering semantics.

Both designs should add invariant tests stating:

- Fetch-time-only evidence cannot independently produce a current-availability candidate.
- `UNKNOWN` evidence cannot increase confidence.
- A bounded timestamp cannot be treated as decisively newer unless its whole possible interval is newer.
- A short intermediate page does not terminate Yandex pagination.
- Default AI-95 ranking identifies the concrete product that caused eligibility.
- Missing generic-family data never becomes variant-specific evidence.
- Monitoring survives arbitrary consecutive source failures.
- Monitoring stops only on explicit user request or unavoidable task/host termination.
- Unknown queue never receives an invented comparative position.
- Completion of advertised pagination is not labeled guaranteed geographic completeness.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "proposal-1",
      "approval_score": 7,
      "would_adopt": false,
      "summary": "Proposal 1 has substantially converged and is the clear foundation to carry forward: its source roles, conservative grade semantics, fail-closed area, external state, comparable-only queue ranking, confidence separation, and explicit-stop monitoring align closely with the task. I would adopt it after a focused revision, but not as written because fetch-time-only evidence can still qualify as current, evidence-group reduction remains underspecified, and the stated Yandex pagination deadline does not fit its own retry and concurrency arithmetic.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "freshness eligibility",
          "description": "Fetch-time-only gdebenz evidence has no actual observation age, yet the scoring and candidate rules can treat it as non-expired and place it under currently available.",
          "required_change": "Make fetch-time-only evidence freshness-unknown and ineligible to qualify a current candidate unless corroborated by a non-expired exact or bounded-age positive observation."
        },
        {
          "id": "",
          "severity": "major",
          "area": "pagination deadlines",
          "description": "Fetching the first page and then up to nineteen remaining pages with concurrency four, eight-second timeouts, one retry, throttling, and jitter cannot reliably fit the asserted 80-second adapter and 90-second cycle deadlines.",
          "required_change": "Provide correct end-to-end attempt budgeting, reduce the page or retry envelope, or explicitly accept deadline-truncated pagination without claiming the bounded worst case fits."
        },
        {
          "id": "",
          "severity": "major",
          "area": "scoring contract",
          "description": "The design does not normatively define effective group weight, status polarity, UNKNOWN participation, or which observation survives within a correlation group.",
          "required_change": "Specify a deterministic per-group reduction algorithm and ensure UNKNOWN or zero-weight evidence contributes neither likelihood nor confidence coverage."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "coverage",
          "description": "Completing advertised pagination is not proof that a maps search returned every station geographically present in the area.",
          "required_change": "Distinguish pagination completeness from unknowable source/geographic completeness in CoverageAssessment and output."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "geometry",
          "description": "Polygon buffering and the useful two-station rectangle case are not fully specified.",
          "required_change": "Define buffering as distance to hull segments or another exact algorithm, and optionally support two explicit anchors as opposite rectangle corners."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "timestamp validation",
          "description": "Yandex timestamp unit, future-skew, and implausible-age handling are not explicit.",
          "required_change": "Add validation and fixtures for seconds versus milliseconds, bounded future skew, invalid values, and excessive age."
        }
      ],
      "assumptions": [
        "The supplied live-source observations are accurate for 2026-08-30 but do not establish stable upstream contracts.",
        "Fetch time alone conveys no usable upper bound on report age.",
        "Monitoring must continue through unlimited recoverable source outages until explicitly stopped."
      ],
      "round": 2,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 7
would_adopt: false
