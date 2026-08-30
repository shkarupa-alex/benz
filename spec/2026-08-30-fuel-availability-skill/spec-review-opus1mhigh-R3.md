## Facts & Constraints (White Hat)

This is the third revision I have stress-tested, so I concentrated on the claims that are newly checkable against the actual runtime rather than re-litigating settled design. I re-verified the pinned dependency, `agent-browser 0.35.1`, which sits at the floor of the declared `>=0.35.1 <0.36.0` range, and every CLI feature in the required-features list genuinely exists: `--config` (documented as loading a file *instead of* the defaults, so the dedicated `agent-browser.json` really does suppress `~/.agent-browser/config.json` and `./agent-browser.json`), `--namespace`, `--session`, `--idle-timeout`, `--pin-tab`, `--allowed-domains`, `--json`, `open`, `eval --stdin`, `tab list`, `tab close`, `session list`, `close`, `close --all`. I re-probed `agent-browser --namespace <unused> session list --json` and got `{"success":true,"data":{"sessions":[]}}`, so the empty-owned-session cleanup invariant is mechanically verifiable. `--allowed-domains` is a genuinely strong choice here: the CLI documents it as *rejecting* CDP, auto-connect, profiles, restore/state replay, direct-page providers and unsafe startup args, so it enforces much of the isolation posture at the CLI level rather than by convention.

Two round-2 items are now correctly resolved at the factual level. The turf `7.2.0` pin removes the geometry-library ambiguity, and `booleanPointInPolygon`'s default (`ignoreBoundary: false`) matches the spec's "boundary points count as inside", so that pairing is internally consistent. The temporal section is now fully specified — UTC-with-`Z` internally, `Europe/Moscow` for display, retained `originalValue` and `sourceTimeZone`, required verified timezone when no offset is embedded, calendar validation, and `>5 min` future values demoted to `UNKNOWN/FUTURE_CLOCK_SKEW` — which closes the freshness-corruption hazard I raised twice.

The one factual claim that does not survive checking is the environment-isolation list. I enumerated every environment variable the installed CLI documents (61 of them). Of the 18 the spec clears, 17 are real and one — `AGENT_BROWSER_CDP` — does not exist. More importantly the denylist **misses roughly 25 real variables, including the four with the worst failure modes**:

- `AGENT_BROWSER_MAX_OUTPUT` — truncates page output. An inherited value smaller than the spec's 2 MiB eval budget yields *short-but-well-formed* extraction results, which defeats the entire `TRUNCATED`/`BODY_TOO_LARGE` detection strategy (those are enforced Node-side on the stream) and silently degrades coverage into a `PARTIAL` that looks like a real thin day.
- `AGENT_BROWSER_EXECUTABLE_PATH` and `AGENT_BROWSER_ARGS` — arbitrary browser binary and arbitrary Chrome launch flags.
- `AGENT_BROWSER_ENGINE` — switches to `lightpanda`, a different engine, silently invalidating every fixture-validated extraction contract.
- `AGENT_BROWSER_IGNORE_HTTPS_ERRORS`, `AGENT_BROWSER_CA_CERT`, `AGENT_BROWSER_ALLOW_FILE_ACCESS`, `AGENT_BROWSER_CONTENT_BOUNDARIES`, `AGENT_BROWSER_DEFAULT_TIMEOUT`, `AGENT_BROWSER_JSON`, `AGENT_BROWSER_DEBUG`, `AGENT_BROWSER_ACTION_POLICY`, `AGENT_BROWSER_CONFIRM_ACTIONS`/`CONFIRM_INTERACTIVE` (the latter auto-denies when stdin is not a TTY, i.e. always here), `AGENT_BROWSER_PROXY`/`PROXY_BYPASS` (the spec only removes *generic* proxy variables; these are not generic), `AI_GATEWAY_URL` (they clear `API_KEY` and `MODEL` but not `URL`), plus `ENCRYPTION_KEY`, `STATE_EXPIRE_DAYS`, `RESTORE_CHECK_*`, `AUTOSAVE_INTERVAL_MS`, `USER_AGENT`, `PIN_TAB`, `DOWNLOAD_PATH`, `WEBGPU`, `STREAM_*`, `IOS_*`.

A hand-maintained denylist against a 0.x CLI that adds environment variables between releases is the wrong shape. The correct construction is an allowlist: unset everything matching `^AGENT_BROWSER_` and `^AI_GATEWAY_` plus the generic proxy set, then set only the five variables the runner needs. Notably `AGENT_BROWSER_IDLE_TIMEOUT_MS` — which I expected to be fictional — *does* exist, so the supplied-variable list is correct.

## Risks & Failure Modes (Black Hat)

**1. Environment denylist (above).** Security- and correctness-relevant, verifiable, and cheap to fix. `AGENT_BROWSER_MAX_OUTPUT` in particular converts a hard-won failure taxonomy into a silent-undercount path.

**2. The confidence base table is keyed on "one" observation and has no rule for multiple.** Round two had a monotonicity defect (two agreeing same-group observations scored *lower* than one). The "one tier lower" fallback that caused it is gone — good — but the replacement rows literally read "`AVAILABLE` from **one** fresh exact direct observation → `MEDIUM`". Two fresh agreeing exact observations from the same provenance group (the shipped default puts Yandex and gdebenz in `crowd-overlap`, so this is the *common* case) match no base row and are not eligible for the `HIGH` upgrade. The defect changed from "wrongly lowered" to "undefined", which is better but still a hole in a table the Definition of Done calls exhaustively tested. Related: nothing says what happens when several base rows match at once — e.g. a `LIKELY_AVAILABLE` supported both by fresh grade-specific resumption (`MEDIUM`) and by family-unspecified evidence (`LOW`). Max? First? Unspecified.

**3. Availability runs open on one tick but close on two.** The mapping sends both `AVAILABLE` and `LIKELY_AVAILABLE` to run state `AVAILABLE`, and `LIKELY_AVAILABLE` includes the `LOW`-confidence family-unspecified path. So a single flaky low-confidence tick after a stable negative immediately produces basis `OBSERVED_TRANSITION` and the report line "появился между 15:45 и 16:00" — a flat factual claim about a delivery event, with no confidence qualifier attached, derived from evidence the same document rates `LOW`. Closing a run correctly requires two consecutive negatives; opening one requires a single positive. The anti-flap rule is asymmetric in exactly the direction that generates false "fresh delivery" alerts, which is also the highest-consequence claim in the whole report because it is what makes the user drive somewhere.

**4. `httpStatus` and the 502 retry rest on an undeclared mechanism.** `SourceHealthRecord.httpStatus?: number` is a new field, and gdebenz's adapter must "retry one transient 502 in the same tick". But `agent-browser open` exposes no HTTP status, and `network requests` is **not** in the required-CLI-features list. With the declared feature set, `httpStatus` is unfillable and 502 is indistinguishable from any other failed load. This is the third round this gap has survived.

**5. Interfaces still described in prose.** `BrowserRunner` and `SourceAdapter` remain bullet lists in "Component responsibilities" — no method signatures, parameter types, or return types — while the contract-test section requires "Fake `BrowserRunner` for every adapter". You cannot write a fake against bullets. Three rounds, unchanged, and it is the pivot on which the entire adapter-parallelisation strategy rests.

**6. Several referenced types are still undefined — contradicting this round's own ledger row.** The ledger adopts "Define all referenced snapshot, assessment, station, state, and execution schemas". Yet `NormalizedQueue` (used by `StationAssessment.queue`), `ExecutionWarning` (used by `ExecutionEnvelope.warnings`), and every config sub-type — `RuntimeConfig`, `MonitoringConfig`, `FreshnessConfig`, `ActivityConfig`, `QueueConfig`, `IdentityConfig`, `RankingConfig`, and above all `RequestedProductsConfig` — are referenced and never defined. Most are semi-derivable from the defaults JSON; `RequestedProductsConfig` is not, because it has no example at all.

**7. The skill's headline default behaviour is still unspecified.** The task's central requirement is "AI-95 and all premium/branded AI-95 variants by default". There is no alias table, no list of variant keys, no normalization procedure for Russian fuel labels (`АИ-95` / `Аи 95` / `95` / `АИ 95 Экто` / Latin-Cyrillic homoglyphs), and no rule for classifying an unrecognised branded label. Deferring the *source-label → product* mapping to the feasibility milestone is legitimate; deferring the requested-product set and the normalization algorithm is not, because neither depends on what the pages look like. `fuels.mjs` exists and unit tests reference "aliases, variants, and union scopes" — the table under test does not.

**8. Duplicate ownership of next-state preparation persists.** `collect.mjs` is responsible for "Prepare availability-run state without committing it" and emits `nextMonitorState?: MonitorState` in the snapshot; `monitor-state.mjs prepare` "calculate[s] next state without mutating committed state" from `--state` and `--snapshot`. Both compute the same artifact. The tick sequence calls prepare at step 3, leaving `nextMonitorState` either dead or authoritative — undecided. Raised in round two, unchanged.

**9. Monitoring's capability gate is fail-closed but undetectable.** Requiring an interruptible wait primitive and refusing to emulate it with `sleep` is the right call and materially better than round two. But `SKILL.md` "must establish that the current agent runtime can wait ≤50 s, return control, return early on user input, and continue the same task" with no named primitive and no probe procedure. No agent harness exposes introspection for this, so in practice the gate either always passes by assertion or always fails, and the monitoring test "interruptible wait capability gate" has no writable subject. Relatedly — and now for the third round — nothing bounds monitoring duration or describes re-entry after context compaction. The on-disk `MonitorState` plus `recover` make resumption *possible*, but no instruction ties them together ("on resume: run `recover`, read `dueAt`, continue").

**10. `areaHash`/`queueHash` are computed and consumed by nothing.** Both live in the snapshot. Nothing invalidates a source's `expectedStationCount` baseline when the area changes (the new 90-day `BASELINE_STALE` rule catches age, not scope), and nothing suppresses the change section when the previous snapshot was collected under a different area or product set. Editing the area therefore either pins every source at `PARTIAL` or passes vacuously, and diffs across a config change report phantom transitions.

**11. `--allowed-domains` can misclassify a broken page as a schema change.** Restricting resource domains is right, but if the feasibility pass records an incomplete CDN/resource set, the page renders partially and the adapter reports `SCHEMA_CHANGED` — sending the operator to hunt a nonexistent site change. There is no distinct "blocked resource" classification and no requirement that the feasibility pass capture the *complete* resource-domain set with a verification step.

**12. `queueRank: 5 = unknown or incomparable`** sorts a station with no queue data *below* one with a `VERY_LONG` queue. Missing queue data is a source-coverage artifact, not evidence of a bad queue, so this systematically demotes otherwise-good stations for a reason unrelated to the user's decision. The spec correctly refuses to treat unknown as zero; ranking it as worse-than-worst is the opposite invented judgment, and it is unremarked.

**13. Smaller items.** The golden report example still contradicts the confidence table (`95+: НЕТ (низкая уверенность, 12 мин)` — 12 min is `FRESH`, and `NOT_AVAILABLE` from one fresh exact/family-all direct observation is `MEDIUM`); this was raised in round two and goldens are generated from it. `monitor-state.mjs init --output <state-directory>` versus `prepare/commit/recover/cleanup --state <state-path>` leaves directory-vs-file ambiguous. The verdict table is never explicitly declared top-down first-match. The 10-second idle timeout still doubles as the only daemon reaper, and no invariant bounds the Node-side gap between browser commands below it, nor classifies a daemon idle-shutdown distinctly from `NETWORK` (it would burn the single allowed session recreation). Default enablement per source remains unstated, so a `CHALLENGE_ONLY` 2GIS adapter would trip a CAPTCHA endpoint every 15 minutes to print one line that could equally be a static configuration note. On-demand runs still have no minimum interval despite the low-volume legal posture. The soak assertion "no residual owned RSS remains after process exit" remains tautological.

## Strengths & Benefits (Yellow Hat)

Several things I attacked directly and could not break:

- **The round-two verdict-table ordering bug is genuinely fixed, and fixed correctly.** A fresh exact `OUT_OF_STOCK` plus a fresh family-unspecified positive now resolves to `LIKELY_AVAILABLE` for a *union* query — which I initially flagged as wrong and then realised is logically sound: "base AI-95 is out" and "some AI-95 product is present" are simultaneously satisfiable when a premium variant exists. For an exact premium query, family-only evidence is explicitly indirect and cannot qualify. The distinction between `FAMILY_PRESENT_UNSPECIFIED` and `FAMILY_ALL_PRODUCTS`, and the rule that a family negative applies only under the latter, is the cleanest piece of reasoning in the document.
- **`UNCERTAIN` now has a verdict** (`INDIRECT`), closing a hole in a status value the task recorded as actually observed.
- **The temporal contract is complete**, including future-skew rejection with a typed reason — a failure mode that silently manufactures freshness in most scrapers.
- **Publish-then-compare-and-swap-commit with `reportId` idempotence and a `recover` path** is the right ordering. Committing before publication would let an undelivered report become the diff baseline; the chosen design prefers a labelled duplicate to a lost transition, and says so.
- **"Unknown gap does not extend continuous availability"**, with a dedicated Russian phrase and a golden case, is a subtle honesty win most specs would miss.
- **`SourceConfig.mode` (`EVIDENCE` / `CATALOGUE_ONLY` / `CHALLENGE_ONLY`)** turns the previously vague "2GIS is mostly useless" posture into an enforceable state with matching contract tests ("catalogue-only observations cannot enter recommendations", "challenge-only sources emit no stations").
- **`BASELINE_STALE` with a 90-day expiry and an explicit prohibition on self-recalibration from monitoring** prevents the classic drift where a degrading source quietly redefines "normal".
- **Isolation is enforced rather than asserted**: `--allowed-domains`, dedicated `--config`, `shell: false` with argv arrays, JS via stdin, stream-enforced byte limits ("must not first buffer an unbounded result and then measure it"), main-frame URL revalidation after redirects, and the explicit refusal to kill by global process name.
- **The Definition of Done is a real gate**, not a checklist: if no source passes the current-status capability gate, implementation terminates with a feasibility report rather than shipping a catalogue browser with a confidence vocabulary.

## Alternatives & Creative Ideas (Green Hat)

- **Invert the environment handling into an allowlist** (`unset` everything matching `^AGENT_BROWSER_`/`^AI_GATEWAY_` plus generic proxy vars, then set the five needed) and add an integration test that injects `AGENT_BROWSER_MAX_OUTPUT=1024`, `AGENT_BROWSER_ENGINE=lightpanda` and `AGENT_BROWSER_EXECUTABLE_PATH=/bin/false` and asserts the run is unaffected. That single test would have caught this class permanently.
- **Gate `OBSERVED_TRANSITION` on confidence.** Require the opening tick to be `AVAILABLE`, or `LIKELY_AVAILABLE` with confidence ≥ `MEDIUM`, before emitting "появился между X и Y"; otherwise emit "впервые увидели" with the confidence attached. Symmetry with the two-tick close rule follows naturally.
- **Make the monitoring gate a concrete probe rather than a claim.** Name the primitive the target runtime provides, and add a `STOP` sentinel in the monitoring directory checked at every chunk boundary as the mechanism-independent stop path. That also gives the "stop during wait" test a real subject and makes post-compaction re-entry well defined.
- **Declare `network requests` a required CLI feature** (it exists) and specify status extraction from it; that makes `httpStatus`, the 502 retry, and the blocked-resource-vs-schema-change distinction all implementable from one mechanism.
- **Fold `nextMonitorState` out of the snapshot** and let `monitor-state prepare` be the sole producer, or vice versa — either resolution is fine, but one must be written down.
- **Pin `turf.buffer` options explicitly** (`units: 'meters'`, an explicit `steps`) so corner geometry is reproducible across patch releases, and name Ангарская 8А and Рокоссовского 4Б plus the eight hull vertices as the geometry golden fixtures — they are already stated as expectations in the area section but never wired into the test list.

## Completeness & Process (Blue Hat)

Structurally complete: purpose, assumptions, definition of done, feasibility gate, architecture, data flow, component responsibilities, CLI contract, lifecycle, budgets, command interfaces, execution envelope, exit codes, schemas, capability matrix, per-source procedures, completeness invariants, area, identity, fuel semantics, temporal, verdict, confidence, activity, runs, queue, ranking, monitoring, on-demand, failure isolation, security, output, config, testing, sequence, legal, ledger, rejected list, open questions. The Definition of Done and the 14-step implementation sequence are genuinely usable as a project plan.

What remains is a short, enumerable list of *fill-ins* rather than missing sections: two prose interfaces, ten undefined referenced types, the fuel alias table, the HTTP-status mechanism, the environment allowlist, the prepare-ownership decision, and the `areaHash` consumption rule. None requires re-architecting.

## Traceability

The ledger exists, now runs to 52 rows with rationale and provenance, and correctly tags round-2 refinements. Every rejected/deferred row appears in the corresponding section, including the new ones (shell-loop monitoring, authenticated proxies, global process-name killing, automatic baseline learning, treating unknown gaps as continuous, committing before publication). Every round-2 adopted row I checked has body content: the interruptible-wait gate, the compatibility-vs-health-probe split, the bounded-helper cleanup definition, `--allowed-domains` plus environment clearing, deterministic confidence without a fallback phrase, clock validation, station-key continuity, publish-before-commit, duplicate-over-loss, baseline expiry, pinned dependencies, and no-global-kill.

Two defects: **(a)** the row "Define all referenced snapshot, assessment, station, state, and execution schemas" is only partly realised — `NormalizedQueue`, `ExecutionWarning`, `RequestedProductsConfig` and the seven config sub-types are referenced and undefined, and `BrowserRunner`/`SourceAdapter` remain prose; **(b)** the row "Reject global process-name killing during cleanup | **rejected**" is mis-statused — the body *adopts* the prohibition ("Production code must not kill by global process name"), so the Status column inverts the meaning. Minor carryover: two rows still phrase the option rather than the decision. There is still no ledger row for the area-resolution/geocoding dependency, and `resolve-area.mjs` still has a full CLI contract with no stated mechanism for turning anchor labels into coordinates — no geocoding origin in the allowlist, no config entry, no manual-entry fallback — which is my one remaining round-one finding that has never been addressed.

## Decomposition Readiness

Much improved. Independently cuttable now: process runner and stream limits, browser lifecycle and cleanup, exit codes and envelope, temporal library, geometry (turf pinned), queue normalization, ranking tuple (fully numeric), availability runs, diff rules, security/sanitization, completeness invariants, monitor-state generations and CAS. Still requiring an implementer to decide: `fuels.mjs` (no alias table or normalization rules); adapters and their fake (no `SourceAdapter`/`BrowserRunner` signatures); `resolve-area.mjs` (no resolution mechanism); `verdict.mjs` confidence selection (multi-observation and multi-row cases); who owns next-state preparation; how `httpStatus` is obtained.

## Weak-Model Executability

Round three removed the worst offenders — the "one tier lower" fallback is gone, the match score is now an explicit weighted formula with a named metric (trigram Jaccard) and a concrete normalization pipeline (NFKC, lowercase, `ё`→`е`, punctuation stripping, street-type dictionary, house corpus retained separately), the ranking tuple is fully enumerated with integer ranks, and every budget is numeric. What a weaker model would still guess: the AI-95 alias set and its matcher; the shape of `RequestedProductsConfig` and `NormalizedQueue`; the `BrowserRunner`/`SourceAdapter` method surface; how to obtain an HTTP status; how to "establish" the interruptible-wait capability; which base confidence row applies when several match or when more than one observation exists; whether the verdict table is first-match; whether `--state` is a file or a directory; the `queryKey` format for a union query.

## Contract Completeness

Strong on error taxonomies (now with `BASELINE_STALE` and `CLOCK_INVALID` and a full internal→public health mapping table), limits, exit codes, coverage thresholds, file modes, dependency pins, capability manifests, and test enumeration. The remaining gaps are the ten undefined types, the two prose interfaces, the absent `requestedProducts`/`area`/`sources` defaults (two of which are user configuration, not feasibility output), the unconsumed `areaHash`/`queryHash`, the unspecified `httpStatus` source, and the incomplete environment denylist. TBDs outside Open Questions: "Coordinates and source IDs must be reverified during implementation" (acceptable — gated) and "Source start URLs, domains, baselines, manifests, and fixture versions are populated by the feasibility milestone" (acceptable and well-justified as a release-produced artifact).

---

**Bottom line:** this is the strongest revision yet and the architecture is now sound enough that I would build on it. The round-two blockers I raised were largely closed on the merits rather than papered over — `UNCERTAIN` has a verdict, the family/exact interaction turned out to be correct once I reasoned it through, temporal handling is complete, turf is pinned, baselines expire without self-calibrating, and publish-before-commit with idempotent recovery is the right ordering. But I did break it in five concrete places: the environment denylist misses `AGENT_BROWSER_MAX_OUTPUT`, `EXECUTABLE_PATH`, `ARGS`, `ENGINE`, `IGNORE_HTTPS_ERRORS` and about twenty more real variables while clearing one (`AGENT_BROWSER_CDP`) that does not exist; the confidence base table is quantified on "one" observation and has no rule for the common two-same-group case or for multiple matching rows; availability runs open on a single `LOW`-confidence tick while requiring two to close, producing unqualified "появился между X и Y" claims; `httpStatus` and the 502 retry depend on a mechanism absent from the required feature list; and ten referenced types plus the two central interfaces remain undefined, contradicting this round's own ledger row. Land those and the next revision is an 8+.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "spec-review",
      "approval_score": 7,
      "would_adopt": true,
      "summary": "The strongest revision so far and architecturally adoptable: the round-two blockers were closed on the merits rather than deflected - UNCERTAIN now has a verdict, the family-versus-exact interaction turns out to be logically correct for union queries, temporal handling is fully specified including future-skew rejection, turf 7.2.0 is pinned with matching boundary-inclusive semantics, baselines expire without self-calibrating, and publish-then-compare-and-swap-commit with an idempotent reportId and a recover path is the right ordering for an active-task model with no delivery receipt. I verified the CLI contract against the installed agent-browser 0.35.1 and every required feature exists. I still broke it in five places. The environment isolation list is a hand-maintained denylist that misses roughly 25 real variables - including AGENT_BROWSER_MAX_OUTPUT, which silently truncates extraction into well-formed short results and defeats the entire TRUNCATED/BODY_TOO_LARGE strategy, plus EXECUTABLE_PATH, ARGS, ENGINE, IGNORE_HTTPS_ERRORS and ALLOW_FILE_ACCESS - while clearing AGENT_BROWSER_CDP, which does not exist. The confidence base table is quantified on 'one fresh exact direct observation', so two agreeing same-group observations (the shipped default) match no row, and nothing resolves multiple matching rows. Availability runs open on a single LOW-confidence LIKELY_AVAILABLE tick but require two negatives to close, so one flaky family-unspecified signal produces an unqualified 'появился между X и Y' delivery claim. httpStatus and the gdebenz 502 retry depend on a mechanism absent from the required CLI feature list. And ten referenced types plus the BrowserRunner and SourceAdapter interfaces remain undefined or prose-only, contradicting this round's own ledger row about defining all referenced schemas.",
      "phase": "spec-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "Browser environment isolation",
          "description": "The environment clearing list is a denylist of 18 names. Checked against the installed agent-browser 0.35.1, which documents 61 environment variables, it misses about 25 real ones with material impact: AGENT_BROWSER_MAX_OUTPUT (truncates page output, producing short-but-well-formed extraction results that defeat the spec's Node-side TRUNCATED/BODY_TOO_LARGE detection and silently degrade coverage), AGENT_BROWSER_EXECUTABLE_PATH, AGENT_BROWSER_ARGS, AGENT_BROWSER_ENGINE (lightpanda silently invalidates every fixture-validated extraction contract), AGENT_BROWSER_IGNORE_HTTPS_ERRORS, AGENT_BROWSER_CA_CERT, AGENT_BROWSER_ALLOW_FILE_ACCESS, AGENT_BROWSER_CONTENT_BOUNDARIES, AGENT_BROWSER_DEFAULT_TIMEOUT, AGENT_BROWSER_JSON, AGENT_BROWSER_DEBUG, AGENT_BROWSER_ACTION_POLICY, AGENT_BROWSER_CONFIRM_ACTIONS, AGENT_BROWSER_CONFIRM_INTERACTIVE, AGENT_BROWSER_PROXY, AGENT_BROWSER_PROXY_BYPASS, AI_GATEWAY_URL, ENCRYPTION_KEY, STATE_EXPIRE_DAYS, RESTORE_CHECK_*, AUTOSAVE_INTERVAL_MS, USER_AGENT, PIN_TAB, DOWNLOAD_PATH, WEBGPU, STREAM_*, IOS_*. It also clears AGENT_BROWSER_CDP, which the CLI does not document. A denylist against a 0.x CLI that adds variables between releases is structurally wrong.",
          "required_change": "Replace the denylist with an allowlist: unset every variable matching ^AGENT_BROWSER_ and ^AI_GATEWAY_ plus the generic proxy set, then set only AGENT_BROWSER_NAMESPACE, AGENT_BROWSER_SESSION, AGENT_BROWSER_IDLE_TIMEOUT_MS, AGENT_BROWSER_ALLOWED_DOMAINS and AGENT_BROWSER_CONFIG. Add an integration test that injects AGENT_BROWSER_MAX_OUTPUT=1024, AGENT_BROWSER_ENGINE=lightpanda and AGENT_BROWSER_EXECUTABLE_PATH=/bin/false and asserts the run is unaffected."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Confidence algorithm",
          "description": "Base confidence rows are quantified on a single observation ('AVAILABLE from one fresh exact direct observation -> MEDIUM', 'NOT_AVAILABLE from one fresh exact or family-all direct observation -> MEDIUM'). Two fresh agreeing exact observations from the same provenance group - the shipped default places yandex and gdebenz both in crowd-overlap, so this is the common case - match no base row and are not eligible for the HIGH upgrade, leaving confidence undefined. Separately, no rule resolves the case where several base rows match simultaneously, e.g. a LIKELY_AVAILABLE supported both by fresh grade-specific resumption (MEDIUM) and by family-unspecified evidence (LOW).",
          "required_change": "Requantify the base rows as 'at least one', add an explicit row for multiple agreeing same-group observations (recommend MEDIUM with an explicit no-downgrade floor), and state the selection rule when multiple base rows match (recommend: highest base confidence wins)."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Availability runs",
          "description": "The verdict-to-run mapping sends both AVAILABLE and LIKELY_AVAILABLE to run state AVAILABLE, and LIKELY_AVAILABLE includes the LOW-confidence family-unspecified path. An established run closes only after two consecutive NOT_AVAILABLE ticks, but opens on a single positive tick. One flaky low-confidence signal therefore emits basis OBSERVED_TRANSITION and the report line 'появился между 15:45 и 16:00' - an unqualified factual delivery claim, with no confidence attached, and it is the claim most likely to make the user drive somewhere.",
          "required_change": "Require the opening tick to be AVAILABLE, or LIKELY_AVAILABLE with confidence at least MEDIUM, before emitting OBSERVED_TRANSITION; otherwise emit FIRST_SEEN. Attach the underlying verdict's confidence to every appearance-time sentence, and add a golden case for a low-confidence opening tick."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Contracts and interfaces",
          "description": "The ledger adopts 'Define all referenced snapshot, assessment, station, state, and execution schemas', but NormalizedQueue (StationAssessment.queue), ExecutionWarning (ExecutionEnvelope.warnings), RequestedProductsConfig, RuntimeConfig, MonitoringConfig, FreshnessConfig, ActivityConfig, QueueConfig, IdentityConfig and RankingConfig are referenced and never defined. BrowserRunner and SourceAdapter remain prose bullet lists with no method signatures for the third consecutive revision, while the contract-test section requires a fake BrowserRunner exercising every adapter.",
          "required_change": "Define all ten referenced types as TypeScript interfaces, and restore BrowserRunner and SourceAdapter as typed interfaces with method names, parameter types and return types so the adapter fake and parallel adapter work are executable."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Default behaviour configuration",
          "description": "The task's headline default - base AI-95 plus all premium/branded AI-95 variants - still has no concrete definition. RequestedProductsConfig is undefined and absent from the defaults JSON, there is no alias table of branded variants, no normalization procedure for Russian fuel labels (АИ-95 / Аи 95 / 95 / АИ 95 Экто, hyphen and space variants, Latin-Cyrillic homoglyphs, NFKC, ё normalization), and no rule for classifying an unrecognised branded label. Deferring source-label-to-product mapping to the feasibility milestone is legitimate; deferring the requested product set and the normalization algorithm is not, since neither depends on the page contract.",
          "required_change": "Define RequestedProductsConfig, give the default requestedProducts content with productKey and variantKey values for base AI-95 and each configured premium variant, specify the fuel-label normalization pipeline and matcher, and state the fallback classification for unrecognised labels."
        },
        {
          "id": "",
          "severity": "major",
          "area": "HTTP status detection",
          "description": "SourceHealthRecord.httpStatus and the gdebenz rule 'retry one transient 502 in the same tick' both require an HTTP status, but agent-browser open exposes none and 'network requests' is absent from the required CLI feature list. With the declared feature set httpStatus is unfillable and 502 is indistinguishable from any other failed load. Third revision unresolved.",
          "required_change": "Add 'network requests' to the required CLI features and specify how status is extracted, or remove httpStatus and the status-specific retry rule and reclassify 502 detection explicitly (for example a validated page-text sentinel)."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Component ownership",
          "description": "collect.mjs is responsible for 'Prepare availability-run state without committing it' and emits nextMonitorState in the snapshot, while monitor-state.mjs prepare 'calculate[s] next state without mutating committed state' from --state and --snapshot, and the tick sequence calls prepare at step 3. Two components produce the same artifact and neither is declared authoritative. Raised in the previous round, unchanged.",
          "required_change": "Assign next-state derivation to exactly one component and remove or re-scope nextMonitorState accordingly."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Monitoring capability gate and re-entry",
          "description": "The interruptible-wait gate is correctly fail-closed but names no primitive and defines no probe, so 'SKILL.md must establish that the runtime can wait <=50s and return early' either always passes by assertion or always fails, and the monitoring test 'interruptible wait capability gate' has no writable subject. Nothing bounds monitoring duration or describes re-entry after context compaction; MonitorState and recover make resumption possible but no instruction connects them.",
          "required_change": "Name the concrete wait primitive, add a STOP sentinel file in the monitoring directory checked at every chunk boundary as a mechanism-independent stop path, and specify the resume procedure (run recover, read dueAt, continue) plus any maximum monitoring duration."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Area and query hashing",
          "description": "areaHash and queryHash are computed into every snapshot and consumed by no rule. Nothing invalidates a source's expectedStationCount baseline when the area changes (the new 90-day BASELINE_STALE rule catches age, not scope) and nothing suppresses the change section when the previous snapshot used a different area or product set. Raised in the previous round, unchanged.",
          "required_change": "Key baselines to areaHash and mark them stale when it changes; require report.mjs to suppress the changes section when the previous snapshot's areaHash or queryHash differs."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Resource allowlist and failure classification",
          "description": "--allowed-domains restricts resource domains, but an incomplete feasibility-recorded CDN set yields a partially rendered page that the adapter reports as SCHEMA_CHANGED, sending the operator to investigate a nonexistent site change. No distinct blocked-resource classification exists and nothing requires the feasibility pass to capture and verify the complete resource-domain set.",
          "required_change": "Require the feasibility pass to enumerate and verify the full resource-domain set, and add a distinct internal code (for example RESOURCE_BLOCKED) so allowlist gaps are not misreported as schema drift."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Golden example and CLI consistency",
          "description": "The normative report example renders '95+: НЕТ (низкая уверенность, 12 мин)', but 12 minutes is FRESH and NOT_AVAILABLE from one fresh exact or family-all direct observation is MEDIUM per the confidence table; goldens are generated from this example. Separately, monitor-state.mjs init takes --output <state-directory> while prepare/commit/recover/cleanup take --state <state-path>, leaving directory-versus-file ambiguous, and the verdict table is never explicitly declared top-down first-match.",
          "required_change": "Correct the example to match the confidence table, state whether --state is a directory or a file consistently across all five operations, and declare the verdict table's evaluation order explicitly."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "Ranking",
          "description": "queueRank sorts 'unknown or incomparable' (5) below VERY_LONG (4), so a station with fresh positive evidence and no queue data ranks beneath one with a very long queue. Missing queue data is a source-coverage artifact, not evidence about the queue; this is the mirror-image invented judgment to treating unknown as zero, and it is unremarked. Consider making the unknown-queue position configurable or documenting the rationale."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Traceability",
          "description": "The ledger row 'Reject global process-name killing during cleanup | rejected' inverts its own meaning - the body adopts the prohibition. Two rows still state the option rather than the decision. There is still no ledger row for the area-resolution dependency, and resolve-area.mjs retains a full CLI contract with no stated mechanism for turning anchor labels into coordinates (no geocoding origin in the allowlist, no config entry, no manual-entry fallback) - the one round-one finding never addressed."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Browser lifecycle",
          "description": "The 10-second idle timeout still doubles as the only daemon reaper (no daemon-stop verb exists). No invariant bounds the Node-side gap between browser commands below it, and a daemon idle-shutdown mid-run would be misclassified as NETWORK/COMMAND_FAILED and consume the single allowed session recreation. Risk is low given the chunked extraction budgets but remains unstated across three revisions."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Scope",
          "description": "Per-source default enablement is still unstated. A CHALLENGE_ONLY 2GIS adapter trips a CAPTCHA endpoint every 15 minutes to print one line that could equally be a static configuration note, which sits awkwardly with the legal posture. Recommend declaring CHALLENGE_ONLY sources default-disabled. Separately, on-demand runs still have no minimum interval, and the compare-and-swap/generation/recover machinery is the most defensible over-engineering candidate for a personal 15-minute checker, though it is cheap and its rationale is stated."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "Testing rigor",
          "description": "'No residual owned RSS remains after process exit' is tautological and weaker than the earlier 'no upward RSS trend beyond a defined tolerance'. turf.buffer options (units, steps) are not pinned, so corner geometry could shift across patch releases. The two supplied interior control points and eight hull vertices are stated as expectations in the area section but never named in the test list."
        }
      ],
      "assumptions": [
        "I treated the locally installed agent-browser 0.35.1 as the target runtime and enumerated its documented environment variables and CLI features directly from --help, plus a read-only 'session list --json' probe in an unused namespace; I made no network requests to Yandex, 2GIS or gdebenz.",
        "I assumed the verdict table is intended to be evaluated top-down first-match, since the spec still does not say, and evaluated its correctness under that reading.",
        "I assumed the shipped default provenanceGroups (yandex and gdebenz both in crowd-overlap) when analysing the confidence table's multi-observation behaviour.",
        "I assumed turf 7.2.0's booleanPointInPolygon default (ignoreBoundary false) is what satisfies the 'boundary points count as inside' requirement, since the spec pins the library but not the call options.",
        "I did not read any prior council artifacts under spec/**, per instructions; this review is based solely on the task text, the specification quoted above, and direct inspection of the installed agent-browser CLI."
      ],
      "round": 3,
      "reviewer": "opus1mhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 7
would_adopt: true
