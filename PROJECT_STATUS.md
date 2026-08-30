# Free OSINT Explorer — Project Status

Last updated: 2026-08-30

## Goal

Build a free/RM0 where practical, on-demand OSINT discovery and investigation system using GitHub + Cloudflare Workers. No always-running server.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 NAME QUERY FAN-OUT WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION / ACCOUNT EXTRACTION WORKING
Phase 4  Discovery Intelligence WORKING / REFINEMENT NEEDED
Phase 5  Recursive Crawler      CONTROLLED WORKFLOW / TESTED
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       LIVE WORKER UI IMPLEMENTED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT         FUTURE
Phase 10 Optimization           FUTURE
```

## Infrastructure

- Repository: `ramzulramli/free-osint-explorer`
- Worker: `free-osint-explorer`
- Production: `https://free-osint-explorer.ramzul.workers.dev`
- Main Worker entry point: `src/index.js`
- Investigation implementation: `src/investigate.js`
- GitHub → Cloudflare deployment is configured.

### Deployment note — 2026-08-30

The recent development branch `svgui-v2-live-investigation` went through several Cloudflare versions/builds while fixing Worker response handling. Cloudflare's Version History and Recent Builds are separate concepts: a build can exist without being the active production deployment. The production service may therefore require an explicit **Promote** action when branch/version controls are configured that way.

Important fixes reached `main` in commit `d80b3f9cdb16a8ee20ad8c4beaea399939dfeedb` (`sync: promote live investigation implementation to main`). The latest known main branch commit contains the live investigation implementation.

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
- Name-like queries fan out into bounded variants.
- Duplicate URLs are merged and ranked against the original query.
- Provider, attempted-query and variant-count information is returned.
- SearXNG fallback is bounded to avoid Cloudflare Worker subrequest exhaustion.

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

The API returns investigation subject/query, confidence signal, candidates, accounts, related entities, evidence, sources, query history, failures and bounded execution statistics.

Status: **LIVE / WORKING**

### Investigation UI

The Worker root `/` now serves a live investigation dashboard directly from the Worker. The UI calls `/investigate` and renders the real JSON response rather than static sample data.

Implemented:
- investigation search box;
- Direct search / Follow-up / Deep investigation depth selector;
- loading state;
- error state;
- primary subject card;
- confidence/match signal visualization;
- identity candidates;
- public profile/account signals;
- related organisations, locations and public contact signals;
- evidence trail;
- inspected sources with clickable links;
- investigation statistics;
- responsive layout.

The UI deliberately labels confidence as a **match signal**, not proof of identity.

## Recent End-to-End Tests

### `Fauzi Ariffin`

The live investigation returned a successful structured response. It found an exact-name candidate and several public profile signals including Facebook, Instagram and IMDb. Instagram returned HTTP 429 and LinkedIn returned HTTP 999, demonstrating that the crawler correctly records source failures rather than treating failed pages as evidence.

A later run with evidence-v2 scoring produced a confidence signal of `0.5` / moderate, with the assessment explaining that the name was corroborated but no independent identity attribute was corroborated. This is the desired direction: source count alone should not create false certainty.

### `Shazzuwan Zakaria`

The engine found an exact-name candidate plus useful education/context signals and also exposed noisy person candidates from names mentioned in the same page. This remains a regression test for entity-noise filtering and association attribution.

### `Ramli Musa`

This remains the same-name separation test. A strong-looking public academic identity was found, but it is a different person. The engine must keep search relevance separate from identity resolution and must not merge people solely because names overlap.

## Identity Resolution Golden Test

Known development ground truth:

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

The engine must never merge people solely because names are similar. Identity requires corroborating evidence across independent dimensions.

## Current Test Subjects

```text
Fauzi Ariffin
Shazzuwan Zakaria
Ramli Musa
Ramzul Mazwan bin Ramli
Ramzul Ramli
Ramzulhakim Ramli
```

These are development test subjects. Results must be treated as public-source leads, not proof of identity.

## Known Issues / Technical Debt

1. Generic page-title fragments can still be emitted as `person_candidate` values.
2. Entity/account duplicates can still appear across different searches and need stronger consolidation.
3. Organisation attribution needs stronger source-level corroboration.
4. Confidence scoring is improving but still requires calibration.
5. Related-person account matches must remain separate unless independently corroborated.
6. Public SearXNG instances remain an availability/quality dependency.
7. Source pages can reject automated reads with 429/999/etc.; these failures must remain visible in the investigation record.
8. Investigation UI is live but intentionally minimal; graph visualization, history and reporting are not implemented yet.
9. Public contact details may be extracted when openly published, but private residential addresses should not be automatically harvested or displayed.
10. Current extraction does not distinguish strongly enough between a person who owns/controls a profile and a person merely mentioned by a page.

## Immediate Next Steps — Build, Don't Just Test

1. **Evidence-backed signal cards** — group work, education, public social accounts, broad location and explicitly published public contact channels with source provenance.
2. **Entity-noise filtering** — stop page titles, headings and unrelated names from becoming person candidates.
3. **Identity corroboration** — score independent evidence dimensions separately: name, accounts, organisation, location, education/work overlap, contradictions and source quality.
4. **Relationship graph v1** — connect candidate ↔ account ↔ organisation ↔ location ↔ source.
5. **Investigation history** — persist recent investigations in browser/session without an always-on database.
6. **Report/export** — generate a clean investigation summary with evidence and source links.
7. **Production verification** — run the real Worker UI after each meaningful deployment/promotion.
8. Only then consider broader crawl budgets and advanced OSINT modules.

## Development Rule

Do not get stuck in endless isolated search tests. Each test must validate or improve a product feature. Keep project documentation updated after meaningful milestones so the work can be resumed in a new chat without losing engineering state.

## Resume Note

**Current engineering milestone: live investigation UI and evidence-v2 response are working on main. Next coding milestone: evidence-backed signal cards + stronger entity/identity corroboration, followed by graph, history and reporting. `Ramli Musa` remains a key same-name separation regression test.**
