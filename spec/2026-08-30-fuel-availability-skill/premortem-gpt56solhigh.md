1. Monitoring silently stopped after a task or automation lifecycle change

- What happened: The immediate report worked, but subsequent 15-minute summaries stopped appearing, appeared in another task, or duplicated after monitoring was restarted.
- Why: Monitoring depends entirely on a “native Codex heartbeat automation attached to the current task,” but the design does not define a verified automation API contract, durable task binding, heartbeat identity, idempotency key, or reconciliation after restart. “Create or update” is not enough to prevent duplicate heartbeats.
- Prevention: Treat scheduling as a separately validated capability before implementation. Define a stable monitor ID, task/thread ID, desired schedule, last successful tick, and reconciliation procedure. Each tick should have a deterministic idempotency key, and every report should expose scheduler health and the next expected run.

2. Browser-only collection became a common-mode failure

- What happened: Most ticks reported every source as degraded even though one or more sites remained usable in an ordinary browser. Persistent sessions expired, browser processes accumulated, or the unattended heartbeat environment could not reuse the sessions.
- Why: The design makes `agent-browser` the only transport for all three sources. This creates shared dependencies on browser startup, session persistence, CLI compatibility, JavaScript execution, and available resources. Separate named sessions isolate cookies, but they do not isolate failure of the browser runtime itself.
- Prevention: Preserve source-level transport diversity. Allow each adapter to use browser-mediated extraction or a direct read-only HTTP/API path behind the same contract. At minimum, add browser-runtime health checks, hard cleanup, session recreation tests across separate heartbeat invocations, resource limits, and a cached last-known-good result with an explicit age.

3. Yandex schema drift produced plausible but incomplete rankings

- What happened: Reports continued showing a short ranked list while stations or fuel variants were missing. Users interpreted the surviving rows as the best options in the configured area.
- Why: Extraction relies on unofficial DOM/internal `fuelAvailability` structures and scrolling or pagination heuristics. Although `SCHEMA_CHANGED` and `TRUNCATED` exist, the design does not require completeness invariants before publishing rankings. A partial parse can still look structurally valid and therefore avoid both errors.
- Prevention: Add adapter completeness contracts: expected field coverage, coordinate coverage, pagination termination evidence, duplicate ratios, and station-count baselines by area. If these regress materially, mark the whole source result partial and prevent it from supporting an unqualified “best stations” ranking. Show coverage explicitly in the report.

4. The ranking looked probabilistic but was not validated against reality

- What happened: Stations repeatedly ranked first despite users finding no suitable fuel there, while lower-ranked stations were more reliable.
- Why: The task asks for ranking by the probability that fuel is actually available, but the design substitutes categorical verdicts and a fixed lexicographic order. Freshness bands, source strength, signal-count thresholds, conflict handling, and source independence are hand-authored rules without outcome calibration. Lexicographic ranking can also let one categorical distinction dominate much fresher or better corroborated evidence.
- Prevention: Distinguish “evidence ranking” from estimated probability in the output. Initially label it explicitly as rule-based. Persist privacy-safe outcome feedback or later observations, measure per-source precision by status and age, and calibrate probabilities only after sufficient evidence. Until then, provide the contributing evidence tuple alongside rank and support configurable conservative ordering.

5. Cross-source station matching corrupted availability and queue evidence

- What happened: Availability from one station was combined with queue data from a nearby different station, or the same station appeared twice with contradictory results and misleading rank positions.
- Why: Matching depends on distance plus normalized brand/name/address, while source coordinates and addresses can be imprecise. “Conflicting known brands” is only one hard rejection; nearby same-brand stations remain risky. Persistent overrides help only after errors are noticed, and the design does not define match thresholds, ambiguity margins, or automatic revalidation when source metadata changes.
- Prevention: Require stronger merge evidence: source IDs where possible, tight distance limits, address-number agreement, road-side or access-point checks when available, and a minimum margin over the second-best candidate. Never transfer queue observations across a probabilistic match below a high threshold. Store match provenance and confidence, periodically revalidate overrides, and surface suspected duplicates instead of silently merging them.