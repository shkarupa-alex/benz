## Facts & Constraints (White Hat)

Before judging round two I re-checked the runtime contract this spec now pins itself to, because the whole document fails closed on it. On this machine `agent-browser 0.35.1` is installed, which sits exactly at the floor of the declared `>=0.35.1 <0.36.0` range, and every required feature the spec enumerates genuinely exists: `--namespace`, `--session`, `--idle-timeout <time>`, `--pin-tab`, `--json`, `eval --stdin` (plus `-b/--base64`), `session list`, `close [--all]`, `tab list`. I probed `agent-browser --namespace fuel-review-probe session list --json` and got `{"success":true,"data":{"sessions":[]}}` without spawning a daemon, so the cleanup-verification step is mechanically sound. Two subtler claims also check out and deserve credit: `--config <path>` documents itself as loading a specific file *instead of* the defaults, so the "dedicated `agent-browser.json`" idea really does suppress `~/.agent-browser/config.json` and `./agent-browser.json`; and since env vars outrank config files in the documented precedence chain, the requirement to clear `AGENT_BROWSER_*` before spawning is not paranoia but a necessary complement. Version pinning against a 0.x CLI is the right call.

Constraints that still bind and are only partly addressed:

- **`--idle-timeout 10s` does double duty.** There is no `daemon stop` verb in the CLI, so the 10-second idle timeout is the *only* mechanism that reaps the daemon — which is why cleanup step 10 waits 12 seconds. That is defensible, but it also means any inter-command gap in the Node runner longer than 10 seconds can silently kill the daemon mid-run. The spec sets command budgets (30 s/45 s) but never states the complementary invariant ("Node-side processing between two browser commands must stay below the idle timeout") nor how a daemon-idle-shutdown is classified when it happens (it will masquerade as `NETWORK` and burn the single allowed session recreation).
- **HTTP status is still not observable.** `agent-browser open` exposes no HTTP status code and has no `--timeout`. The spec requires `HTTP_STATUS`/`HTTP_ERROR` classification and "retry one transient 502 within the same tick" — with no stated detection mechanism. `network requests --filter` exists and would work, but the spec never says so, and it disables HAR without clarifying that request metadata inspection remains allowed.
- **Timestamp semantics.** The gate wisely says "timestamp semantics are known, or the adapter emits `ObservationTime.UNKNOWN`", and the report example implies MSK. But there is no accepted-format allowlist (epoch seconds vs milliseconds vs offset-bearing ISO vs offset-less local), no `displayTimeZone` config key, and no clock-skew bound. Volgograd's UTC+4 (2018–2020) → UTC+3 history makes an offset-less local parse a one-hour freshness error, which converts directly into a confident `ЕСТЬ`.
- **Geometry dependencies are unnamed.** "Pinned dependencies are used for JSON Schema validation and geometry operations" leaves both library choice and buffering algorithm open, and a 500 m buffer in lon/lat is not a scalar operation (0.00449° lat vs 0.00682° lon at 48.72 °N; corner rounding differs between turf-style geodesic buffering and a local-ENU Minkowski sum).

## Risks & Failure Modes (Black Hat)

**1. The confidence table produces a defect under the shipped default configuration.** The row "Two fresh agreeing exact observations from configured independent groups → `высокая`" cannot fire, because the default `provenanceGroups` puts Yandex and gdebenz both in `crowd-overlap` and 2GIS is catalogue-only. So two fresh agreeing exact observations match **no** row and fall to "Otherwise: one tier lower than the strongest applicable row" — the strongest applicable row being "One fresh exact direct observation → `средняя`", one tier lower is `низкая`. **Two agreeing fresh sources therefore yield strictly lower confidence than one.** That is a monotonicity violation baked into the default config, and it directly contradicts the user's stated "more supporting services are better". The fix is one row ("two or more fresh agreeing exact observations within the same provenance group → `средняя`, never below the single-observation tier") plus a stated floor rule.

**2. `UNCERTAIN` has no verdict.** `AvailabilityStatus` includes `UNCERTAIN`, and the original task records it as an actually-observed Yandex value. It appears **nowhere** in the verdict table, the confidence table, or the verdict→run-state mapping. A fresh exact `UNCERTAIN` would fall through to "Only stale, expired, unknown-time, `UNKNOWN`, or no evidence → `НЕТ СВЕЖИХ ДАННЫХ`", which is wrong (it *is* fresh evidence, just weak) and quietly conflates a distinct source signal with absence. For a table the spec calls exhaustively tested, this is a live hole.

**3. Verdict-table evaluation order is unstated, and one ordering is demonstrably wrong.** The table is headed "strongest applicable current evidence", implying first-match top-down, but this is never stated. Under top-down order, a fresh exact `OUT_OF_STOCK` combined with a fresh `FAMILY_PRESENT_UNSPECIFIED` positive hits the family row (`СКОРЕЕ ЕСТЬ`) *above* the `OUT_OF_STOCK` row, silently discarding a stronger, more specific negative — and the conflict rule doesn't rescue it because conflicts are defined only for "opposing **direct** observations". A weak model implementing this literally recommends a station that a fresh exact observation says is dry.

**4. Three snapshot types are undefined, and two interfaces regressed from typed to prose.** `CollectionSnapshot` references `ReconciledStation`, `StationAssessment`, and `MonitorState` — none is defined anywhere. Meanwhile the previous round's `BrowserRunner` and `SourceAdapter` TypeScript interfaces have been **replaced by bullet lists** in "Component responsibilities", yet the contract-test section still requires "a fake `BrowserRunner` [that] tests every adapter without a live browser". You cannot write a fake against prose. This is a net regression in exactly the area the round-one review flagged.

**5. Ownership of the next-run computation is ambiguous.** `collect.mjs` accepts `--monitor-state` and emits `nextMonitorState` in the snapshot; `monitor-state.mjs prepare` also "derive[s] the next availability-run state without committing it". Two components claim the same responsibility, and the monitoring cycle (steps 1–3: collect → report → commit) **never calls `prepare`**. An implementer must decide who owns availability-run derivation — an architectural decision the spec was supposed to remove.

**6. The fuel alias table — the skill's default behavior — does not exist.** The user's core default is "AI-95 and *all* premium/branded AI-95 variants". `config.json` shows `"requestedProducts": {}` (and `"sources": {}`, `"area": {}`) empty. Nowhere is there a list of variant keys (Экто 95, G-Drive 95, Ultimate 95, Пульс-95, …), a normalization procedure for Russian labels (case, `АИ-95` / `Аи 95` / `95`, hyphen/space variants, Latin/Cyrillic homoglyphs), or a rule for classifying an unrecognized branded label. `fuels.mjs` exists and unit tests reference "fuel aliases, branded variants", but the table under test is absent. Two implementers will produce two incompatible normalizers.

**7. Identity matching has thresholds but no scoring function.** `minimumSecondBestMargin: 0.15` applies to a "normalized match score" that is never defined (components, weights, range). `minimumStreetSimilarity: 0.85` names no metric — Jaro-Winkler, normalized Levenshtein, and trigram Dice disagree substantially on Russian street strings — and no address-normalization rules are given for `ул./улица`, `просп./проспект`, or house numbers like `8А` / `8а` / `129Ж`. The thresholds look precise but are unimplementable without invention, in the one area the user explicitly warned about.

**8. `resolve-area.mjs` has a CLI contract and no resolution mechanism.** How anchor labels become coordinates is unspecified. The empirical work behind this spec used browser-mediated Nominatim; 2GIS CAPTCHAs and gdebenz 502s make source-adapter lookup unreliable. Yet no geocoding origin appears in the allowlist, no config entry, no rate limit or attribution obligation, no ledger row, and no fallback (manual coordinate entry). This was raised in round one and is unaddressed.

**9. Baselines are not invalidated by configuration change.** `expectedStationCount` / `minimumStationCount` are recorded once at the feasibility pass, and the `OK` gate is ≥70 % of expected. `areaHash` and `queryHash` exist in the snapshot but nothing says a changed `areaHash` invalidates baselines or suppresses diffs against a previous tick collected under a different area/query. Editing the area therefore either pins every source at `PARTIAL` forever or passes vacuously, and cross-configuration diffs would report phantom changes.

**10. The monitoring wait mechanism is still nominal.** "Wait using the agent runtime's interruptible wait mechanism… After each chunk, return control and inspect new user input" names no primitive and defines no API. There is still no out-of-band stop path (e.g. a `STOP` sentinel in the monitoring directory checked at each chunk boundary), which is also the only stop signal that survives a compaction or a re-entered loop. The monitoring test list asserts "no wait chunk above 50 seconds" and "stop during wait" — assertions that cannot be written against an unspecified mechanism, and whose test subject (script vs. agent behavior) is not identified.

**11. Long-running monitoring versus finite agent context is still unaddressed.** "Until the user asks to stop" over hours means ~20 wait chunks plus a collection and a report per tick. Nothing bounds ticks, and nothing describes re-entry after context compaction. The on-disk monitoring state makes recovery *possible*, but no rule says "on resume, read the monitoring directory and continue from `dueAt`". This is the second unaddressed round-one finding.

**12. `ActivityEvidence` is structurally inconsistent with the rolling-count path.** `eventTimes: string[]` is non-optional, but the rolling-count resumption path (previous count 0, current ≥2, newer latest timestamp) yields no event times at all. Worse, that path also demands "a demonstrable preceding gap of at least 60 minutes" without saying how it is demonstrated — the natural derivation is "the validated rolling window length ≥ `quietGapMinutes` and the previous count was zero", but since the window length is exactly the semantics the feasibility gate may leave unvalidated, the condition can be permanently unsatisfiable. Result: ranking criterion #1 — the user's single strongest heuristic — may silently never fire, with no telemetry saying so.

**13. Minor but real:** the normative report example contradicts the confidence table (`95+: НЕТ (низкая уверенность, 12 мин)` — a fresh exact negative matches "One fresh exact direct observation → `средняя`"); goldens are generated from this example. The soak assertion "residual RSS attributable to owned processes is zero after process exit" is tautological and strictly weaker than round one's "no upward RSS trend beyond a defined tolerance". Default enablement per source is still unstated (2GIS's current-status capability is disabled by the matrix, so an enabled 2GIS adapter buys catalogue-only data at the cost of repeated CAPTCHA exposure every 15 minutes). And exit code 75 (cleanup unverified) versus exit 0 (valid degraded snapshot) leaves SKILL.md without a stated rule for "publish the report anyway, then retry cleanup".

## Strengths & Benefits (Yellow Hat)

This round is a large, genuine improvement, and several things I attacked held:

- **The release-gated feasibility pass is the single best decision in the document.** Making capability validation milestone #2 — with fixtures, coverage baselines, and an explicit "stop with an infeasibility result if no source exposes validated current status" — correctly inverts the round-one failure mode where the whole ranking edifice rested on `fuelAvailability` fields nobody had contracted. "Their names in this specification are conceptual, not assertions about the current Yandex schema" is exactly the right epistemic posture for an unversioned internal representation.
- **The capability matrix (my round-one traceability miss) now exists** and is load-bearing: `EVENT_TIMELINE` "unsupported until proven" for Yandex, 2GIS current status "disabled unless independently validated", `crowd-overlap` provenance grouping. Capabilities cannot be emitted without fixtures, and "candidate" is explicitly not a runtime state.
- **The process/browser contract is now concretely implementable**: `spawn` with an argument array and `shell: false`, JS via stdin (no shell interpolation of page data), per-command/adapter/tick deadlines with numbers, payload and pagination caps, exit-code table, atomic write-and-rename, `0700`/`0600`, symlink rejection, namespace-scoped `close --all` only. The dedicated `--config` file plus environment clearing is technically correct against the CLI's documented precedence.
- **The security section is better than most production specs**: page content as untrusted data, no execution of page-returned JS, origin allowlisting, control-character and bidi stripping, Markdown escaping, bounded strings, credential-name redaction, HAR redaction confined to explicit development mode.
- **`BOUNDED_AGE` now classifies on `maxMinutes`**, the conflict/supersession rules are stated as interval arithmetic with a 30-minute window, ranking criterion 2 has been split into two ordered sub-keys, and the run-state anti-flap rule (`availabilityResetTicks: 2`, pending state, raw transitions kept in provenance) is precise — all round-one findings, all closed.
- **Cadence is now start-to-start with explicit no-catch-up** (`max(previousDueAt + 15m, lastTickStartedAt + 15m)`), which quietly kills a whole class of drift and burst bugs.
- **Honest degradation everywhere**: `EMPTY_RESULT` never conflated with `SCHEMA_CHANGED`, "an adapter is never `OK` merely because its process exited successfully", "if every source fails, the result is 'degraded collection' rather than 'no petrol'", cleanup failure never upgrades observations.

## Alternatives & Creative Ideas (Green Hat)

- **Make the stop path a file, not a hope.** `monitor-state.mjs` already owns a private directory; add `stop` as a fifth operation and have every wait chunk boundary check for `<dir>/STOP`. This makes "stop during wait", "stop during collection", and post-compaction resume all testable against a real artifact rather than an unnamed runtime affordance.
- **Add a `time` config group** (`displayTimeZone: "Europe/Volgograd"`, `acceptedTimestampFormats`, `maxClockSkewMinutes`) and a rule that any offset-less timestamp degrades to `ObservationTime.UNKNOWN`. Cheap, and it removes the highest-impact silent-wrongness path in the freshness engine.
- **State the buffer algorithm rather than the library**: project to local ENU metres at a fixed origin (area centroid), Minkowski-sum the hull with an N-segment circle (N = 32), reproject, ray-cast with boundary inclusive. Then the library becomes an implementation detail rather than an architectural decision, and the two supplied control points (Ангарская 8А, Рокоссовского 4Б) plus the eight hull vertices become named golden fixtures instead of prose expectations.
- **Emit a `heuristicAvailability` telemetry field** in the snapshot recording *why* `TRANSACTIONS_RESUMED` did not fire (`NO_TIMELINE_CAPABILITY`, `NOT_GRADE_SPECIFIC`, `GAP_NOT_DEMONSTRABLE`, `INSUFFICIENT_EVENTS`). Without it, the user's top-priority heuristic can be permanently inert and indistinguishable from "no station qualified".
- **Ship 2GIS default-disabled in V1.** Its current-status capability is already disabled by the matrix, so an enabled adapter contributes only catalogue evidence — which by design cannot enter any recommendation list — while triggering an automated CAPTCHA every 15 minutes. Enabling it only after the API path or a validated current-status capability lands is strictly better on cost, legality, and noise.
- **Define the match score as an explicit formula** (e.g. `0.5·distanceScore + 0.3·houseNumberScore + 0.2·streetSimilarity`, with the metric named as token-set-normalized Jaro-Winkler over a documented Russian abbreviation-expansion table). The thresholds already in `config.identity` then become meaningful rather than decorative.

## Completeness & Process (Blue Hat)

Structurally the document now covers everything the task asked for, plus a well-ordered 12-step implementation sequence, and the Open Questions list is correctly limited to genuine configuration tuning. The remaining gaps are not missing *sections* but missing *tables*: three undefined snapshot types, two de-typed interfaces, the fuel alias table, the identity score function, the buffering algorithm, the timestamp format contract, the `resolve-area` mechanism, and three empty config groups (`sources`, `area`, `requestedProducts`) that happen to hold the skill's entire default behavior. All are enumerable and mechanical; none requires re-architecting.

## Traceability

The Decision Ledger exists, is now 37 rows, and carries rationale plus provenance. Every adopted row maps to body content, including the round-one miss I flagged: "Add per-source capability matrix and completeness invariants" is now genuinely realized as both a matrix and a numeric invariants table. The eleven new round-1-refinement rows (feasibility gate, fail-closed versioning, dedicated browser config, numeric budgets, atomic prepare/commit, claim scopes, disabled single-source high confidence, untrusted content, release blocking) all appear in the body. Every rejected/deferred row appears in "Rejected / deferred alternatives" or the relevant section; no orphans.

Two traceability defects remain: (a) **no ledger row for the geocoding/area-resolution dependency**, which is a real external service decision that `resolve-area.mjs` cannot avoid; (b) the adopted row "Use atomic monitoring-state prepare/commit" is contradicted in the body by `collect.mjs` also emitting `nextMonitorState`, so the ledger entry does not uniquely determine the implementation. Minor phrasing carryover: two rows still state the option rather than the decision ("Use direct HTTP as the primary runtime transport | rejected").

## Decomposition Readiness

Substantially better than round one. Cleanly cuttable now: process runner, browser runner lifecycle, cleanup verification, monitoring cadence arithmetic, queue normalization, freshness classification, diff rules, exit codes, security/sanitization, snapshot atomicity. Still requiring an implementer to make an architectural decision: (a) `fuels.mjs` — no alias table or normalization rules; (b) `identity.mjs` — no score function or string metric; (c) `geometry.mjs` — no buffering algorithm or library; (d) `resolve-area.mjs` — no resolution mechanism; (e) `verdict.mjs` — table ordering unstated, `UNCERTAIN` unhandled, "otherwise" rule circular; (f) `availability-runs.mjs` versus `collect.mjs` — ownership of `nextMonitorState` unresolved; (g) adapters and their fake — no `SourceAdapter`/`BrowserRunner` signatures.

## Weak-Model Executability

Round one's worst offenders are gone: budgets, limits, exit codes, identity thresholds, coverage thresholds, and the verdict table are all numeric or tabular now. What a weaker model would still have to invent: the fuel alias set and its matcher; the string-similarity metric and address normalizer; the geometry buffer construction; the timestamp parser's accepted formats; HTTP-status/502 detection given `open`'s output; the surplus-tab enforcement procedure ("enforce the single-tab invariant" names no commands — `tab list` → close all but the pinned `targetId` is the obvious realization but is not written); the "agent runtime's interruptible wait mechanism"; and the confidence "otherwise" rule, whose "one tier lower than the strongest applicable row" is self-referential when by construction no row applied. Prose-only interfaces (`BrowserRunner`, `SourceAdapter`) are precisely the flagged anti-pattern and were typed in the previous revision.

## Contract Completeness

Strong on limits, budgets, error codes, coverage thresholds, exit codes, file permissions, and test enumeration; weak on the type surface and the default-behavior configuration. Specific gaps: `ReconciledStation`, `StationAssessment`, `MonitorState` undefined; `BrowserRunner`/`SourceAdapter` untyped; `ActivityEvidence.eventTimes` non-optional but unpopulated on the rolling-count path; `areaHash`/`queryHash` computed and consumed by no stated rule; `strongSignalThresholds`, `sources`, `area`, `requestedProducts` all empty objects; the confidence table missing a same-group-agreement row and a floor rule; the verdict table missing `UNCERTAIN` and an ordering statement; no `displayTimeZone`/timestamp-format contract; no per-source default-enabled flag; no minimum interval between on-demand runs despite the low-volume legal posture. TBDs outside Open Questions: "All coordinates must be reverified against at least one target map during implementation" (acceptable, gated) and the unnamed pinned dependencies (not acceptable — it hides a library choice).

---

**Bottom line:** this revision closed the two round-one criticals in the right way — the `TRANSACTIONS_RESUMED` feasibility problem is now handled by a capability matrix and a release gate rather than by assertion, and the browser/process contract went from prose to numbers. The architecture is sound and I would build on it. But I did break it in three places that would produce wrong output if implemented literally: the confidence table gives two agreeing fresh sources *lower* confidence than one under the shipped default provenance grouping; `UNCERTAIN` — a value the task records as actually observed — has no verdict; and the unstated table ordering lets a family-unspecified positive outrank a fresh exact `OUT_OF_STOCK`. Add the missing snapshot types, restore the two typed interfaces, supply the fuel alias table and identity score function, and pin the geometry algorithm and timestamp contract, and this reaches 8+.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "spec-review",
      "approval_score": 7,
      "would_adopt": true,
      "summary": "A large and genuine improvement over the previous revision: the release-gated feasibility pass, the per-source capability matrix, numeric process/payload/pagination budgets, an exit-code table, atomic monitoring-state prepare/commit, interval-based conflict and supersession rules, start-to-start cadence with no catch-up, and a strong untrusted-content section together close almost every round-one blocker, and I verified against the installed agent-browser 0.35.1 that the pinned CLI contract (--namespace, --session, --idle-timeout, --pin-tab, eval --stdin, session list --json, --config replacing default config discovery) is real. I would adopt the architecture. But it is not yet safe to implement literally: under the shipped default provenance grouping the confidence table gives two agreeing fresh exact observations LOWER confidence than one (no row matches, so the 'otherwise: one tier lower' rule applies), the observed AvailabilityStatus value UNCERTAIN appears in no verdict, confidence, or run-state mapping, and the verdict table's evaluation order is unstated in a way that lets a family-unspecified positive outrank a fresh exact OUT_OF_STOCK. Three snapshot types (ReconciledStation, StationAssessment, MonitorState) are referenced but undefined, and BrowserRunner/SourceAdapter regressed from typed interfaces to prose bullets while the contract tests still require a fake BrowserRunner. The skill's own default behavior is unspecified: requestedProducts, sources and area are empty objects and no AI-95 alias table, Russian address normalizer, identity score function, geometry buffering algorithm, timestamp-format contract, or resolve-area resolution mechanism exists. The monitoring wait primitive and long-run context exhaustion remain nominal, as in round one.",
      "phase": "spec-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "Confidence algorithm",
          "description": "The row 'Two fresh agreeing exact observations from configured independent groups -> высокая' cannot fire under the shipped default, because provenanceGroups puts yandex and gdebenz both in crowd-overlap and 2gis is catalogue-only. Two fresh agreeing exact observations therefore match no row and fall to 'Otherwise: one tier lower than the strongest applicable row', i.e. one tier below 'One fresh exact direct observation -> средняя' = низкая. Two agreeing sources yield strictly lower confidence than one, violating monotonicity and the user's 'more supporting services are better'. The 'otherwise' rule is also self-referential: when no row applied, 'the strongest applicable row' is undefined.",
          "required_change": "Add an explicit row for two or more fresh agreeing exact observations within the same provenance group (recommend средняя), add a floor rule stating confidence is never lowered by additional agreeing evidence, and replace the circular 'otherwise' rule with a deterministic default tier per verdict."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Verdict table",
          "description": "AvailabilityStatus includes UNCERTAIN - a value the original task records as actually observed on Yandex - but UNCERTAIN appears nowhere in the verdict table, the confidence table, or the verdict-to-run-state mapping. It would fall through to 'Only stale, expired, unknown-time, UNKNOWN, or no evidence -> НЕТ СВЕЖИХ ДАННЫХ', conflating fresh weak evidence with absence of evidence. Separately, the table's evaluation order is never stated; under top-down first-match a fresh FAMILY_PRESENT_UNSPECIFIED positive matches above 'Applicable OUT_OF_STOCK, fresh or recent' and silently discards a stronger, more specific fresh negative, which the conflict rule does not catch because conflicts are defined only for opposing direct observations.",
          "required_change": "Add explicit UNCERTAIN rows to the verdict, confidence and run-state mappings; state that the verdict table is evaluated strictly top-down first-match; and reorder or add a guard so a fresh exact negative is never overridden by family-unspecified positive evidence without producing ПРОТИВОРЕЧИВО."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Type surface",
          "description": "CollectionSnapshot references ReconciledStation, StationAssessment and MonitorState, none of which is defined anywhere in the spec. Additionally, the previous revision's typed BrowserRunner and SourceAdapter interfaces have been replaced by prose bullet lists in Component responsibilities, while the contract-test section still requires a fake BrowserRunner that exercises every adapter - which cannot be written against prose. ActivityEvidence.eventTimes is also non-optional but is necessarily empty on the rolling-count resumption path.",
          "required_change": "Define ReconciledStation, StationAssessment and MonitorState as TypeScript interfaces; restore BrowserRunner and SourceAdapter as typed interfaces with method signatures, parameter and return types; and make eventTimes optional (or document the empty-array contract) for the rolling-count path."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Default behavior configuration",
          "description": "The skill's core default - base AI-95 plus all premium/branded AI-95 variants - has no concrete definition. config.json shows requestedProducts, sources and area as empty objects; no alias table of branded variants, no Russian label normalization rules (case, АИ-95 / Аи 95 / 95, hyphen and space variants, Latin/Cyrillic homoglyphs), and no rule for classifying an unrecognized branded label. fuels.mjs and its unit tests reference a table that does not exist.",
          "required_change": "Include the default requestedProducts content with productKey/variantKey values for base AI-95 and each configured premium variant, the alias-matching normalization procedure, and the fallback classification for unrecognized labels; provide at least a filled example for the sources and area groups."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Station identity",
          "description": "minimumSecondBestMargin (0.15) applies to a 'normalized match score' that is never defined (components, weights, range), and minimumStreetSimilarity (0.85) names no metric - Jaro-Winkler, normalized Levenshtein and trigram Dice differ materially on Russian street names. No address normalization rules are given for ул./улица, просп./проспект, or house numbers such as 8А / 8а / 129Ж. The thresholds appear precise but are unimplementable without invention, in the exact area the user warned about.",
          "required_change": "Define the match score formula with named components and weights, name the string-similarity metric and its tokenization, and specify the Russian address normalization table (abbreviation expansion, case folding, house-number canonicalization) with fixture examples including two distinct stations 60 m apart."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Geometry and area resolution",
          "description": "The 500 m hull buffer has no stated algorithm and the geometry dependency is unnamed ('pinned dependencies ... for geometry operations'), so an implementer must choose both. At 48.72N a 500 m offset is 0.00449 deg latitude but 0.00682 deg longitude and corner treatment differs between geodesic buffering and a local-ENU Minkowski sum. Separately, resolve-area.mjs has a full CLI contract but no defined mechanism for turning anchor labels into coordinates: no geocoding origin in the allowlist, no config entry, no rate limit or attribution obligation, no ledger row, and no manual-entry fallback, even though 2GIS CAPTCHAs and gdebenz 502s make source-adapter lookup unreliable.",
          "required_change": "Pin the buffer construction (project to local ENU metres at the area centroid, Minkowski-sum with an N-segment circle with N specified, reproject, boundary-inclusive ray casting), name the pinned geometry and schema libraries, and declare the area-resolution mechanism explicitly - either a named geocoding origin with config entry, kill switch, rate limit and attribution, or manual coordinate entry as the supported path - with a matching ledger row."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Monitoring lifecycle",
          "description": "'Wait using the agent runtime's interruptible wait mechanism ... after each chunk return control and inspect new user input' names no primitive and defines no API, so the monitoring tests ('no wait chunk above 50 seconds', 'stop during wait') have no writable subject. There is no out-of-band stop path, and nothing addresses long-run agent context exhaustion or re-entry after compaction despite monitoring running 'until the user asks to stop' - both carried over unaddressed from the previous review.",
          "required_change": "Name the concrete wait primitive used by the active agent, add a STOP sentinel file operation to monitor-state.mjs checked at every chunk boundary, and specify loop re-entry after compaction (read the monitoring directory, resume from dueAt) plus what the agent does with exit code 75 (publish the report, then retry cleanup)."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Component ownership",
          "description": "collect.mjs accepts --monitor-state and emits nextMonitorState in the snapshot, while monitor-state.mjs prepare also derives the next availability-run state; the monitoring cycle (collect -> report -> commit) never calls prepare. Two components claim the same responsibility and the sequence omits one of them.",
          "required_change": "Assign availability-run derivation to exactly one component, remove or re-scope nextMonitorState accordingly, and insert the prepare step explicitly into the monitoring cycle."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Time handling",
          "description": "No accepted-timestamp-format allowlist (epoch seconds vs milliseconds vs offset-bearing ISO vs offset-less local), no displayTimeZone config key despite the report example showing МСК, and no clock-skew bound, even though every verdict derives from now minus observedAt. Volgograd's UTC+4 (2018-2020) to UTC+3 history makes an offset-less local parse a one-hour freshness error that converts directly into a false ЕСТЬ.",
          "required_change": "Add a time config group (displayTimeZone, acceptedTimestampFormats, maxClockSkewMinutes), require offset-less or ambiguous timestamps to degrade to ObservationTime.UNKNOWN, and add parsing fixtures covering millisecond-epoch, second-epoch and offset-less cases."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Browser transport details",
          "description": "Three unresolved mechanisms: (1) the 10s idle timeout is the only daemon reaper (no daemon stop verb exists), so any Node-side gap between browser commands exceeding 10s silently kills the daemon mid-run and will be misclassified as NETWORK, consuming the single allowed session recreation; (2) agent-browser open exposes no HTTP status, yet HTTP_STATUS/HTTP_ERROR classification and a single 502 retry are required, with no detection method stated (network requests --filter would work but is not mentioned); (3) 'enforce the single-tab invariant' names no commands for surplus/popup tab cleanup.",
          "required_change": "State the inter-command gap invariant relative to the idle timeout and how a daemon idle shutdown is classified distinctly from NETWORK; specify the HTTP status / 502 detection mechanism; and specify the tab enforcement procedure (tab list, close all but the pinned targetId, fail on tab_gone)."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Baselines and diff validity",
          "description": "expectedStationCount and minimumStationCount are recorded once at the feasibility pass and gate OK at 70%, but nothing invalidates them when the area or query changes. areaHash and queryHash exist in the snapshot but no rule consumes them, so a diff can compare ticks collected under different areas or product sets.",
          "required_change": "Require baselines to be keyed to areaHash and marked stale when it changes, and require report.mjs to suppress the change section when the previous snapshot's areaHash or queryHash differs."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Golden example correctness",
          "description": "The normative report example renders '95+: НЕТ (низкая уверенность, 12 мин)', but a 12-minute-old exact negative is fresh and matches the confidence row 'One fresh exact direct observation -> средняя'. Since goldens are generated from this example, the contradiction would be frozen into test expectations.",
          "required_change": "Correct the example to match the confidence table, or annotate the evidence scope that justifies низкая."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "Activity heuristic observability",
          "description": "The rolling-count resumption path requires 'a demonstrable preceding gap of at least 60 minutes' without stating how it is demonstrated (the natural derivation is a validated rolling-window length >= quietGapMinutes with a zero previous count). If the window semantics stay unvalidated, ranking criterion 1 - the user's strongest heuristic - can be permanently inert and indistinguishable from 'no station qualified'. Recommend emitting a reason code (NO_TIMELINE_CAPABILITY, NOT_GRADE_SPECIFIC, GAP_NOT_DEMONSTRABLE, INSUFFICIENT_EVENTS) in the snapshot."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Scope",
          "description": "Per-source default enablement is still unstated. With current grade status 'disabled unless independently validated' for 2GIS, an enabled 2GIS adapter contributes only catalogue evidence that by design cannot enter any recommendation list, while triggering an automated CAPTCHA every 15 minutes. Recommend declaring 2GIS default-disabled for V1."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Soak test rigor",
          "description": "'Residual RSS attributable to owned processes is zero after process exit' is tautological and strictly weaker than the previous revision's 'no upward RSS trend beyond a defined tolerance'. 'Process count does not grow' does not say whether the measurement is global or namespace-scoped."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Rate limiting",
          "description": "The legal posture claims low-volume use and caps monitoring at one tick per 15 minutes, but on-demand runs are unbounded and no minimum interval between runs is configured or enforced across modes."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Ledger phrasing",
          "description": "Two ledger rows still state the option rather than the decision ('Use direct HTTP as the primary runtime transport | rejected', 'Use official 2GIS API in V1 | deferred'), making the Status column read inconsistently against positively-phrased adopted rows. There is also no ledger row for the area-resolution/geocoding dependency."
        }
      ],
      "assumptions": [
        "I treated the locally installed agent-browser 0.35.1 as the target runtime and validated the spec's CLI claims (--namespace, --session, --idle-timeout, --pin-tab, --config, --json, eval --stdin, session list --json, tab list, close --all) against its help output plus a read-only 'session list --json' probe in an unused namespace; I made no network requests to Yandex, 2GIS or gdebenz.",
        "I assumed the verdict table is intended to be evaluated top-down first-match, since the spec does not say, and reported the consequences of that reading.",
        "I assumed the default provenanceGroups shown in config.json (yandex and gdebenz both in crowd-overlap) is the shipped default when evaluating the confidence table's independence row.",
        "I assumed 'signalsCountPerHour' denotes a one-hour rolling window whose length is itself subject to the feasibility gate, since the spec explicitly declines to assert the current Yandex schema.",
        "I did not read any prior council artifacts under spec/**, per instructions; this review is based solely on the task text, the specification quoted above, and direct inspection of the installed agent-browser CLI."
      ],
      "round": 2,
      "reviewer": "opus1mhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 7
would_adopt: true
