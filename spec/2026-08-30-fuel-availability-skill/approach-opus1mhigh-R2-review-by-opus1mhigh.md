## Facts & Constraints (White Hat)

Both revisions now rest on empirical claims about three live services, so before weighing architecture I re-ran the probes — and extended them past where either author stopped. The constraint that matters most is that neither proposal's *pagination termination rule* survives contact with what Yandex actually returns, and that gdebenz's grade-level coverage is roughly an order of magnitude thinner than either document's headline framing implies. Everything below is from read-only GETs this session.

**Yandex pagination — the decisive new measurement.** I walked `?page=1..7`:

| page | businesses | new oids | cumulative | `totalResultCount` |
|---:|---:|---:|---:|---:|
| 1 | 25 | 25 | 25 | **51** |
| 2 | 25 | 22 | 47 | **100** |
| 3 | 25 | 23 | 70 | **132** |
| 4 | **24** | 22 | 92 | **99** |
| 5 | **24** | 24 | 116 | — |
| 6 | 14 | 14 | 130 | — |
| 7 | 0 | 0 | 130 | — |

The real answer is **130 unique stations**. `totalResultCount` is not merely jittery, it is *monotonically wrong in different directions per page* (51 → 100 → 132 → 99). And critically: **pages 4 and 5 are both short (24 < 25) yet page 5 contributes 24 brand-new oids.** Result overlap between requests is also real (page 2 delivered only 22 new of 25), so oid dedupe is mandatory.

**gdebenz — grade coverage measured, not asserted.** Wide Volgograd bbox, `/api/stations` 208 rows, `/api/comments` 118 rows, join on `osm_id` **118/118 clean**:

- station `status`: `null:81, no:66, yes:37, queue:24`
- `fresh_band`: `1:7, 2:59, 3:52`
- **non-empty `fuels_now`: only 31 of 208** (15%). Of the 61 positive (`yes`/`queue`) rows, **30 carry no fuel list at all**.
- **Stations with explicit AI-95 evidence: 13.** Twelve of them at `fresh_band 3`. **Stations with any premium-95 evidence: zero** — the vocabulary has no such concept.
- `fmask` ↔ `fuels_now` cross-check: **30/30 exact agreement** on every informative row. The `[92,95,98,100,ДТ]` bit order is confirmed a second time, independently.
- `status` ↔ comment `status`: **0 mismatches / 118**.

Two corrections to *both* documents' field models: `/api/stations.conflict` is **not** a boolean and **not** a flag — it is a string enum taking `null | "no" | "yes" | "queue" | "low"`, i.e. it carries *the conflicting report's status*. (`/api/comments.conflict` is separately `true | null`.) That also settles a side question: `"low"` is a real token in gdebenz's status vocabulary, which vindicates proposal 1 including it. And `GET /api/cfg` returns `{"live": false, "ct": "", "su": true, "edit": true, "rb": true, "ssd": true, "vw": true, "pick": true, "conf": true, "prices": {...}}` — a **`live: false` feature flag that neither proposal interprets**, and which plausibly gates the very live-status semantics both designs are built on.

**2GIS:** `curl` with a full desktop UA → **302** (challenge redirect). Confirmed hostile, again.

**Signal rates:** `signalsCountPerHour` reached 5, 3, 2, 3 across pages — so proposal 2's `highConfidenceSignalRate: 2` threshold is reachable, not aspirational. That resolves a concern I had about its confidence table collapsing to one value.

## Risks & Failure Modes (Black Hat)

**Proposal 1 — the round-1 critical finding is unfixed, verbatim.** §11 still reads: "Launch one foreground `monitor --ndjson` process" … "Publish the first snapshot immediately" … "Poll or wait in intervals no longer than 60 seconds" … "On explicit stop: abort active fetches; send `SIGINT`". These remain mutually exclusive. If the agent is blocked inside a foreground exec, it cannot publish snapshot *n* mid-call, cannot poll on 60-second intervals, and cannot send `SIGINT` — it has no turn in which to do any of it. The load-bearing justification is *still* a `learn.chatgpt.com` link about ChatGPT `/goal`, which is not evidence that a **Codex** skill has a durable-goal primitive. Proposal 2 identified this exact hazard unprompted, named it ("a single tool call that blocks for 15 minutes is a plausible harness timeout"), and fixed it with a chunked wait returning exit 20. Proposal 1 did not engage with it at all. For a design whose entire second user-facing mode depends on this, that is disqualifying as-written.

**Proposal 1 — verified silent under-collection.** §3.1: "Parse the first response and determine its advertised pagination. Fetch pages `2..lastPage`." Page 1 advertises `totalResultCount: 51`. Twenty-five per page ⇒ `lastPage = 3` ⇒ the adapter fetches 3 pages, collects **70 of 130 stations (54%)**, terminates normally, and reports health `OK` with `pagesFetched: 3/3` — because it never exceeded its own cap, so `TRUNCATED` never fires. The user gets a confident, complete-looking ranking over a **46% sample of the city**, with no warning. This is strictly worse than the tiling plan I flagged last round: that was merely infeasible, this is silently wrong. The design never mentions that `totalResultCount` is unstable, despite this being one of the two most reproducible facts about the source.

**Proposal 2 — verified truncation from the short-page rule.** §3.8: "stop on zero *new* oids **or** a short page." Page 4 returns 24 < `pageSize` 25 ⇒ stop ⇒ **92 of 130 stations (71%)**, losing the 38 stations on pages 5–6. Less severe than proposal 1's failure and it *would* at least be visible in `pagesFetched` diagnostics, but it is the same class of bug. The correct termination rule, given the measurements, is: stop only on zero businesses or zero *new* oids, capped by `maxPages`.

**Proposal 2 — a false-negative path that contradicts its own headline principle.** §3.8 insists, correctly and at length, that gdebenz `yes` with `fmask == 0` must yield `UNCERTAIN` rather than `IN_STOCK`, because a grade-blind "есть" says nothing about a specific grade. It then maps **`no` → `OUT_OF_STOCK` for watched grades** with no such qualification. But `no` is *equally* grade-blind: 66 of 208 rows carry `status:"no"`, and grade-blind negatives are exactly as uninformative about AI-95-premium as grade-blind positives. Feed that into the decision table's **Rule 2** — "a non-stale `OUT_OF_STOCK` newer than every non-stale `IN_STOCK` ⇒ `НЕТ`", first match wins — and a grade-blind community "нет" suppresses a station that Yandex reports as having 95+, with verdict `НЕТ` and no conflict marker. The asymmetry needs to be removed: grade-blind `no` should be `UNCERTAIN` for specific grades, or at minimum must not be eligible to fire Rule 2.

**Proposal 2 — Rule 3 is nearly unreachable, and the table is sign-asymmetric.** Rule 2 fires whenever the OOS observation is newer *at all*, with no margin. Rule 3 ("neither clearly newer, within `conflictWindowMinutes` 30") is checked afterwards, so it can only ever be reached when the **IN_STOCK** side is the newer one. Concretely: Yandex `IN_STOCK` 40 min ago + gdebenz `no` at imputed 45 min ⇒ Rule 3 ⇒ `ПРОТИВОРЕЧИВО`; flip the sign by five minutes (Yandex `IN_STOCK` 50 min, gdebenz `no` at 45) ⇒ Rule 2 ⇒ **`НЕТ`**. Two symmetric evidence configurations, wildly different verdicts. `conflictWindowMinutes` is effectively a one-sided tunable, and the `ПРОТИВОРЕЧИВО` bucket that features prominently in the sample output will rarely populate. The window carve-out has to precede Rule 2, not follow it.

**Proposal 2 — the "unmasked ⇒ OUT_OF_STOCK" closure catches grades the source cannot express.** §3.8 says `yes`/`queue` with `fmask > 0` yields `IN_STOCK` for masked grades and `OUT_OF_STOCK` for unmasked ones. `AI95_PREMIUM` is not in the 5-bit vocabulary at all, so it is permanently "unmasked" — meaning the same station simultaneously emits an *inferred* `IN_STOCK` for 95+ (from the 95 bit) and a *direct* `OUT_OF_STOCK` for 95+ (from the closure). Trace it through the table: equal ages so Rule 2 doesn't fire; same source so Rule 3 doesn't fire; no direct `IN_STOCK` so Rules 4–5 don't fire; Rule 6 requires *only* inferred/uncertain evidence and there is a direct OOS, so it doesn't fire ⇒ Rule 7 ⇒ `НЕТ_ДАННЫХ`. The closure must be restricted to grades inside the source's declared vocabulary.

**Proposal 2 — the `conflict` typing bug I flagged last round is unfixed.** `StationObservation.conflict?: boolean` with "gdebenz `conflict: true` demotes confidence one step." If read from `/api/stations` this field is the string enum I measured (`"no"`, `"yes"`, `"queue"`, `"low"`), and `"no"` is truthy — every such station silently demotes. §3.8 never states which endpoint supplies it. Proposal 1 got this right (`conflict: string | null`, "a non-null `conflict` lowers evidence weight"), which is worth crediting.

**Proposal 2 — intra-source duplicates remain unresolved.** The `usr_*` id class is now correctly *labeled* (`stationIdKind: 'user-submitted'`, excluded from the persisted map), which addresses half my round-1 finding. But 37 of 208 rows are `usr_*` user-submitted points that plausibly duplicate real OSM stations *within gdebenz*, and Stage 1 forbids intra-source merging outright. So one forecourt can render as two rows from a single source. Combined with the 58 rows carrying `brand: null` and 16 with no address — which fail Stage 2's condition 3 (brands match **or** street Jaccard ≥ 0.5) and therefore never merge with Yandex either — the report will carry a visible duplicate tail. Their philosophy ("a duplicate row is cosmetic") is right, but the renderer should at least mark suspected duplicates so the user doesn't read two rows as two stations.

**Proposal 2 — the `fmask` self-check is a hair-trigger.** Empirically it is *not* flaky (30/30 agreement today, which was my main worry — a per-run mismatch would have disabled gdebenz grade evidence 100% of the time). But "on **any** mismatch, drop gdebenz to grade-blind registry for that run" means one row containing a token outside `csvNames` (a future `ГАЗ`, say) kills grade evidence city-wide. Make it per-row, or threshold it.

**Proposal 1 — `fresh_band` semantics asserted as fact.** §3.2 presents a table with a "Source meaning" column (band 3 = "less than one hour", band 2 = "within three hours", band 1 = "today") and §19 does **not** list it as an assumption. Nothing I can probe confirms the direction. If the ordering is inverted, proposal 1 treats the freshest reports as expired and the stalest as current — a silent inversion in the safety-relevant direction. Proposal 2 flags this explicitly (assumption 7, open question 2) and proposes self-calibration against Yandex's exact `lastSignalTimestamp` on co-located stations, which is free and correct.

**Proposal 1 — the confidence scale collapses under measured data.** Walk the arithmetic with real values. Yandex fresh `IN_STOCK`, `signalsPerHour = 1`: weight `= 0.85 × 1.0 × 1.0 × (0.60 + 0.15·ln2) = 0.598`. gdebenz band 3 scored at its *maximum* age (60 min), against `fresh 20 / stale 90`: freshness `≈ 0.629`, weight `= 0.70 × 0.629 × 0.85 × 0.75 = 0.281`. `coverage = 1 − (1−0.598)(1−0.281) = 0.711` — below the `0.75` HIGH boundary. So even **perfect two-source agreement** yields MEDIUM unless the Yandex signal rate is high. And the corroborating gdebenz row must be one of the **13 stations city-wide** with explicit `95` in `fuels_now`. The three-label scale is effectively two labels. Not fatal, but the doc's claim that "high confidence normally requires agreement between Yandex and gdebenz" describes a state that is nearly unreachable in the measured data.

**Proposal 1 — dead 2GIS machinery persists.** 2GIS returns 302/CAPTCHA to every unattended request, and proposal 1 explicitly declines a browser fallback. Yet it still specifies 20-page pagination, `concurrency: 2`, a 24-hour catalogue TTL, a 6-hour monitor refresh, a `2gis-catalog.json` cache file, five fixture categories, and — worse — makes boundary-anchor resolution *depend* on it ("Search Yandex, gdebenz, and cached 2GIS catalogue data for named anchors"). Since the cache can never populate, this is machinery that will never execute, and an anchor-resolution path that will never contribute. Proposal 2's V2 deferral is the more honest handling of the same reality.

**Proposal 1 — one round-1 finding still ambiguous.** §8's `UNKNOWN 0.50` contributes zero logit but §9's `coverage = 1 − ∏(1 − effectiveIndependentGroupWeight)` still does not say whether zero-information observations are excluded from coverage. With the new rule "if `fuels_now` lists other grades but not the requested grade, the requested grade remains `UNKNOWN`", such observations are now *systematically generated* — so if they enter coverage, confidence inflates precisely where the data is emptiest.

## Strengths & Benefits (Yellow Hat)

Both revisions absorbed the source-model correction, and that alone makes them far better than round 1: tiling is gone from proposal 1, gdebenz's JSON API is first-class in both, and neither builds a production browser/CAPTCHA subsystem. Proposal 1's `ObservationTime` discriminated union (`EXACT | BOUNDED_AGE | FETCH_TIME_ONLY`) is the cleanest single modeling idea in either document — it makes "we only know this is *at most* 60 minutes old" a first-class type rather than a comment — and its decision to score gdebenz bands at their **maximum** age is exactly the right direction to err. Its `PRESENCE` queue kind, which renders as "queue reported; size unknown" but is *excluded from shortest-queue ordering*, is a precise reading of "where data exists, by the smallest queue." Its correlation-group deduplication and the explicit "advertised products never enter the availability formula" firewall are both correct. And it correctly types gdebenz's `conflict` as a string, which the live data vindicates and proposal 2 gets wrong.

Proposal 2's revision is the more substantial one, and it fixed every finding I raised last round except one. The identity matcher's unreachable-threshold arithmetic is gone, replaced by three plain predicates at 150 m with brand conflict as a hard reject. The linear rank blend that let queue override availability is gone, replaced by a lexicographic comparator that is a near-literal transcription of the requirement with **zero tunable weights** — and `distanceFromCenterM`, which I showed could dominate the whole model, is now demoted to tie-break position five where it is harmless. The `usr_*` id heterogeneity I found is now acknowledged, typed, and excluded from persistence. `GAS` now fails loudly instead of returning a misleading empty result. The chunked `wait` (≤240 s, exit 20 = call again) is the right fix to a hazard it identified itself. Replacing the 15-constant pseudo-Bayesian model with an enumerable decision table is a genuine retreat in the right direction: it converts "test a continuous space by sampling" into "enumerate the entire table," and `«ЕСТЬ, высокая: 2 источника согласны, 6 мин назад»` really is more checkable by a user than `0.86`. Its renderer invariants — no availability claim without an age *and* a confidence word, `≈` on approximate ages, `КОСВЕННО` must state why it is indirect — are enforceable properties, not aspirations. The GET/HEAD method allowlist remains the best safety detail in either document, and it matters concretely: gdebenz exposes POST endpoints for *submitting* driver reports. And the `PARSE_SHAPE_CHANGED` canary with a rotating debug-body dump is the one mechanism here that converts the most likely failure into a one-iteration fix.

I also want to credit the intellectual honesty: proposal 2 opens by naming the reviewer objection, agreeing with it, and deleting its own work. That is the behavior you want at a design gate.

## Alternatives & Creative Ideas (Green Hat)

The strongest artifact remains a graft, and the seams are now narrower than last round. Take proposal 2's chunked-wait lifecycle, error taxonomy, decision table, and lexicographic comparator; take proposal 1's `ObservationTime` union, `PRESENCE` queue kind, and string-typed `conflict`; fix pagination in both.

Concretely:

- **Terminate pagination on `newOids === 0 || businesses === 0`, never on a short page.** Measured: pages 4 and 5 are both short and page 5 yields 24 new. Additionally, record `pagesFetched`, `uniqueOids`, and the per-page `totalResultCount` sequence in diagnostics so the instability is visible rather than trusted; raise `maxPages` to ~10 with an explicit `TRUNCATED` health when the cap binds while new oids are still arriving.
- **Probe `/api/cfg` before committing.** `{"live": false, ...}` is sitting there unread by both designs. If that flag gates live-status semantics, the entire availability interpretation may need a caveat — and it is a one-request check. At minimum, read it at startup and surface it in source health.
- **Make grade-blindness symmetric.** One rule for both signs: a gdebenz status with `fmask == 0` (or empty `fuels_now`) yields `UNCERTAIN` for *specific* grades regardless of whether the status is `yes` or `no`. It can still contribute a station row and a queue signal. This is a two-line change that removes proposal 2's worst false-negative path.
- **Use proposal 1's `BOUNDED_AGE` instead of a point imputation.** Proposal 2 collapses band 3 to exactly 45 minutes, which is exactly `freshMinutes` — so a `≤` vs `<` boundary decision silently determines whether gdebenz can ever produce `ЕСТЬ`. Carrying `[min, max]` and comparing intervals makes "is A newer than B" honestly answerable ("overlapping ⇒ neither is clearly newer"), and it fixes Rule 2/3's sign asymmetry structurally rather than by adding another tunable.
- **Calibrate `fresh_band` for free.** 118 comment rows join cleanly to stations, and Yandex supplies exact `lastSignalTimestamp` on co-located stations. Log (band, Yandex-age) pairs each cycle; after a few sessions both the mapping *and its direction* are empirical. Until then, treat all bands as one low-precision class rather than assuming an ordering — an inverted assumption makes stale data look fresh, the worst possible direction.
- **Reset expectations on gdebenz's role.** Both documents frame it as "2–3× coverage." For the *default* watch target that is misleading: 13 stations carry explicit 95 evidence and **zero** carry 95+. gdebenz is a superb *registry* and gazetteer (which is what makes `resolve-anchors.mjs` work without a geocoder), a decent *corroborator* for plain AI-95 on ~13 stations, and contributes **nothing direct** to premium-95. Say so in `SKILL.md` so the user isn't surprised when nearly every 95+ line reads "только Яндекс".
- **A `--explain <station>` mode.** Proposal 2 already retains `evidence[]` in every snapshot; exposing it per-station answers the second question every user asks ("why isn't X listed?") for nearly free.

## Completeness & Process (Blue Hat)

Both documents cover the twelve required topics. The process difference is stark and worth stating plainly: proposal 2 re-derived its own claims, corrected its own station count against a reviewer's wider bbox, found and fixed a robustness hole nobody flagged (the 15-minute block), and self-reported a correction to its own identity claim (`usr_*` ids). Proposal 1 absorbed the source-model correction but left its single critical finding — the monitoring lifecycle — textually unchanged, including the citation that was the object of the objection. A revision that does not engage with the blocking finding has not converged.

Remaining gaps in **both**: neither models the fact that Yandex `fuelAvailability` and gdebenz reports are *both* crowd-sourced from overlapping driver populations, so "two sources agree" is weaker corroboration than either's independence assumption implies (proposal 1 has the machinery — `correlationGroup` — but assigns them separate groups; proposal 2's confidence table counts "independent sources" without defining independence). Neither specifies a concrete `robots.txt` fetch/parse. Neither reads `/api/cfg`. Neither states a validation plan for whether the skill's verdicts are *right* — a week of spot-checks against a handful of stations would be the only real evidence, and its absence means the confidence labels remain unvalidated in both designs, discrete or continuous.

Gaps specific to **proposal 1**: the monitoring section must be rewritten around a verified primitive; `fresh_band` must move from "Source meaning" to §19's assumption list with a calibration plan; the `UNKNOWN`-in-coverage question must be answered explicitly; the 2GIS catalogue path should be reduced to a config stub with anchor resolution depending only on gdebenz and Yandex.

Gaps specific to **proposal 2**: `conflict`'s source endpoint and type must be pinned; the "unmasked ⇒ OUT_OF_STOCK" closure must be scoped to in-vocabulary grades; Rule 2/3 ordering must be fixed; state still lives inside the skill directory (a reinstall wipes the identity map — proposal 1's external state dir is better); the renderer is Russian-only with no config key; and the default bbox `48.4696–48.9435 / 44.2266–44.8073` includes Volzhsky and Krasnoslobodsk, which are not Volgograd — defensible as a superset, but say so in `SKILL.md`.

Neither is implementation-ready as written. Proposal 2's defects are all bounded edits to a sound skeleton; proposal 1's include an unaddressed architectural contradiction in one of the two required user-facing modes.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "proposal-2",
      "approval_score": 7,
      "would_adopt": true,
      "summary": "This revision fixed every round-1 finding I raised except one, and fixed a hazard nobody flagged. The unreachable identity threshold is gone (three plain predicates at 150 m with brand conflict as a hard reject), the linear rank blend that let queue override availability is replaced by a zero-weight lexicographic comparator that transcribes the requirement literally, the distance penalty is demoted to a harmless tie-break, usr_* id heterogeneity is acknowledged and excluded from persistence, GAS now fails loudly, and the chunked wait removes the tool-timeout risk. Replacing the unfalsifiable float with an enumerable decision table is the right retreat. I still broke it in four places: the short-page pagination stop loses 38 of 130 stations (29% of the city) because pages 4 and 5 are both short yet page 5 yields 24 new oids; gdebenz grade-blind 'no' maps to OUT_OF_STOCK while grade-blind 'yes' correctly maps to UNCERTAIN, an asymmetry that lets a community 'нет' fire Rule 2 and suppress a station Yandex reports as having 95+; Rule 2 preempting Rule 3 with no margin makes ПРОТИВОРЕЧИВО reachable only when the positive side is newer, so identical evidence gaps flip verdict on sign; and the 'unmasked implies OUT_OF_STOCK' closure catches AI95_PREMIUM, which the source cannot express. All four are bounded edits to a sound skeleton. Adopt with these changes.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "major",
          "area": "yandex pagination termination",
          "description": "Verified by walking pages 1-7 on 2026-08-30: businesses per page are 25/25/25/24/24/14/0 and cumulative unique oids are 25/47/70/92/116/130/130. The rule in 3.8 - 'stop on zero new oids or a short page' - fires the short-page condition at page 4 (24 < pageSize 25) and stops, collecting 92 of 130 stations and silently losing the 38 on pages 5-6. The refusal to trust totalResultCount is correct (it reads 51/100/132/99 across pages), but the replacement termination condition is wrong.",
          "required_change": "Terminate only on zero businesses or zero new oids, bounded by maxPages; raise maxPages to about 10 and emit a TRUNCATED diagnostic when the cap binds while new oids are still arriving. Record pagesFetched, uniqueOids, and the per-page totalResultCount sequence in diagnostics."
        },
        {
          "id": "",
          "severity": "major",
          "area": "gdebenz status semantics / false negatives",
          "description": "Section 3.8 rightly insists that 'yes' with fmask == 0 yields UNCERTAIN because a grade-blind positive says nothing about a specific grade, then maps 'no' to OUT_OF_STOCK for watched grades with no equivalent qualification. Measured: 66 of 208 rows carry status 'no', and only 31 of 208 carry any fuel list at all, so most negatives are equally grade-blind. Fed into Rule 2 ('a non-stale OUT_OF_STOCK newer than every non-stale IN_STOCK yields НЕТ', first match wins), a grade-blind community 'нет' suppresses a station that Yandex reports as having 95+, emitting verdict НЕТ with no conflict marker - exactly the class of actionable wrong answer the proposal is otherwise designed to prevent.",
          "required_change": "Apply grade-blindness symmetrically: a gdebenz status with fmask == 0 / empty fuels_now yields UNCERTAIN for specific grades regardless of sign. It may still contribute a station row and queue signal, but must not be eligible to fire Rule 2."
        },
        {
          "id": "",
          "severity": "major",
          "area": "verdict decision table ordering",
          "description": "Rule 2 fires whenever the OUT_OF_STOCK observation is newer at all, with no margin, and precedes Rule 3 under first-match-wins. Rule 3 ('neither clearly newer, within conflictWindowMinutes 30') is therefore reachable only when the IN_STOCK side is the newer one. Concretely: Yandex IN_STOCK at 40 min plus gdebenz 'no' at imputed 45 min yields ПРОТИВОРЕЧИВО, while Yandex IN_STOCK at 50 min plus gdebenz 'no' at 45 min yields НЕТ. A five-minute sign flip changes the verdict entirely, conflictWindowMinutes becomes a one-sided tunable, and the ПРОТИВОРЕЧИВО bucket featured in the sample output will rarely populate.",
          "required_change": "Move the conflict-window check ahead of Rule 2 so it applies symmetrically. Better: adopt proposal 1's BOUNDED_AGE interval model instead of collapsing each band to a single minute value, and define 'clearly newer' as non-overlapping intervals - this removes the asymmetry structurally rather than adding a tunable."
        },
        {
          "id": "",
          "severity": "major",
          "area": "grade vocabulary closure",
          "description": "Section 3.8's rule 'yes/queue with fmask > 0 gives IN_STOCK for masked grades, OUT_OF_STOCK for unmasked ones' catches AI95_PREMIUM, which is not in the five-bit vocabulary at all and so is permanently unmasked. The same station therefore emits an inferred IN_STOCK for 95+ (from the 95 bit) and a direct OUT_OF_STOCK for 95+ (from the closure). Tracing the table: Rule 2 no (equal ages), Rule 3 no (same source), Rules 4-5 no (no direct IN_STOCK), Rule 6 no (a direct OOS exists), so Rule 7 gives НЕТ_ДАННЫХ for every gdebenz station carrying a fuel list.",
          "required_change": "Scope the 'unmasked implies OUT_OF_STOCK' closure to grades inside the source's declared vocabulary; grades a source cannot express must yield no direct observation at all."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "gdebenz field typing",
          "description": "Round-1 finding unfixed. StationObservation types conflict as boolean and 3.3 says 'gdebenz conflict: true demotes confidence one step', but the endpoint is not specified. Measured: /api/stations.conflict is a string enum taking null | 'no' | 'yes' | 'queue' | 'low' (it carries the conflicting report's status, not a flag), while /api/comments.conflict is boolean true | null. Reading the former with a truthiness test silently demotes every station whose conflict value is the string 'no'. Proposal 1 types this correctly as string | null.",
          "required_change": "Pin which endpoint supplies conflict, type it per endpoint (string enum for /api/stations, boolean for /api/comments), and add a fixture test covering the string 'no' case."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "identity / duplicates",
          "description": "The usr_* class is now correctly labeled and excluded from the persisted map, but 37 of 208 rows are user-submitted points that plausibly duplicate real OSM stations within gdebenz, and Stage 1 forbids intra-source merging outright, so one forecourt can render as two rows from a single source. Separately, 58 rows carry brand: null and 16 carry no address, and Stage 2 condition 3 requires either a brand match or street-token Jaccard >= 0.5, so those rows can never merge with Yandex either.",
          "required_change": "Permit a narrow intra-source exception for usr_* rows against OSM rows under the same 150 m + brand-conflict rules, and have the renderer flag suspected duplicates so two rows are not read as two stations."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "fmask self-check trigger",
          "description": "The per-run cross-validation is empirically sound - I measured 30/30 exact agreement between decoded fmask and fuels_now on every informative row, so my concern about a false-positive demotion every run is not realized today. But 'on any mismatch, drop gdebenz to grade-blind registry for that run' is a hair-trigger: one row containing a token outside csvNames (a future ГАЗ, say) disables grade evidence city-wide.",
          "required_change": "Make the check per-row (discard grade claims for the mismatching row) and demote the whole source only above a mismatch-rate threshold; log the validated sample size, since only about 30 of 118 rows are informative enough to validate."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "unread feature flag / expectation setting",
          "description": "GET /api/cfg returns {\"live\": false, ...} - a feature flag neither proposal reads, which may gate the live-status semantics the whole design rests on. Separately, the '2-3x coverage' framing overstates gdebenz's contribution to the default watch target: only 13 of 208 stations carry explicit 95 evidence and zero carry any premium-95 concept, so gdebenz contributes no direct evidence to AI95_PREMIUM at all.",
          "required_change": "Read /api/cfg at startup and surface it in source health; state in SKILL.md that gdebenz is primarily a registry/gazetteer plus a plain-AI-95 corroborator, and that premium-95 verdicts are single-source by construction."
        }
      ],
      "assumptions": [
        "I re-verified all source behaviour by read-only GET this session rather than asking; measurements above are from 2026-08-30.",
        "I assumed 'stop on a short page' means a page returning fewer than pageSize items, which is what makes the page-4 truncation fire.",
        "I assumed conflict would be read from /api/stations unless the design says otherwise, since that is where the station rows come from.",
        "I treated the /api/cfg 'live: false' flag as an unresolved unknown rather than assuming a specific meaning.",
        "I judged confidence-before-queue in the lexicographic comparator as acceptable, reading confidence as part of 'the probability that suitable fuel is actually available' rather than as a criterion inserted between the two stated ones."
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
