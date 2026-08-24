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
- SearXNG fallback is bounded to a primary + one optional fallback instance to avoid Cloudflare Worker subrequest exhaustion.
- Provider and attempted-provider information is returned.

Testing:
- DuckDuckGo is currently unreliable from the Worker because of bot/challenge responses.
- SearXNG fallback works.
- `https://search.mectov.my.id` successfully returned relevant `Ramzul Ramli` results in one test.
- The same public instance later returned completely irrelevant Microsoft/Windows/Outlook results for the same query.

Therefore **HTTP 200 + valid SearXNG JSON is not sufficient**. Search-quality/relevance validation is now the immediate blocker.

Status: **PROVIDER FALLBACK WORKING / SEARCH QUALITY BLOCKER**

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

Testing exposed a downstream problem: when SearXNG returned Microsoft/AppLocker pages for `Ramzul Ramli`, the investigator extracted generic terms such as `control`, `windows`, and `policy`. Therefore **do not expand recursion until `/search` quality is stable**.

Status: **CONTROLLED WORKFLOW WORKING / BLOCKED BY SEARCH QUALITY**

## Identity-resolution golden test

Known ground truth for development:
- `Ramzul Mazwan bin Ramli` = full name of the test subject.
- `Ramzul Ramli` = common/public name used on Facebook and other services by the test subject.
- `Ramzulhakim Ramli` = a different person known online.

The engine must never merge people solely because names are similar. Search relevance and identity resolution are separate layers; identity requires corroborating evidence.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 PROVIDER FALLBACK WORKING / QUALITY BLOCKER
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION
Phase 4  Discovery Intelligence INITIAL IMPLEMENTATION
Phase 5  Recursive Crawler      CONTROLLED INITIAL WORKFLOW
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       PLANNED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT         FUTURE
Phase 10 Optimization           FUTURE
```

## Immediate Next Steps

1. Update `src/search.js` with result-quality/relevance validation.
2. Treat HTTP success as insufficient when results are obviously unrelated to the query.
3. Keep SearXNG attempts bounded to protect Worker subrequest limits.
4. Test `/search` directly with `Ramzul Ramli` and generic seeds.
5. Only after direct search is reliable, retest `/investigate` recursion.
6. Then improve entity scoring and identity resolution.

## Resume Note

**Next engineering task: `src/search.js` search-result quality/relevance validation. Do not modify the discovery queue or increase recursion budgets until direct `/search` quality is stable.**
