# Task: skill for fuel availability monitoring

Design a reusable Codex skill that gathers current fuel availability data from multiple services for petrol stations inside a user-configured area of Volgograd.

The skill must support two user-facing modes:

1. On-demand: when asked, report where the requested fuel is currently available.
2. Monitoring: in the current Codex task, publish a new summary every 15 minutes until the user asks to stop. Rank stations by the probability that suitable fuel is actually available and, where data exists, by the smallest queue.

Defaults and configuration:

- Monitor AI-95 and all premium/branded AI-95 variants by default.
- Allow other fuel grades to be requested.
- Store the area, fuel aliases, freshness thresholds, source settings, and similar runtime settings in configuration next to the skill scripts.
- The search area may be a rectangle. The user should also be able to name the outermost acceptable petrol stations; their coordinates can be used to derive a polygon or equivalent usable boundary.
- Report a meaningful confidence/freshness assessment rather than merely saying fuel is present.

Requested sources:

- https://gdebenz.ru/
- 2GIS search for petrol stations in Volgograd
- Yandex Maps search for petrol availability in Volgograd

The user initially preferred standalone JavaScript collectors, then explicitly changed the runtime requirement: use `agent-browser` for every source. Same-origin JavaScript evaluated inside the loaded browser page is acceptable; direct HTTP-first collectors are not the V1 path. Source failures must not prevent a useful result from other sources.

Empirical observations from a read-only inspection on 2026-08-30:

- Yandex Maps rendered server HTML containing per-station coordinates and `fuelAvailability` data, including per-grade status (`IN_STOCK`, `OUT_OF_STOCK`, `UNKNOWN`, `UNCERTAIN`), `lastSignalTimestamp`, `signalsCountPerHour`, and queue fields such as `localizedQueueSize`. This may be extractable without a browser, but it is an internal unversioned representation.
- 2GIS redirected a fresh automated browser session to a CAPTCHA, so unattended access may require a browser/session fallback or may be unavailable.
- gdebenz.ru returned HTTP 502 during inspection, so it must be treated as an optional/degraded source.

The design should cover source adapters, normalization and station identity matching, geometry filtering, confidence/freshness scoring, queue normalization and ranking, monitoring lifecycle in the current Codex task, fallback behavior, output format, configuration schemas, testing, and legal/operational fragility of unofficial data extraction.

This is a design task only. Do not implement or scaffold the skill until the user approves the design.

## User-confirmed refinements after the initial council task

- Monitoring must be performed by the active agent in the current task using interruptible bounded waits, not by a heartbeat automation. Do not keep a browser open while waiting.
- Every on-demand run and every monitoring tick must fully close and verify cleanup of its `agent-browser` resources. Persistent browsers between ticks are unwanted.
- One ephemeral browser session with one sequentially reused tab is preferred for lower memory use.
- CAPTCHA or failure of any source must be stated in the text report.
- Do not retain long-term monitoring history. On-demand leaves no state; active monitoring may keep only the previous tick/current run state and must delete it on stop.
- Coordinate proximity alone must never merge stations because different services may shift coordinates and distinct stations can be 50–100 metres apart.
- Queue data is desirable but secondary.
- Only stations with positive current evidence are useful in the primary recommendation list. More supporting services are better.
- The strongest positive heuristic is a long gap in grade-specific transactions/activity followed by new events that continue, because this can indicate fuel has just appeared before a queue grows. Preserve the source's terminology and do not mislabel generic signals as transactions.
- Default area: convex hull of the eleven provided Volgograd boundary stations, expanded outward by 500 metres. Ангарская 8А and Рокоссовского 4Б were checked as interior test points.
