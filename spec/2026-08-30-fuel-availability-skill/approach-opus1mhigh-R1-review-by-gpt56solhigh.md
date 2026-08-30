## Facts & Constraints

Both proposals correctly recognize the central constraint: availability must remain an evidence-based, time-sensitive assessment, not a Boolean scraped from a page. Both also use sensible adapter isolation, normalized observations, geometry filtering, and partial-source operation.

Proposal 1 is the more coherent baseline. It keeps source capabilities explicit, treats unversioned extraction conservatively, separates product variants, distinguishes availability from confidence, and fails closed when the configured area is unresolved.

Proposal 2 adds valuable empirical detail, particularly the gdebenz JSON endpoints, OSM identifiers, `fmask`, and observed Yandex pagination behavior. Those discoveries should inform the final design, but several conclusions are stronger than the evidence supports:

- An OSM ID is a strong canonical identifier for a gdebenz station, but it does not identify the corresponding Yandex or 2GIS record. Fuzzy cross-source matching is still doing the important work.
- Reverse-engineered `fmask`, `fresh_band`, and status semantics remain unversioned contracts. Putting mappings in configuration helps recovery but does not make inferred negative evidence reliable.
- Proposal 2 says Yandex returned page sizes of 25, 24, and 13, then specifies stopping when a page has fewer than the nominal page size. That algorithm would stop after page 2 and miss page 3.
- A user-configured area is part of the product contract. Substituting an automatically derived city-wide bounding box when no area is configured can produce operationally wrong recommendations far beyond the user’s acceptable area.

The requirement to monitor in the current task also needs precision. A foreground process can maintain timing, but the agent must consume yielded output without blocking user steering for 15 minutes at a time. Runtime state must survive individual cycles without becoming part of the distributable skill directory.

## Risks & Failure Modes

### Proposal 1

The main scoring defect concerns observations without native timestamps. A freshly fetched, but potentially old, gdebenz status receives a `FETCH_TIME_ONLY` penalty yet can still qualify as “currently available.” Fetch time proves when the page was read, not when the fuel report was made. Such evidence should be freshness-unknown and either barred from current eligibility or subject to a strict probability/confidence cap.

The CLI contract is internally inconsistent. Exit code `0` means at least one successful source, which could be discovery-only 2GIS, while the failure table says the absence of any successful availability-capable source produces exit code `3`. The latter is the correct rule and should be normative.

Other gaps are smaller but real:

- Conflict computation does not define which statuses count as positive or negative, or how zero-weight and unknown evidence participate.
- “Strongest contribution per correlation group” needs an exact selection rule. Choosing by signed value rather than absolute evidential weight could discard the wrong observation.
- A three-anchor minimum excludes potentially useful user input such as two opposite rectangle corners. At minimum, the configuration should support explicit two-corner rectangle anchors separately from polygon anchors.
- The browser port is architectural rather than executable: the design does not specify how a standalone Node script safely invokes the installed `agent-browser` workflow, parses its output, or cancels it.
- Missed monitoring deadlines are not defined. If a cycle lasts longer than the interval, the implementation must skip overdue ticks rather than immediately running a burst of catch-up cycles.
- Source-native timestamps need explicit validation for future clock skew, invalid units, and implausible age.

These are repairable without replacing the architecture.

### Proposal 2

Proposal 2 contains several direct requirement violations.

Monitoring stops after 12 hours, 48 runs, or four consecutive all-source failures. The task says monitoring continues until the user asks to stop. A prolonged outage should produce degraded summaries and continue retrying; it must not silently redefine the stopping condition. Optional resource guards may be configurable only if disabled by default and explicitly requested.

The default Volgograd-wide bounding box is unsafe. “A defensible superset” is not equivalent to the user’s acceptable area. The conservative behavior is to refuse collection until an area is configured, while offering the discovered bounds as an explicit example.

The ranking formula does not implement the requested priority cleanly:

- Queue contributes 25% globally, so a station with materially weaker availability evidence can outrank a more probable station.
- Unknown queue is assigned `0.5`; therefore it is explicitly better than a known long queue and worse than a known short one. It is not neutral.
- Distance from the area’s geometric center affects ranking even though the user did not identify that point as an origin or request distance ranking.

A safer ranking is lexicographic: eligibility, availability band, confidence/freshness, queue among stations with comparable availability and known queue, exact availability, then deterministic tie-breakers. Distance should be displayed or used only when the user configures an origin.

Several source decisions could create false claims:

- Absence of a grade from an undocumented `fmask` must not become `OUT_OF_STOCK` unless that closed-world meaning is independently established. It may mean unreported or unknown.
- A generic gdebenz “95” signal cannot corroborate premium AI-95 specifically. It can support the union query “some acceptable AI-95,” but should not be cloned into evidence for a named premium product.
- `AI100` should not be modeled as `premiumOf: AI98`. It is a distinct octane family for query and evidence purposes unless a specific source’s UI taxonomy explicitly requires a display relationship.
- The permissive recursive Yandex walk risks accepting duplicate, stale, suggested, or unrelated business objects embedded elsewhere in application state. Structural flexibility should remain bounded by validated result-container sentinels and geographic/query checks.
- Capturing raw parser-failure bodies by default may retain personalized URLs, identifiers, or session-bearing state. Debug capture should be opt-in, sanitized, and stored outside the skill.
- A “never throw” adapter contract can conceal programming defects. Expected source failures should be returned as data, while unexpected defects should be caught and classified at the pipeline boundary.
- Mutable `state/` beneath `~/.codex/skills/fuel-watch/` mixes runtime data with the installed artifact. State belongs in a configurable cache/state directory.
- Disabling 2GIS by default is operationally understandable, but the design must still clearly satisfy “requested sources” through a supported best-effort adapter and visible disabled/unavailable health, rather than merely leaving a future stub.

## Strengths & Benefits

Proposal 1 has strong separation of concerns and the better semantics around:

- concrete fuel-product scoring;
- independent confidence versus estimated availability;
- source correlation groups;
- explicit schema-change failures;
- fail-closed area resolution;
- queue comparison only when meaningful;
- last-good data excluded from current claims;
- monotonic monitoring cadence;
- no automatic termination on ordinary outages;
- legal and operational caveats.

Proposal 2 contributes highly useful implementation research:

- direct JSON extraction from gdebenz is preferable to scraping its rendered page;
- OSM IDs are valuable canonical-key candidates;
- Yandex totals should not control pagination;
- `fmask` consistency checks can disable questionable grade evidence while preserving registry data;
- 2GIS should not influence availability confidence when it supplies only registry metadata;
- deterministic diffing between monitoring ticks will make repeated reports substantially more useful.

Its pure scoring and geometry functions, fixture-injected HTTP client, stable tie-breakers, and read-only source method allowlist are also good implementation choices.

## Alternatives & Creative Ideas

The strongest final design would combine Proposal 1’s architecture and safeguards with Proposal 2’s verified source intelligence.

Use gdebenz as a preferred registry source and canonical-key provider when present, but call it a canonical-key preference rather than an identity spine. Retain conservative cross-source matching, complete-link or mutual-best constraints, explicit overrides, and stable fallback keys when gdebenz is unavailable.

Represent evidence at two levels:

- Product-specific evidence, such as Yandex `AI95_PREMIUM`.
- Family-union evidence, such as an undocumented source reporting only “95.”

Family-union evidence can support the default “any acceptable AI-95” query without pretending to prove that plain or premium AI-95 individually exists. It should never be rendered as cross-source agreement on a variant.

Use pagination termination based on zero new station IDs, an empty page, a repeated page fingerprint, or a configured hard cap—not a single short page.

For scoring, retain a transparent heuristic but name the output an “estimated availability score” until calibration data exists. Native-timestamp evidence may qualify as current; fetch-time-only evidence should remain freshness-unknown and normally appear among uncertain candidates. Confidence should incorporate correlation groups and cap single-feed confidence.

For monitoring:

- Publish immediately.
- Schedule against monotonic 15-minute targets.
- Skip and report missed ticks.
- Keep retrying through outages.
- End only on explicit user stop or unavoidable task/host termination.
- Store state in an OS-appropriate state/cache directory.
- Let the agent poll or consume the foreground process in bounded intervals so user steering stays responsive.

2GIS could be refreshed less frequently than availability sources—for example, at monitor startup and then every several hours—because registry metadata changes much more slowly and browser access is expensive and failure-prone.

## Completeness & Process

Neither proposal is ready for implementation approval exactly as written.

Proposal 1 needs targeted contract repairs, especially timestamp eligibility, source-success exit semantics, precise correlation/conflict rules, and an executable browser boundary. Its overall design is otherwise implementation-ready.

Proposal 2 needs architectural correction rather than polishing. The stopping conditions, implicit area, pagination rule, ranking formula, inference from undocumented fields, and runtime-state placement must change before adoption. Its live source discoveries should be retained as provisional fixtures and canaries, with retrieval metadata and sanitized examples, rather than elevated directly into stable semantic contracts.

Before implementation, the accepted design should include explicit invariants:

- No current availability claim from freshness-unknown evidence alone.
- No variant-specific claim from family-only evidence.
- No `OUT_OF_STOCK` inference from a missing undocumented field without validated closed-world semantics.
- No monitoring termination because sources are temporarily unavailable.
- No queue or arbitrary distance term overriding materially stronger availability.
- No area expansion beyond configured boundaries.
- No raw response retention by default.
- No source counted as a successful availability source merely because discovery succeeded.

```council-verdict
{
  "schema_version": 1,
  "verdicts": [
    {
      "target_id": "proposal-2",
      "approval_score": 4,
      "would_adopt": false,
      "summary": "Proposal 2 contains valuable source research, especially the gdebenz JSON endpoints, OSM IDs, fmask checks, and Yandex pagination observations, but the proposed system should not be adopted as written. It directly violates the monitoring stopping condition, silently invents a broad default area, contains a pagination algorithm contradicted by its own measurements, permits queue and arbitrary center distance to override availability, and turns reverse-engineered missing fields into potentially unsafe negative or variant-specific evidence.",
      "phase": "approach-review",
      "confidence": "high",
      "blocking_findings": [
        {
          "id": "",
          "severity": "critical",
          "area": "monitoring lifecycle",
          "description": "Monitoring automatically stops after 12 hours, 48 runs, or four consecutive all-source failures, contrary to the requirement to continue until the user asks to stop.",
          "required_change": "Disable automatic duration, run-count, and outage termination by default; continue publishing degraded health summaries and retry until explicit stop or unavoidable host/task termination."
        },
        {
          "id": "",
          "severity": "major",
          "area": "area configuration",
          "description": "The design silently uses a Volgograd-wide bounding box when the user has not configured an acceptable area.",
          "required_change": "Fail closed until an area is configured; provide the discovered city bounds only as an explicit example the user may choose."
        },
        {
          "id": "",
          "severity": "major",
          "area": "Yandex pagination",
          "description": "Stopping on a short page would terminate after the observed 24-item second page and miss the observed third page.",
          "required_change": "Stop on zero new IDs, an empty or repeated page, or a hard page cap; do not stop after a single short page."
        },
        {
          "id": "",
          "severity": "major",
          "area": "ranking",
          "description": "A 25% queue term, a synthetic median score for unknown queues, and distance from an arbitrary area center can reorder stations against the requested availability-first priority.",
          "required_change": "Use lexicographic availability bands and confidence/freshness, compare queues only among comparable stations with known queue data, and omit distance unless the user configures an origin."
        },
        {
          "id": "",
          "severity": "major",
          "area": "fuel semantics",
          "description": "Missing grades in an undocumented fmask become reduced-weight OUT_OF_STOCK evidence, and generic 95 evidence is projected toward premium 95 despite the source lacking variant semantics.",
          "required_change": "Treat missing or family-only undocumented data as unknown or family-union evidence until closed-world semantics are validated; never use it as variant-specific agreement."
        },
        {
          "id": "",
          "severity": "major",
          "area": "fuel taxonomy",
          "description": "AI100 is modeled as premiumOf AI98, which can silently broaden an AI98 request to a distinct octane grade.",
          "required_change": "Keep AI98 and AI100 as distinct fuel families; model branded variants independently from octane families."
        },
        {
          "id": "",
          "severity": "major",
          "area": "parser safety",
          "description": "An unrestricted recursive walk for business nodes can accept unrelated or stale embedded objects, while default raw-body dumps can retain sensitive or personalized response state.",
          "required_change": "Bound extraction to validated result containers and query geometry; make sanitized debug capture opt-in and store it outside the installed skill."
        },
        {
          "id": "",
          "severity": "major",
          "area": "runtime state",
          "description": "Snapshots, identity maps, debug bodies, and watch state are stored beneath the installed skill directory.",
          "required_change": "Move mutable runtime data to a configurable OS-appropriate state/cache directory and keep the skill directory limited to code, schemas, and user-editable configuration."
        }
      ],
      "non_blocking_findings": [
        {
          "id": "",
          "severity": "minor",
          "area": "source identity",
          "description": "Calling gdebenz OSM IDs an identity spine overstates their cross-source authority.",
          "required_change": "Use OSM IDs as preferred canonical keys when present while retaining explicit conservative cross-source matching semantics."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "error handling",
          "description": "The adapter must-not-throw contract risks converting programming defects into ordinary source degradation.",
          "required_change": "Return expected operational failures as data, but classify unexpected defects at the pipeline boundary with visible internal-error diagnostics."
        },
        {
          "id": "",
          "severity": "minor",
          "area": "2GIS",
          "description": "Disabling 2GIS by default weakens the claim that all requested sources are supported.",
          "required_change": "Keep a genuine best-effort adapter and visible health state, potentially polling it less frequently because it is registry-only."
        }
      ],
      "assumptions": [
        "The proposal's live observations are accurate for 2026-08-30 but do not establish stable upstream contracts.",
        "The semantics of missing fmask bits and fresh_band values remain unverified.",
        "The user-configured area is authoritative and must not be replaced by a larger inferred boundary."
      ],
      "round": 1,
      "reviewer": "gpt56solhigh"
    }
  ]
}
```

---REVIEW-META---
approval_score: 4
would_adopt: false
