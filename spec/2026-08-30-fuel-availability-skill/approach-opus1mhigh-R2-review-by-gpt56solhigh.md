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
      "target_id": "proposal-2",
      "approval_score": 4,
      "would_adopt": false,
      "summary": "Proposal 2 is more explainable after removing false-precision percentages, and its directness, evidence, identifier, and read-only transport distinctions are valuable. It is still not adoptable because it preserves automatic monitor termination and a city-wide default area, retains the demonstrated short-page pagination bug, has a first-match contradiction bug in the verdict table, lacks multi-product station-ranking semantics, gives unknown queues an invented rank, and defers required named-anchor and 2GIS capabilities outside the claimed complete V1.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "critical",
          "area": "monitoring lifecycle",
          "description": "Monitoring terminates after 12 hours, 48 runs, or four total-source failures instead of continuing until the user explicitly asks to stop.",
          "required_change": "Remove default terminal budgets and outage aborts; continue degraded reporting and retries until explicit stop or unavoidable host/task termination."
        },
        {
          "id": "",
          "severity": "major",
          "area": "monitor responsiveness",
          "description": "A 240-second wait chunk leaves the agent unresponsive beyond the required safe bounded-wait interval.",
          "required_change": "Limit each wait or poll to at most 60 seconds while preserving monotonic 15-minute targets."
        },
        {
          "id": "",
          "severity": "major",
          "area": "area configuration",
          "description": "A Volgograd-wide bbox is silently used despite the requirement for a user-configured acceptable area.",
          "required_change": "Fail closed when no rectangle, polygon, or resolved anchor boundary is configured; retain city bounds only as an explicit example."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Yandex pagination",
          "description": "Stopping on a short page would stop after the observed 24-item second page and miss the observed 13-item third page.",
          "required_change": "Do not terminate on one short page; use validated last-page metadata, empty or repeated pages, zero-new-ID criteria, deadline, or hard cap."
        },
        {
          "id": "",
          "severity": "major",
          "area": "verdict logic",
          "description": "The newer-negative rule precedes the conflict-window rule, so a negative report newer by one minute produces НЕТ rather than ПРОТИВОРЕЧИВО; approximate bounded ages are also compared as exact instants.",
          "required_change": "Apply conflict-window and interval-overlap logic before decisive-newer rules, and consider bounded evidence decisively newer only when its entire possible interval is newer."
        },
        {
          "id": "",
          "severity": "major",
          "area": "multi-product ranking",
          "description": "Assessments and the comparator are defined for one grade, but the default request contains AI95 and AI95_PREMIUM and no station-level aggregation rule is provided.",
          "required_change": "Define independent concrete-product assessments and select the best eligible exact product for station ranking and display."
        },
        {
          "id": "",
          "severity": "major",
          "area": "probability ordering",
          "description": "The categorical comparator can consult queue before distinguishing corroboration and evidence strength within the same verdict/confidence class, so it does not fully rank by likelihood first.",
          "required_change": "Add an explicit ordinal evidence-strength tuple before queue comparison, without requiring an invented floating-point probability."
        },
        {
          "id": "",
          "severity": "major",
          "area": "queue ordering",
          "description": "Unknown queue is assigned 1.5 and therefore ranks ahead of known medium/long queues and behind known none/short queues, contradicting the claim that it is neutral.",
          "required_change": "Compare queue only when both candidates have fresh comparable queue observations."
        },
        {
          "id": "",
          "severity": "major",
          "area": "fuel semantics",
          "description": "Generic gdebenz AI95 evidence is cloned into premium-AI95 evidence, and unmasked undocumented fmask grades become OUT_OF_STOCK.",
          "required_change": "Keep generic family evidence at the family-union level, never project it into premium-only evidence, and treat absent undocumented mask grades as unknown unless closed-world semantics are independently verified."
        },
        {
          "id": "",
          "severity": "major",
          "area": "required V1 scope",
          "description": "Named-anchor resolution and the 2GIS adapter are deferred to V2 even though both are explicit task requirements.",
          "required_change": "Include unambiguous named-anchor resolution and a real best-effort 2GIS catalogue adapter in the approved implementation scope."
        },
        {
          "id": "",
          "severity": "major",
          "area": "runtime privacy and state",
          "description": "Mutable state and automatic raw parser-body captures remain beneath the installed skill directory.",
          "required_change": "Use a configurable external state directory and make sanitized parser-body capture explicitly opt-in."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "identity matching",
          "description": "Globally distance-sorted greedy pairing is described as mutual-best but does not enforce reciprocal best candidates.",
          "required_change": "Require reciprocal-best acceptance or document and test the intended greedy behavior under competing candidates."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "freshness bands",
          "description": "Band 3 is imputed as 45 minutes despite a claimed source bound of less than one hour.",
          "required_change": "Use the verified maximum bound, conservatively 60 minutes if the less-than-one-hour meaning is correct."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "adapter errors",
          "description": "The must-never-reject adapter contract can hide implementation defects.",
          "required_change": "Return expected operational failures as data but let unexpected defects reject for pipeline-level classification."
        }
      ],
      "assumptions": [
        "The categorical verdicts may serve as probability bands, but queue must not be consulted before all intended likelihood evidence has been ordered.",
        "The supplied empirical source observations are provisional and undocumented.",
        "The original explicit-stop condition overrides the proposal's preferred safety budgets."
      ],
      "round": 2,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 4
would_adopt: false
