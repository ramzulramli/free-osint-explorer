# Free OSINT Explorer — Project Status

Last updated: 2026-08-25

## Goal

Build a free/RM0 where practical, on-demand OSINT discovery and investigation system using GitHub + Cloudflare Workers. No always-running server.

## Infrastructure

- Repository: `ramzulramli/free-osint-explorer`
- Worker: `free-osint-explorer`
- Production: `https://free-osint-explorer.ramzul.workers.dev`
- GitHub → Cloudflare deployment is configured.

## Current APIs

### `/search`

Uses the shared search-provider abstraction.

Providers:
- DuckDuckGo
- SearXNG

Current behaviour:
- `auto` tries DuckDuckGo first.
- DuckDuckGo bot/challenge responses are explicitly detected.
- SearXNG is used as fallback.
- SearXNG results are normalized to `{title,url,snippet}`.
- Search results are scored against the query before being returned.
- Weak results with no query-term evidence are filtered out.
- Compound-name partial matches are deliberately scored lower than exact name matches.
- SearXNG fallback is bounded to a primary + one optional fallback instance to avoid Cloudflare Worker subrequest exhaustion.
- Provider and attempted-provider information is returned.

Testing:
- DuckDuckGo is currently unreliable from the Worker because of bot/challenge responses.
- SearXNG fallback works.
- `Ramzul Ramli` returns relevant Facebook, Instagram, YouTube and other matching results, plus the full-name LinkedIn result for `Ramzul Mazwan Ramli`.
- `Ramzul Mazwan Ramli` returns the full-name LinkedIn, Shutterstock and MSTB results.
- `Ramzulhakim Ramli` returns results belonging to the separate known person.
- `Ramzulhakim Ramli` is retained as a lower-relevance `compound_name_partial` candidate when it appears in a broader `Ramzul Ramli` search; it is not treated as the same identity.
- A generic `Microsoft Windows` query returns Windows-related results.

The earlier failure mode where a valid SearXNG response contained unrelated Microsoft/AppLocker pages is now addressed at the `/search` result-ranking/filtering layer.

Status: **SEARCH PROVIDER + INITIAL RELEVANCE VALIDATION WORKING**

### `/fetch`

Fetches public HTTP/HTTPS pages and returns status/content metadata.

Status: WORKING.

### `/read`

Fetches pages, extracts readable text/links and performs heuristic entity extraction.

Initial entities include people, organisations, locations, URLs, usernames, dates, years and keywords, with normalization, deduplication and basic confidence scoring.

Status: WORKING / heuristic improvement ongoing.

### `/investigate`

Controlled recursive workflow:
1. Search seed.
2. Select a bounded set of results.
3. Read selected pages.
4. Extract entities from page content and search-result title/snippet metadata.
5. Aggregate, score and filter discoveries.
6. Optionally queue discoveries for controlled recursion.
7. Track visited queries and resource budgets.

Current limits:
- Search results: 5
- Pages: 3
- Entities/source: 50
- Ranked entities: 50
- Discoveries: 25
- Depth: 2
- Queue: 5
- Search requests: 5
- Visited queries: 10

Earlier `/investigate` testing showed that unrelated search results could contaminate entity extraction. Direct `/search` relevance filtering is now in place, so the next step is to retest `/investigate` using the identity-resolution golden tests before increasing recursion budgets.

Status: **CONTROLLED WORKFLOW READY FOR RETEST**

## Identity-resolution golden test

Known ground truth for development:
- `Ramzul Mazwan bin Ramli` = full name of the test subject.
- `Ramzul Ramli` = common/public name used on Facebook and other services by the test subject.
- `Ramzulhakim Ramli` = a different person known online.

The engine must never merge people solely because names are similar. Search relevance and identity resolution are separate layers; identity requires corroborating evidence.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 INITIAL RELEVANCE VALIDATION WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION
Phase 4  Discovery Intelligence INITIAL IMPLEMENTATION / RETEST READY
Phase 5  Recursive Crawler      CONTROLLED INITIAL WORKFLOW / RETEST READY
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       PLANNED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT         FUTURE
Phase 10 Optimization           FUTURE
```

## Immediate Next Steps

1. Deploy the latest GitHub code to the Cloudflare Worker.
2. Retest `/investigate` with `Ramzul Ramli`.
3. Retest `/investigate` with `Ramzul Mazwan Ramli`.
4. Retest `/investigate` with `Ramzulhakim Ramli` as the separate-person control case.
5. Confirm unrelated generic entities such as `control`, `windows` and `policy` no longer dominate an investigation caused by contaminated search results.
6. Refine entity scoring and identity resolution only after the investigation tests pass.
7. Then strengthen controlled recursion.

Do not increase crawl budgets yet.

## Resume Note

**Next engineering task: deploy current code and run the `/investigate` golden tests.**
