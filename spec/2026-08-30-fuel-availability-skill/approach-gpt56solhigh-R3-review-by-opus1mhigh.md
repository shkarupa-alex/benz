## Facts & Constraints (White Hat)

Both documents now stake substantial design decisions on empirical claims, so I re-verified the load-bearing ones rather than carrying my round-2 measurements forward — and one of this round's *new* claims turns out to be false, which changes the shape of the 2GIS argument for both proposals.

**Yandex pagination — reproduced exactly, on a fresh fetch:**

| page | businesses | new oids | cumulative |
|---:|---:|---:|---:|
| 1 | 25 | 25 | 25 |
| 2 | 25 | 22 | 47 |
| 3 | 25 | 23 | 70 |
| 4 | **24** | 22 | 92 |
| 5 | **24** | **24** | 116 |
| 6 | 14 | 14 | 130 |
| 7 | 0 | 0 | 130 |

The true answer is 130 stations. **Pages 4 and 5 are both short (24 < 25), and page 5 still contributes 24 brand-new oids.** This is the second independent reproduction of the pattern.

I also searched the `state-view` payload for pagination metadata, because proposal 1's new rule says "prefer an advertised last page or next-page link." There is none: the only page-adjacent keys are `page=1`, `pageMode=search`, `searchResultsCount=25` (a per-page count), plus advertising-slot `maxCount` noise, alongside the unstable `totalResultCount`. **No advertised last page and no next-page link exist**, so proposal 1's preferred branch is unreachable and its sequential fallback governs — which is the correct rule. That resolves my round-2 critical against proposal 1's pagination.

**2GIS — proposal 2's new verification is partly wrong.** With a normal desktop UA:

- `https://2gis.ru/volgograd` → **302 to `/museum?return_url=…`** ✓ (confirmed, as proposal 2 states)
- `https://catalog.api.2gis.com/3.0/items?...&key=test` → **HTTP 200** carrying `{"meta":{"api_version":"3.0.21263","code":403,"error":{"message":"Authorization error, incorrect key.","type":"forbidden"}}}` ✓ (confirmed — the official Places API is live and key-gated)
- `https://2gis.ru/robots.txt` → **HTTP 200, 1193 bytes** ✗ — **not 403.**

And its contents matter. Under `User-agent: *`, 2GIS disallows `/_/*`, `/maps_action`, `*/my*`, `*/user*`, `*/geolocation*`, `*?refHash*`, `/geo/70030076128110973`, and several query parameters. It **does not disallow `/volgograd/search/…`**. (`GoogleOther` is separately blocked entirely; `Yandex` gets one narrow rule.) So robots policy is served, is readable, and *permits* the path proposal 1 wants to scrape.

**gdebenz — carried from round 2, still the binding constraint on evidence volume:** 208 stations / 118 comment rows, clean 118/118 join on `osm_id`; `status` = `null:81, no:66, yes:37, queue:24`; **non-empty `fuels_now` on only 31 of 208 (15%)**; **13 stations with explicit AI-95 evidence, zero with any premium-95 concept**; `fmask` ↔ `fuels_now` agreement 30/30; `/api/stations.conflict` is a **string enum** (`null | "no" | "yes" | "queue" | "low"`) while `/api/comments.conflict` is boolean; `GET /api/cfg` returns `{"live": false, …}`, still unread by both designs.

## Risks & Failure Modes (Black Hat)

**Proposal 1 — the monitoring lifecycle is unchanged for a third consecutive round.** §12 still reads: step 4 "Launch one foreground `monitor --ndjson` child process"; step 9 "Use waits no longer than 60 seconds so user steering remains responsive"; step 10 "Publish each snapshot as a complete commentary update"; step 11 "abort current requests; send `SIGINT`". These remain mutually exclusive — if the agent is blocked inside a foreground exec it cannot wait on 60-second intervals, cannot publish snapshot *n* mid-call, and has no turn in which to send a signal. The justification is *still* the `learn.chatgpt.com` `/goal` link, which is not evidence that a Codex skill has a durable-goal primitive. The new additions (a host-capability check, `MONITORING_HOST_UNSUPPORTED`, exit code 5) are genuine improvements to *failure* handling, but they gate an unimplementable happy path: the design now specifies how to decline monitoring cleanly without specifying how to perform it. Monitoring is one of the two required user-facing modes, and it has been flagged twice with a concrete alternative (a bounded, non-spawning wait returning an exit code so the agent loops) that proposal 2 implemented in round 2. A third non-response is a convergence failure, not a disagreement.

**Proposal 2 — the short-page pagination stop is unchanged, and I reproduced the loss.** §3.8 still says "stop on zero *new* oids **or** a short page," with `maxPages: 6`. On today's data the short-page condition fires at page 4 and the adapter collects **92 of 130 stations (71%)**, silently discarding the 38 on pages 5–6. This was reported last round as a major finding with the exact measurement and the exact one-clause fix ("terminate only on zero businesses or zero new oids"). It was not made. Ironically proposal 1's revised rule — stop when "every station ID was already seen" or the page is empty — is now the correct one.

**Proposal 2 — the grade-blind `no` asymmetry survives, and the rule reordering made its consequence worse.** §3.3 introduces an admirable principle: "**Direct dominates inferred** … gdebenz's grade-blind '95 есть' cannot rebut Yandex's explicit '95+ нет', at any age — gdebenz structurally does not know about 95+." But §3.8 still maps `no` → `OUT_OF_STOCK` for watched grades with no directness qualifier, so gdebenz's grade-blind "нет" is emitted as a **direct** negative for `AI95_PREMIUM` — a grade the same paragraph says the source structurally cannot know about. The principle is stated and then violated one section later, in the one direction that hurts the user.

Worse, trace the "unmasked ⇒ `OUT_OF_STOCK`" closure (also unchanged) through the *new* rule order. Station with `fuels_now = "92,95,ДТ"`, watched grade `AI95_PREMIUM`. `AI95_PREMIUM` is not in the five-bit vocabulary, so it is permanently "unmasked" ⇒ **direct `OUT_OF_STOCK`**, plus an **inferred `IN_STOCK`** from the 95 bit. Now:

- gdebenz alone: no direct `IN` exists, so `newestIn = ∞`; Rule 3 ("`newestOut` clearly newer than `newestIn`, **incl. no direct `IN` at all**") fires ⇒ **`НЕТ`**. Last round this path produced `НЕТ_ДАННЫХ`; the reordering upgraded it to a confident negative.
- With Yandex saying `95+ IN_STOCK` at 60 minutes and gdebenz's band-3 imputed age of 45: `|60 − 45| = 15 ≤ conflictWindowMinutes` ⇒ Rule 2 ⇒ **`ПРОТИВОРЕЧИВО`, низкая**. A station where the only source capable of distinguishing 95+ explicitly says it is in stock gets demoted to "contradictory" by a source that cannot represent 95+ at all.

Against measured data this is not a corner case: 66 of 208 rows carry `status:"no"` and only 31 carry any fuel list, so most negatives are grade-blind, and `AI95_PREMIUM` is half the default watch target. Both halves — the `no` mapping and the unmasked closure — were reported last round with the same fix ("scope grade closures to the source's declared vocabulary; apply grade-blindness symmetrically"), and neither was applied.

**Proposal 2 — a factual error in its own verification table, in a load-bearing position.** The opening section asserts "`https://2gis.ru/robots.txt` itself returns HTTP 403 to an automated client. When a site will not even serve you its robots file, you cannot establish permission to crawl it," and §5's legal posture repeats "refuses to serve `robots.txt`." It serves it with HTTP 200, and for `User-agent: *` it does not disallow the search path. The *conclusion* (prefer the official API, don't scrape) survives on other grounds — the `/museum` interstitial is real, the task itself reports CAPTCHA on browser sessions, and a key-gated API has a stable contract a scraper never will. But a schema-level prohibition (`transport: "scrape"` rejected, host allowlist blocking all of `2gis.ru`) is now justified by a premise that is false, in a proposal whose stated identity is "I verify rather than assert." This is the second correction to its verification table across rounds (113 vs 208 stations was the first).

**Proposal 2 — three carried minors, unchanged.** `StationObservation.conflict?: boolean` still mistypes a field that is a string enum on `/api/stations` (`"no"` is truthy ⇒ silent confidence demotion on every such station); proposal 1 fixed this correctly and even added a decision-ledger line for it. The `fmask` self-check still demotes the entire source on *any* single-row mismatch. `/api/cfg`'s `"live": false` is still unread by either design.

**Proposal 1 — dead 2GIS machinery, now with better evidence.** `2gis.ru` 302-redirects automated clients to `/museum`, so proposal 1's catalogue adapter will return `CHALLENGE` every time, its 24-hour cache will never populate, and its `monitorRefreshMinutes: 360` schedule will never fire — yet the design still specifies 12-page pagination, concurrency 2, a `2gis-catalog.json` file, six fixture categories, and, critically, makes anchor resolution depend on it ("Name-only discovery uses Yandex and 2GIS city search"). Notably, robots.txt does *not* forbid this path, so it is not a policy violation — it simply will not work, which is the third round in which this machinery has been specified.

**Proposal 1 — `fresh_band` direction still unflagged.** §3.2's table presents band meanings ("less than one hour" / "within three hours" / "today") as source semantics, and §20 lists `fmask` as unverified while saying nothing about `fresh_band`. Nothing observable establishes the ordering. If inverted, the design treats the freshest reports as expired and the stalest as current. Proposal 2 flags this explicitly and proposes free self-calibration against Yandex's exact `lastSignalTimestamp` on co-located stations.

**Proposal 1 — `UNKNOWN` still inflates coverage.** §8 gives `UNKNOWN` a likelihood of 0.50 (zero logit contribution) while §9's `coverage = 1 − ∏(1 − independentGroupWeight)` still does not exclude zero-information observations. A source that explicitly reports "no information" with a known, fresh timestamp raises confidence without moving the estimate. Third round unaddressed.

**Proposal 1 — concurrency defeats early pagination termination.** With `maximumPages: 16` and `concurrency: 4`, the adapter cannot know page 7 is empty until it has issued it. If the wave loop does not re-check termination between waves it issues all 16; if it does, it issues 9 to discover the tail at 7. Either way it costs 1.3–2.3× the necessary requests against a source it is explicitly trying not to provoke. The design never states whether termination is evaluated between waves.

## Strengths & Benefits (Yellow Hat)

Proposal 1's revision contains the single best fix of this round: the pagination termination rules (`stopOnEmpty`, repeated-ID-set detection, all-IDs-already-seen, hard cap) are exactly right, and I confirmed they are the *only* viable strategy because Yandex advertises no page count at all. It also added a genuinely valuable safety property — `timeQuality.unknown = 0`, so a gdebenz status without its freshness join contributes literally nothing and cannot qualify a station, with "fetch time never becomes observation time" pinned as a test assertion. Preserving `conflict` as `string | null` is correct against the live data and is the one field-level modeling point where it beats proposal 2. The `ObservationTime` discriminated union, `PRESENCE` queue kind excluded from ordering, `specificity: "EXACT_VARIANT" | "FAMILY_ONLY"`, the config-validation rule rejecting pagination settings whose worst case exceeds the adapter deadline, and cache files carrying a schema version plus configuration fingerprint are all disciplined engineering. The `MONITORING_HOST_UNSUPPORTED` gate is the right instinct even though it guards a path that isn't specified.

Proposal 2's 2GIS resolution is the strongest single contribution across both documents, and it is right for reasons that survive the robots.txt correction. It is the only proposal that actually satisfies the task's "2GIS" requirement with something that can work: an adapter against the sanctioned, documented, versioned Places API (`api_version: 3.0.21263` — a stable contract, unlike anything scraped), key-gated, disabled with a visible `MISSING_CREDENTIAL` footer rather than silently dropped, and with `role` as a config field so promotion from registry to availability voter is one line. Making "we never touch the scraped surface" structural — host allowlist in `http.mjs`, schema rejection of `transport:"scrape"`, both asserted by tests rather than promised in prose — is the right way to encode a policy decision. The verdict-table reordering is a real fix, correctly diagnosed and correctly specified ("clearly newer" = younger by *more than* `conflictWindowMinutes`), with the regression cases pinned by name ("`OUT` newer by 2 min → `ПРОТИВОРЕЧИВО`; by 45 min → `НЕТ`"). The diff-stability rule — band-internal age drift is not an event — closes a churn source that would have made every 15-minute report look like a change. `--diff auto`, `--list-grades`, and alias-accepting `--grades` are small ergonomics wins that remove state-tracking burden from the agent. And the chunked wait remains the only monitoring primitive in either document that can actually be built.

I also want to credit both for the same discipline: neither invents a probability it can validate, both refuse to let a grade-blind positive qualify AI-95, both keep raw provenance, both forbid CAPTCHA bypass, and both state honestly that monitoring dies with the task.

## Alternatives & Creative Ideas (Green Hat)

The merged design is now close to obvious, and the remaining seams are four clauses wide.

- **Take proposal 1's pagination rules verbatim into proposal 2.** Terminate on zero businesses or zero new oids only; delete the short-page condition; raise `maxPages` to ~10; emit `TRUNCATED` when the cap binds while new oids still arrive. Evaluate termination between concurrency waves so the tail costs one wave, not four.
- **One symmetric rule for grade-blind evidence, in both proposals.** If a gdebenz row's `fmask == 0` / `fuels_now` is empty, every watched grade gets `UNCERTAIN` — regardless of whether the status is `yes` or `no`. And restrict the "unmasked ⇒ `OUT_OF_STOCK`" closure to grades inside the source's declared vocabulary, so `AI95_PREMIUM` never receives a direct negative from a source with no premium concept. Two clauses; they remove the worst false-negative path in proposal 2 and tighten proposal 1's `no` handling at the same time.
- **Read `2gis.ru/robots.txt` and honor it, rather than reasoning about whether it exists.** It is served, it is 1193 bytes, and it permits the search path for generic agents. Proposal 2 should keep the API-only decision but rebase its justification on the `/museum` interstitial and contract stability (both verifiable, both sufficient); proposal 1 should note that scraping is robots-permitted but interstitial-blocked, and reduce its 2GIS adapter to a stub while moving anchor resolution entirely onto gdebenz's 208-row gazetteer, which needs no key and no permission.
- **Probe `/api/cfg` once at startup.** `{"live": false, …}` has been sitting unread for three rounds. It is one request, it may gate the very live-status semantics both designs are built on, and surfacing it in source health costs nothing.
- **Calibrate `fresh_band` as a by-product.** 118 comment rows join cleanly to stations and Yandex supplies exact `lastSignalTimestamp` for co-located ones. Log (band, Yandex-age) pairs per cycle; until the direction is measured, collapse all bands into one low-precision class rather than assuming an ordering — an inverted assumption makes stale data look fresh.
- **Make `fmask` self-check per-row.** Discard grade claims for the mismatching row; demote the whole source only above a mismatch rate. Log the validated sample size, since only ~30 of 118 rows are informative enough to validate at all.
- **Set expectations about gdebenz's real contribution.** "2–3× coverage" is true for *stations* and misleading for *evidence*: 13 stations carry explicit AI-95, zero carry premium-95. gdebenz is an excellent registry and gazetteer, a thin corroborator for plain AI-95, and contributes nothing direct to the default premium target. Both `SKILL.md` files should say so.

## Completeness & Process (Blue Hat)

Both documents cover every required topic and are, structurally, implementation-ready specifications. The differentiator this round is convergence behavior, and it cuts against both — asymmetrically.

Proposal 1 fixed the finding it could fix mechanically (pagination) and did not engage at all with the one that requires rethinking an architecture (monitoring). Three rounds, same eleven-step §12, same citation. Its decision ledger now has 18 rows and none of them addresses it. A design gate cannot approve a spec in which one of two required modes is described by mutually exclusive steps.

Proposal 2 did substantial, correct new work — the 2GIS API path required fresh investigation and produced the right answer — but did it *instead of* applying three explicitly-stated major fixes from the previous round, one of which (the premium-95 closure) got materially worse under its own reordering, and it introduced a new unverified claim into its verification table. Fixing the rule you rediscovered yourself while leaving the three a reviewer handed you is a prioritization signal worth naming.

Remaining gaps in **both**: neither models the correlation between Yandex `fuelAvailability` and gdebenz reports as overlapping crowd-sourced driver populations, so "two independent sources agree" overstates corroboration in both the coverage formula and the "≥2 agreeing sources ⇒ высокая" row. Neither reads `/api/cfg`. Neither proposes any validation that the *verdicts themselves* are right — a week of spot-checks against a handful of stations is the only real evidence available, and its absence means both confidence scales, continuous and discrete, remain unvalidated.

Specific to **proposal 1**: rewrite §12 around a buildable primitive; flag `fresh_band` direction in §20; exclude zero-information statuses from `coverage`; reduce 2GIS to a stub and remove it from anchor resolution; state whether pagination termination is evaluated between concurrency waves.

Specific to **proposal 2**: fix the short-page stop; apply grade-blindness symmetrically; scope the unmasked closure to in-vocabulary grades; correct the robots.txt claim and rebase the 2GIS justification on the interstitial; pin `conflict`'s endpoint and type; move `state/` outside the skill directory (a reinstall currently wipes the identity map and snapshot history — proposal 1's external state directory is better); note in `SKILL.md` that the default bbox includes Volzhsky and Krasnoslobodsk, which are not Volgograd.

Proposal 2 remains the sounder skeleton and its residual defects are four bounded edits. Proposal 1 has better field-level modeling in three specific places worth harvesting, but its second required mode cannot be built from what is written.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "proposal-1",
      "approval_score": 4,
      "would_adopt": false,
      "summary": "This round genuinely fixed the pagination critical - and I confirmed the fix is the only viable one, because the Yandex state-view payload advertises no last page and no next-page link at all, so the sequential rules (stop on empty page, stop when every station id was already seen, hard cap) necessarily govern. It also added real safety in timeQuality.unknown = 0 so a gdebenz status without its freshness join contributes nothing, and it correctly types gdebenz conflict as string|null, which the live data vindicates and proposal 2 still gets wrong. But the single blocking finding is unchanged for the third consecutive round: section 12 still specifies a foreground NDJSON child process AND agent waits of no more than 60 seconds AND the agent publishing each snapshot AND the agent sending SIGINT, four mutually exclusive things, still justified by a learn.chatgpt.com /goal link that is not evidence of a Codex primitive. The new MONITORING_HOST_UNSUPPORTED gate improves how monitoring declines to start without specifying how it runs. Add unflagged fresh_band direction, UNKNOWN still inflating coverage, and a 2GIS catalogue subsystem that I re-verified will always hit a 302 /museum interstitial while anchor resolution still depends on it, and one of the two required user-facing modes cannot be built from this document.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "critical",
          "area": "monitoring lifecycle",
          "description": "Unchanged across three rounds. Section 12 simultaneously specifies step 4 'launch one foreground monitor --ndjson child process', step 9 'use waits no longer than 60 seconds so user steering remains responsive', step 10 'publish each snapshot as a complete commentary update', and step 11 'abort current requests; send SIGINT'. If the agent is blocked inside a foreground exec it can do none of steps 9-11. The durable-goal mechanism is still asserted via a ChatGPT consumer documentation link. The newly added host-capability check and exit code 5 govern the decline path only; the happy path remains unimplementable as written.",
          "required_change": "Rewrite section 12 around a buildable primitive: a non-spawning command that blocks for a bounded interval (<= 240 s), polls a stop sentinel, and exits with a status code so the agent itself loops, collects, and publishes each summary. Remove the unverified durable-goal dependency or demonstrate the primitive exists on the target host."
        },
        {
          "id": "",
          "severity": "major",
          "area": "gdebenz freshness semantics",
          "description": "Section 3.2 presents the fresh_band table ('less than one hour' / 'within three hours' / 'today') as source semantics, and section 20 flags fmask as unverified while saying nothing about fresh_band. Nothing observable establishes the ordering. If it is inverted, the design treats the freshest reports as expired and the stalest as current - a silent failure in the unsafe direction, and one that fully determines gdebenz's contribution since band 2 already scores near zero under the 20/90/240 defaults.",
          "required_change": "Add fresh_band direction to section 20's assumptions, and add the free calibration path: 118 comment rows join cleanly to stations by osm_id and Yandex supplies exact lastSignalTimestamp for co-located stations. Until measured, collapse all bands into one low-precision class rather than assuming an ordering."
        },
        {
          "id": "",
          "severity": "major",
          "area": "2GIS dead machinery",
          "description": "Re-verified this session: https://2gis.ru/volgograd 302-redirects an automated client with a full desktop UA to /museum?return_url=..., so the catalogue adapter will return CHALLENGE on every attempt and the 24-hour cache can never populate. Yet the design still specifies 12-page pagination, concurrency 2, cacheTtlMinutes 1440, monitorRefreshMinutes 360, a 2gis-catalog.json file, six fixture categories, and makes anchor resolution depend on it ('name-only discovery uses Yandex and 2GIS city search'). Note that robots.txt is served (HTTP 200, 1193 bytes) and does NOT disallow the search path for User-agent *, so this is not a policy violation - it simply cannot work.",
          "required_change": "Reduce 2GIS to a disabled config stub; move anchor resolution entirely onto gdebenz's 208-row registry, which supplies name, brand, addr, lat and lon and needs no key. If 2GIS is wanted, adopt the official key-gated catalog.api.2gis.com Places API path instead of the web surface."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "confidence formula",
          "description": "Third round unresolved. Section 8 gives UNKNOWN a likelihood of 0.50 (zero logit contribution) while section 9's coverage = 1 - product(1 - independentGroupWeight) still does not exclude zero-information observations. A source explicitly reporting 'no information' with a known fresh timestamp therefore raises confidence without moving the availability estimate - and the rule 'if fuels_now lists only other grades, the requested grade remains UNKNOWN' now generates such observations systematically.",
          "required_change": "State explicitly that UNKNOWN, and any status whose logit contribution is zero, is excluded from the coverage term."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "pagination concurrency",
          "description": "With maximumPages 16 and concurrency 4, the adapter cannot know page 7 is empty until it issues it. If the wave loop does not re-evaluate termination between waves it issues all 16 pages; if it does, it issues 9 to discover a tail that begins at 7. Measured reality is 130 stations across 6 pages with page 7 empty. Either way this is 1.3-2.3x the necessary request volume against a source the design is explicitly trying not to provoke, and the document never states which behaviour applies.",
          "required_change": "Specify that termination conditions are evaluated between concurrency waves, and size the wave so the empty-tail discovery costs one extra wave rather than four."
        }
      ],
      "assumptions": [
        "I re-verified all source behaviour by read-only GET this session rather than asking; measurements are from 2026-08-30.",
        "I assumed the target host is a Codex skill environment where tool calls are request/response, so an agent blocked in a foreground exec cannot publish intermediate output or send signals.",
        "I assumed 'advertised last page or next-page link' cannot refer to totalResultCount, since that value is demonstrably unstable; I searched the payload and found no genuine pagination metadata, so the sequential fallback governs.",
        "I treated /api/cfg 'live: false' as an unresolved unknown rather than assuming a specific meaning."
      ],
      "round": 3,
      "reviewer": "opus1mhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 4
would_adopt: false
