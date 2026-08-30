## Facts & Constraints (White Hat)

Before judging either design I re-ran the empirical checks both proposals depend on, because the entire architecture question here turns on which of the three sources actually works — and the two proposals disagree about that, not about aesthetics. The verification (read-only GETs, 2026‑08‑30) produced this:

| Check | Result |
|---|---|
| `yandex.ru/maps/38/volgograd/search/азс/` via plain curl + UA | **200, 676 KB**, exactly one `<script class="state-view">`, **25** `type:"business"` nodes, **25/25** carrying `fuelAvailability`, **25/25** with `oid=` in `uri` |
| Yandex per-grade vocabulary | `AI92, AI95, AI95_PREMIUM, AI98, AI100, DIESEL` — plus `signalsCountPerHour`, `lastSignalTimestamp` (unix **seconds**), `queueStatus`, `localizedQueueSize`, `localizedFuelLimit`, `cashOnly` |
| First sampled station | station-level `status:"IN_STOCK"` while `AI95:OUT_OF_STOCK`, `AI95_PREMIUM:IN_STOCK` |
| `gdebenz.ru/api/stations?lat1..lon2` (Volgograd bbox) | **200**, **208 stations**, JSON, with `osm_id,name,brand,addr,lat,lon,status,fuels_now,dt_only,conflict,prices_now` |
| `gdebenz.ru/api/comments?<same bbox>` | **200**, **116 rows**, `{osm_id,lat,lon,status,fmask,fresh_band,conflict}` |
| `fmask` distribution | `0:87, 1:5, 3:1, 16:6, 17:3, 19:11, 27:3` — bit order `[92,95,98,100,ДТ]` consistent |
| `fresh_band` distribution | `1:8, 2:52, 3:56` |
| gdebenz `status` distribution (stations) | `null:83, no:67, yes:33, queue:25` |

So proposal‑2's central empirical claims are **true**, and proposal‑1's inherited premises (gdebenz = 502/optional-degraded, 2GIS = the discovery/identity source, Yandex = needs tiling) are **materially wrong**. That is not a stylistic difference; it reallocates most of the engineering budget.

But my probe also turned up four facts *neither* proposal has, and three of them cut against proposal‑2's own claims:

1. **`osm_id` is not uniformly an OSM id.** Of 208 rows, **37 are `usr_*`** (user-submitted pseudo-stations, e.g. `usr_m5K5ULWxY7Y`) and **13 are `w*`** (OSM ways) alongside bare numeric node ids. Proposal‑2 makes `osm:<id>` the *primary* `stationKey` and calls it "stable identity"; a `usr_*` row is a user-created duplicate of a real station with a different coordinate, so the spine will silently emit two rows for one forecourt — and the deduper (§3.7) is cross-*source* only, while §3.7 Stage 1 explicitly says "**never** fuzzy-merge inside one source."
2. **`fmask == 0` for 87/116 rows (75%).** gdebenz per-grade evidence exists for only ~25% of reported stations. Proposal‑2's self-healing "cross-validate decoded `fmask` against `fuels_now` CSV on every run" is therefore near-vacuous on most rows: the `status:"yes"` sample I pulled has `fuels_now:""` **and** `fmask:0`, so the check passes trivially. A silent bit rotation would be caught only by the ~29 rows that carry both.
3. **`conflict` has inconsistent types across the two endpoints**: `"yes"/"no"` (strings) in `/api/stations`, `true`/`null` (boolean) in `/api/comments`. Proposal‑2 types it `conflict?: boolean`. A truthiness bug here silently marks every station conflicted (`"no"` is truthy).
4. **`fresh_band` band 1 is present** (8 rows), contradicting proposal‑2's sample note, and its *direction* remains unverified. And the Yandex HTML contains the literal string `captcha` even on a perfectly good 200/676 KB page — any naive "body contains captcha ⇒ BLOCKED" detector false-positives on the healthy path.

Feasibility-wise both are buildable on Node 20+ stdlib with no npm deps; nothing in either design requires a capability that doesn't exist. The one genuinely uncertain platform constraint — shared by both — is whether the host will tolerate a long blocking tool call, discussed below.

## Risks & Failure Modes (Black Hat)

**Proposal 1.**

*The monitoring lifecycle is the load-bearing weakness and it is internally contradictory.* §8 says "Launch **one foreground child process** running `monitor --ndjson`" and "Codex consumes each NDJSON snapshot and publishes it as a commentary update" — but a foreground child that emits a line every 15 minutes means the agent is parked inside a single tool call; in a request/response exec model there is no path for the agent to publish line *n* while the call is still open. Two steps later §8.6 says "between ticks, use bounded waits of at most 60 seconds," which is the *opposite* architecture (agent polls, process doesn't persist). Both cannot be true. The load-bearing citation is a `learn.chatgpt.com` page about ChatGPT `/goal`, which is not evidence that a Codex CLI skill has a durable-goal primitive. Proposal‑2's `watch.mjs wait` → exit code → agent loops is the correct and testable primitive; proposal‑1 asserts a mechanism it did not verify.

*The tiling plan is arithmetically infeasible against its own deadline.* §6 queries "overlapping rectangular tiles covering the area's bounding box" at a default **5 km tile span with 10% overlap**, under a **120 s cycle deadline** with a **10 s per-request timeout**. Volgograd's bbox is ~43 km × 52 km ⇒ roughly **90–100 tiles**, times pagination. That cannot fit in 120 s, and at 15-minute cadence it is ~400 requests/hour to Yandex — the single most likely way to convert "Yandex answers curl today" into "Yandex challenges us tomorrow." My probe shows one query returns 25/page with working pagination, and gdebenz hands over 208 stations in **one** request. The tiling machinery is both unaffordable and unnecessary.

*UNKNOWN observations inflate confidence.* Status likelihood for `UNKNOWN` is 0.50 ⇒ `logit = 0` ⇒ zero contribution to availability — correct. But that observation still carries a non-zero `effectiveGroupWeight`, and confidence is `coverage = 1 − ∏(1 − effectiveGroupWeight)`. So a station about which a source explicitly knows *nothing* gets **higher confidence** than one with no observation at all, while the probability stays pinned at the prior. The renderer will print "50% — medium confidence," which is precisely the "confident-sounding nothing" the task's confidence requirement exists to prevent.

*The 2GIS investment is unjustified.* Proposal 1 specifies a browser port, session naming, extraction profiles, `CHALLENGE` codes, a capability declaration, and fixture tests for a source it itself declares `availability: false`. My probe confirms 2GIS is 403 to curl and CAPTCHAs browsers; it publishes no live fuel feed. That is a full subsystem, built against a hostile ToS, for zero verdict impact — and it exists only because the brief's stale snapshot said gdebenz was dead and something had to fill the identity role.

*Smaller ones:* exit code 3 "emits a health-bearing snapshot" but a non-zero exit will break the obvious `collect && report` chaining; `matchConfidence` clustering with complete-link but **no persisted cross-run key** means station identity is only stable "in the monitoring process's runtime registry" — restart the task and the change-diff ("newly available / no longer supported") silently resets.

**Proposal 2.**

*The identity matcher's threshold is arithmetically unreachable for most real pairs.* `matchScore = 0.60·geoScore + 0.25·brandScore + 0.15·addrScore`, `geoScore = max(0, 1 − d/120)`, accept at `≥ 0.72`. Solve it:

- perfect brand **and** perfect address ⇒ fixed 0.40 ⇒ needs `geoScore ≥ 0.533` ⇒ **d ≤ 56 m**
- alias brand + perfect address ⇒ 0.35 ⇒ **d ≤ 46 m**
- **no brand** (58 of 208 gdebenz rows have `brand: null`; 21 have no name, 16 no address) — and the spec only defines `brandScore` for *exact*, *alias*, and *conflicting*, leaving null **unspecified**; if null scores 0 then merging needs `geoScore ≥ 0.95` ⇒ **d ≤ 6 m**, i.e. never.

The advertised "hard reject beyond 250 m" is dead code — the real binding cutoff is ~56 m. Yandex vs OSM forecourt coordinates routinely differ by 30–80 m (one points at the shop, the other at the pump island). This design will systematically fail to merge Yandex and gdebenz for the same station, which destroys the corroboration story that its own confidence formula depends on: every station degrades to single-source, `conf = 1 − 1/(1+w)` stays low, and the report reads "уверенность 0.44" city-wide. Proposal 2 says "an unmerged duplicate is cosmetic" — it is not cosmetic when the confidence metric is defined as agreement.

*The ranking formula contradicts the stated requirement.* The task says rank "by the probability that suitable fuel is actually available and, **where data exists**, by the smallest queue" — probability primary, queue as a secondary/tiebreak. Proposal 2 uses a linear blend: `rank = 0.75·(p·(0.5+0.5·conf)) + 0.25·queueScore − 0.01·distanceKm`. Counterexample with its own constants: station A `p=0.76, conf=0.5`, queue HIGH ⇒ `0.75·0.57 + 0.25·0.2 = 0.4775`. Station B `p=0.60, conf=0.5`, queue NONE ⇒ `0.75·0.45 + 0.25·1.0 = 0.5875`. **B outranks A despite 16 points less availability**, purely on queue. Queue is not a tiebreak here, it is a co-equal criterion worth up to 0.25 — roughly the entire useful spread of the availability term. Proposal 1's banded lexicographic order (5‑pp availability band → queue → exact probability) is the correct reading of the requirement, and it is the one thing proposal 1 clearly does better.

*The distance penalty is an undeclared criterion that dominates.* `distancePenaltyPerKm 0.01` × distance-from-bbox-center. Volgograd is ~60 km end to end; a Krasnoarmeysky station sits ~25 km from center ⇒ **−0.25**, larger than the entire queue term and comparable to the whole availability term. Nothing in the task asks for proximity ranking, and it silently makes the default whole-city bbox behave as "central stations only." Worse, it interacts with the anchor mode: if the user names the outermost acceptable stations, the hull's centroid becomes the reference and the outermost — i.e. explicitly *acceptable* — stations get maximally penalised.

*gdebenz evidence is thinner than modeled.* With `fmask:0` on 75% of reported rows, and `status:null` on 83/208 stations, the "corroborating availability voter" contributes grade-level evidence for a small minority. Assumption 8 (`fmask==0 ⇒ UNCERTAIN`) is the right call, but combined with `statusPrior.UNCERTAIN = 0.50` and `sourceWeight 0.8` it means gdebenz mostly injects weight that *raises confidence* while carrying no grade information — the same defect as proposal 1's UNKNOWN handling, arriving by a different route.

*`statusPrior.UNKNOWN = 0.35` is unjustified.* "We don't know" is being encoded as mild evidence of absence. There's no basis for that asymmetry and it will push genuinely-unknown stations below the `unlikely` line, where the renderer implies negative knowledge the data doesn't support — exactly the failure the task's "don't just say fuel is present/absent" requirement targets.

*The 15-minute blocking `wait` may exceed the host's tool-call timeout.* This is a shared risk but proposal 2 leans on it harder (it is the only lifecycle primitive). Stderr heartbeats do not reset every harness's timer.

*Scope deviation:* 2GIS ships `enabled:false`. The reasoning is sound and I agree with it on the merits, but the task explicitly lists 2GIS as a requested source; that is a scope reduction requiring the user's assent, not a silent default.

*Minor:* `canonical` includes `GAS` with no entry in either source map ⇒ requesting LPG returns permanent `unknown` with no diagnostic; Russian-only output is hardcoded in `render.mjs` with no config key; `state/` lives inside the skill directory, so a reinstall wipes the identity map and snapshot history.

## Strengths & Benefits (Yellow Hat)

Proposal 2's decisive advantage is that it **did the work**: every claim I could check held up, and the gdebenz `/api/stations` + `/api/comments` discovery inverts the brief's assumed source roles in a way that removes an entire browser subsystem, replaces HTML scraping with JSON, and roughly triples station coverage. Deriving the `fmask` bit order from the minified bundle and cross-validating it against `fuels_now` is real reverse-engineering, and putting that table **in config rather than code** with a runtime consistency check is the right instinct even if the check is weaker than advertised. The `EMPTY_RESULT` vs `PARSE_SHAPE_CHANGED` distinction with a rotating debug-body dump is the single best operational detail in either document — it converts the most likely failure (upstream refactor) from a mystery into a one-iteration fix. The shape-agnostic recursive walk for `state-view` is validated by my own probe (I used exactly that technique and got 25/25). `resolve-anchors.mjs` being read-only by default, and using the gdebenz registry as a local gazetteer instead of a geocoding service, is elegant. The GET/HEAD-only allowlist in `http.mjs` — motivated by gdebenz having *write* endpoints for driver reports — is a concrete, enforceable safety property rather than a paragraph of good intentions. And the 95 vs 95+ asymmetry (with the observed `95:OUT_OF_STOCK / 95+:IN_STOCK` station as the motivating case, which I reproduced) is exactly the failure that would otherwise make this skill actively harmful.

Proposal 1 is not without real strengths, and two of them are things proposal 2 lacks. Its **banded lexicographic ranking** correctly implements the stated requirement where proposal 2's linear blend does not. Its **`correlationGroup`** concept — only the strongest contribution per group counts, single group caps confidence at 0.74 — is the right formal apparatus for the fact that both proposals otherwise miss: Yandex `fuelAvailability` and gdebenz reports are *both* driver-crowdsourced, so "two sources agree" is weaker corroboration than independent-evidence math implies. Its **fail-closed area** (refusing to ship an invented Volgograd boundary until the user configures one) is arguably the more faithful reading of "user-configured area," though proposal 2's provenance-backed default is defensible. Its testing section is more complete (fake-clock freshness boundaries, drift-free cadence, "slow cycle must not create concurrent cycles," complete-NDJSON-under-cancellation), and its explicit `SCHEMA_CHANGED ≠ empty` test assertion is stated as a *test requirement*, not just a behaviour.

## Alternatives & Creative Ideas (Green Hat)

The strongest artifact here is not either proposal — it's the union. Take proposal 2's verified source model, adapter contract, error taxonomy, and monitoring primitive; graft in proposal 1's banded lexicographic ranking and correlation-group weighting; drop the distance penalty entirely.

Concrete alternatives worth considering:

- **Two-tier identity, not one spine.** Rather than `osm:<id>` primary, use a synthetic `stationKey` (proposal 1's approach) with `osm_id` and Yandex `oid` as *attributes*. This fixes the `usr_*` duplicate problem — a `usr_*` row and the real OSM row for the same forecourt can then merge — and lets the persisted crosswalk carry hand corrections for both namespaces. Raise the merge threshold's geo term to something like `geoScore = max(0, 1 − d/300)` with the hard reject at 250 m actually binding, and treat *null* brand as `0.5` (unknown) rather than `0` (conflict), keeping "conflicting brand ⇒ hard reject" as a separate boolean gate rather than a score of zero. That preserves proposal 2's correct instinct (false merges are worse than duplicates) without making merging arithmetically impossible.
- **Calibrate `fresh_band` for free, and don't guess direction.** Both endpoints are keyed by `osm_id`, and Yandex gives exact `lastSignalTimestamp` on co-located stations. Log the (band, Yandex-age) pairs every cycle; after a few sessions the mapping is empirical. Until then, treat all three bands as one low-precision class rather than assuming `3 = freshest` — an inverted assumption makes stale data look fresh, which is the worst possible direction for this error.
- **Make the fmask self-check honest.** It can only validate on rows where `fmask > 0` **and** `fuels_now ≠ ""` (~29 of 116 today). Report the sample size in diagnostics; if it drops below a floor, downgrade gdebenz grade evidence rather than reporting a green check on zero rows.
- **Reconsider what "queue" earns.** `status:"queue"` in gdebenz appeared 25 times and Yandex gives four ordinal levels — enough signal to be a genuine tiebreak, not enough to justify overriding availability. Banded ranking gets this right for free.
- **A "why isn't station X listed?" mode.** Both designs rank; neither lets the user interrogate an *absence*, which is the second question every user asks. A `--explain <station>` flag dumping the `evidence[]` array (which proposal 2 already retains) is nearly free and turns the confidence number from a claim into an audit trail.
- **`wait --max-block-seconds N`.** Have the blocking wait return a distinct "not yet due" exit code when it hits the cap, so the agent re-polls. This makes the loop robust to whatever the host's tool-call timeout turns out to be, without changing the architecture.

## Completeness & Process (Blue Hat)

Both documents cover the twelve topics the task enumerated. Gaps worth naming:

**Shared.** Neither models the *correlation* between Yandex and gdebenz as crowd-sourced driver reports from overlapping populations — proposal 1 has the machinery (`correlationGroup`) but assigns them to different groups, and proposal 2 has none. Neither specifies a `robots.txt` fetch/parse concretely (proposal 2 says "checked and logged," which is a promise, not a spec). Neither addresses conditional requests / ETag to cut load, nor what happens when a user requests a grade no source can express (`GAS`). Neither pins the host tool-call timeout question. Neither commits to a "how would we know this skill is lying" validation plan — e.g. spot-checking a handful of stations by phone or by driver report over a week — which matters because the whole output is probabilities with no ground truth.

**Proposal 1 specifically.** The monitoring section must be rewritten around a verified primitive, not a ChatGPT `/goal` citation, and its two contradictory descriptions reconciled. The tile defaults need to be replaced with pagination against measured page sizes. The confidence formula needs `UNKNOWN` observations excluded from `coverage`. The 2GIS subsystem should be reduced to a config stub. And crucially, §15's "assumptions" list treats the brief's 2026‑08‑30 snapshot as settled fact without a single verification — for a design whose entire risk profile is "unofficial sources drift," not probing them is a process failure, and it produced three wrong premises.

**Proposal 2 specifically.** The identity thresholds need re-derivation with a worked table of (distance, brand, address) → accept/reject, because as written they are unreachable. The ranking formula needs to become lexicographic-banded to match the requirement, and the distance penalty needs to be removed or made an opt-in filter. The `conflict` field's dual typing, the `usr_*` id namespace, the `brandScore` null case, and the fmask coverage rate all need explicit handling. The 2GIS `enabled:false` decision should be surfaced as an explicit approval item rather than a default. Its §6 open-questions list is otherwise the better artifact of the two: every question has a committed default, which is what a design gate needs.

Neither is ready to implement as written. Proposal 2 is closer by a wide margin — its defects are threshold arithmetic and one formula, mostly config-level; proposal 1's are architectural (wrong source model, unverified lifecycle mechanism, infeasible fetch plan).

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "proposal-1",
      "approval_score": 5,
      "would_adopt": false,
      "summary": "A rigorous, well-organized design whose scoring semantics (banded lexicographic ranking, correlation-group weighting, confidence separated from probability, fail-closed area) are in places better than proposal 2's — but it is built entirely on the brief's stale source snapshot without a single verification, and I confirmed by live probe that all three of its load-bearing premises are wrong: gdebenz serves a clean JSON API with 208 stations (not a 502 HTML scrape), 2GIS provides no availability at all (so its whole browser/CAPTCHA subsystem buys nothing), and Yandex answers plain curl with full pagination (so ~90-tile coverage is unnecessary and, at a 120 s deadline with 10 s timeouts, arithmetically infeasible). Its monitoring lifecycle contradicts itself — 'one foreground child process streaming NDJSON' versus 'bounded waits of at most 60 seconds' — and rests on a ChatGPT /goal documentation link that is not evidence of a Codex CLI durable-goal primitive. Adopt its ranking and correlation-group ideas; do not adopt its source model or lifecycle.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "critical",
          "area": "source model",
          "description": "Design treats gdebenz as an optional degraded HTML source (502) and 2GIS as the discovery/identity backbone. Live probe on 2026-08-30: gdebenz /api/stations returns 200 with 208 JSON stations (osm_id, brand, addr, status, fuels_now, prices_now) and /api/comments returns 116 rows with fmask/fresh_band/conflict; 2GIS is 403 to curl, CAPTCHAs browsers, and publishes no live fuel feed. Effort is allocated to a zero-value browser subsystem while the richest registry is ignored.",
          "required_change": "Re-verify all three sources and rebuild the source model: gdebenz JSON API as registry + corroborating availability voter, Yandex as availability authority via plain HTTPS, 2GIS reduced to a disabled config stub with no browser port work."
        },
        {
          "id": "",
          "severity": "critical",
          "area": "monitoring lifecycle",
          "description": "Section 8 specifies both 'launch one foreground child process running monitor --ndjson' with Codex publishing each NDJSON line, and 'between ticks use bounded waits of at most 60 seconds'. These are mutually exclusive architectures. A blocking foreground child gives the agent no way to publish line n mid-call. The durable-goal mechanism is asserted via a learn.chatgpt.com /goal link, which does not establish that a Codex CLI skill has that primitive.",
          "required_change": "Pick and specify one verified primitive: a non-spawning blocking wait command that exits with a status code so the agent itself loops and publishes. Remove the unverified durable-goal dependency or demonstrate it exists in the target host."
        },
        {
          "id": "",
          "severity": "major",
          "area": "collection plan / rate limiting",
          "description": "Default 5 km tiles with 10% overlap over Volgograd's bbox (~43x52 km) yields roughly 90-100 tiles times pagination, under a stated 120 s cycle deadline with 10 s per-request timeouts. Infeasible, and at 15-minute cadence it is ~400 Yandex requests/hour, the fastest route to being challenged. Measured reality: 25 businesses per page with working pagination; gdebenz returns 208 stations in one request.",
          "required_change": "Replace tiling with measured pagination (stop on short page or zero new oids, cap pages), and re-derive the cycle deadline from actual per-source request counts."
        },
        {
          "id": "",
          "severity": "major",
          "area": "confidence model",
          "description": "UNKNOWN observations have statusLikelihood 0.50 (zero logit contribution) but still carry effectiveGroupWeight into coverage = 1 - prod(1 - w). A source explicitly reporting 'no information' therefore raises confidence while probability stays at the prior, producing '50% - medium confidence' output that asserts knowledge the data does not contain.",
          "required_change": "Exclude UNKNOWN (and any zero-information status) from the coverage term; confidence must be driven only by observations that move the probability."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "identity persistence",
          "description": "Station keys are stable only within 'the monitoring process's runtime station registry'. There is no persisted cross-run crosswalk, so restarting a task resets the change-diff ('newly available' / 'no longer supported') and produces spurious change reports.",
          "required_change": "Persist the station crosswalk to the state directory with hand-editable overrides, keyed on durable source ids."
        }
      ],
      "assumptions": [
        "I verified sources by read-only HTTP GET rather than asking; results above are from 2026-08-30 and are treated as ground truth over the brief's snapshot.",
        "I assumed the target host is Codex CLI skill execution, where tool calls are request/response and long blocking calls may hit a timeout.",
        "I assumed 'rank by probability, and where data exists by smallest queue' means probability is primary and queue is a secondary/tiebreak criterion."
      ],
      "round": 1,
      "reviewer": "opus1mhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 5
would_adopt: false
