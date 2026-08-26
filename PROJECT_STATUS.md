# Free OSINT Explorer — Project Status

Last updated: 2026-08-26

## Goal

Build a free/RM0 where practical, on-demand OSINT discovery and investigation system using GitHub + Cloudflare Workers. No always-running server.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 NAME QUERY FAN-OUT WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION / ACCOUNT EXTRACTION WORKING
Phase 4  Discovery Intelligence WORKING / REFINEMENT NEEDED
Phase 5  Recursive Crawler      CONTROLLED WORKFLOW / TESTED TO DEPTH 1
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       FIRST WEB UI IMPLEMENTED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT          FUTURE
Phase 10 Optimization           FUTURE
```

## Infrastructure

- Repository: `ramzulramli/free-osint-explorer`
- Worker: `free-osint-explorer`
- Production: `https://free-osint-explorer.ramzul.workers.dev`
- Wrangler entry point: `src/investigate.js` (legacy/current investigation module reference)
- Main Worker entry point: `src/index.js`
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
- **Name-like queries now fan out into up to three bounded variants:** normal name, quoted exact name, and `bin` variant for two-token Malaysian-style names.
- Duplicate URLs from those variants are merged and ranked against the original query.
- Provider and attempted-query information is returned.
- SearXNG fallback is bounded to a primary + one optional fallback instance to avoid Cloudflare Worker subrequest exhaustion.

Status: **SEARCH + NAME DISCOVERY WORKING**

### `/fetch` / `/read`

Core web-reading functions remain available internally to the investigation engine. Pages are fetched over HTTP/HTTPS, readable text is extracted, and entity candidates are generated.

Status: **WORKING / core**

### `/investigate`

Controlled investigation workflow:
1. Accept a seed subject/query.
2. Search through the shared provider abstraction.
3. For name-like queries, automatically try bounded search variants.
4. Validate result quality.
5. Collect a bounded result set.
6. Read selected pages.
7. Extract entities and account candidates from page content.
8. Aggregate evidence and preserve source provenance.
9. Score and filter discoveries.

Current API response includes:
- investigation subject/query and confidence signal;
- search provider and result count;
- readable source list;
- ranked person candidates;
- related entities/accounts/locations;
- investigation statistics and limits.

### Investigation UI

The Worker root `/` now serves a first usable web interface directly from the Worker. It provides:
- investigation search box;
- loading state;
- possible identity card;
- alternative candidates;
- confidence signal visualization;
- related signals;
- sources read with clickable links;
- basic investigation statistics;
- responsive mobile layout.

The UI deliberately labels confidence as a **match signal**, not proof of identity.

## Investigation Limits

Current limits remain deliberately conservative:

- Search results: 5
- Pages: 3 for `/investigate`
- Ranked people: 10
- Related signals: 15
- Search requests: bounded by provider layer
- Name query variants: maximum 3

**Do not increase crawl budgets yet.**

## Identity Resolution Golden Test

Known development ground truth:

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

The engine must never merge people solely because names are similar. Search relevance and identity resolution remain separate layers; identity requires corroborating evidence.

## Current Test Subject

Next end-to-end development test:

```text
Shazzuwan Zakaria
```

Useful public search signals already observed during manual validation include the exact name, the `bin Zakaria` form, school-related references, and a sports-document reference. These are test leads only; they must be corroborated before being treated as one identity.

## Known Issues / Technical Debt

1. Generic page-title fragments can still be emitted as `person_candidate` values.
2. Entity/account duplicates can still appear across different searches and need stronger consolidation.
3. Organisation attribution needs stronger source-level corroboration.
4. Confidence scoring can reach high values without representing actual certainty; calibration is still required.
5. Related-person account matches must remain separate unless independently corroborated.
6. Public SearXNG instances remain an availability/quality dependency.
7. Live production verification of the current UI still needs to be performed after deployment.
8. The current UI is intentionally minimal; investigation history, graph visualization and export/reporting are not implemented yet.
9. Public contact details may be extracted when openly published, but private residential addresses should not be automatically harvested or displayed.

## Immediate Next Steps

1. **Deploy/verify the current commits** and run `Shazzuwan Zakaria` end-to-end from the browser.
2. Inspect whether the three name variants produce genuinely different useful sources.
3. Improve entity-noise filtering and duplicate consolidation.
4. Add source-backed public contact/work/education/location signal cards.
5. Build the first relationship/knowledge-graph view from existing `candidates`, `related`, and `sources` data.
6. Add investigation history/session state.
7. Add exportable investigation report.
8. Only then consider broader crawl budgets and advanced OSINT modules.

## Development Rule

Do not get stuck in endless isolated search tests. Each test should now validate or improve a product feature. Keep project documentation updated after meaningful milestones so the work can be resumed in a new chat without losing the engineering state.

## Resume Note

**Current engineering milestone: first investigation web UI + bounded name query fan-out implemented. Next task is live browser verification with `Shazzuwan Zakaria`, then signal cards/identity corroboration, relationship graph, and reporting.**
