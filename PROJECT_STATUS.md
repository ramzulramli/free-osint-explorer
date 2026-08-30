# Free OSINT Explorer — Project Status

Last updated: 2026-08-31

## Goal

Build a free/RM0 where practical, on-demand OSINT discovery and investigation system using GitHub + Cloudflare Workers. No always-running server.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 NAME QUERY FAN-OUT WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION / ACCOUNT EXTRACTION WORKING
Phase 4  Discovery Intelligence WORKING / REFINEMENT NEEDED
Phase 5  Recursive Crawler       CONTROLLED WORKFLOW / TESTED TO DEPTH 1
Phase 6  Knowledge Graph         PLANNED
Phase 7  Investigation UI        EVIDENCE-V2 BACKEND + FIRST WEB UI IMPLEMENTED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT          FUTURE
Phase 10 Optimization           FUTURE
```

## Infrastructure

- Repository: `ramzulramli/free-osint-explorer`
- Development branch: `ui-v2-live-investigation`
- Worker: `free-osint-explorer`
- Production: `https://free-osint-explorer.ramzul.workers.dev`
- Wrangler entry point: `src/investigate.js` (current investigation/UI module reference)
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
- Name-like queries fan out into bounded variants and duplicate URLs are merged/ranked.
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
9. Score discoveries with evidence-v2 identity assessment.

Current API response includes:
- investigation subject/query and confidence signal;
- candidate assessment with confidence level and reasons;
- discovered accounts and other signal categories;
- readable and failed source information;
- evidence items with source provenance;
- query history;
- investigation statistics and limits.

### Investigation UI

The Worker root `/` serves a usable web interface directly from the Worker. The current UI provides:
- investigation search box;
- loading state;
- possible identity card;
- alternative candidates;
- confidence signal visualization;
- related signals;
- sources read with clickable links;
- basic investigation statistics;
- responsive mobile layout.

**Next UI milestone: M6 Evidence UI** — expose the backend's assessment reasons, signal categories and source/read state as explicit evidence cards without implying that discovery equals proof of ownership.

## Recent End-to-End Tests

### `Fauzi Ariffin`

Current live investigation returned an exact-name candidate with confidence `0.5` / `moderate`. Five distinct search sources were discovered; three were successfully readable and two were blocked (Instagram HTTP 429 and LinkedIn HTTP 999). No independent identity attribute was corroborated. This is the expected direction for evidence-v2: source count alone does not create high identity confidence.

The response also exposes four discovered social accounts separately from the candidate's corroborated identity attributes. These accounts must not be presented as proven ownership without independent corroboration.

### `Shazzuwan Zakaria`

The engine found an exact-name candidate plus an education-related long-form source and useful broad context such as Malaysia/Selangor, education/cikgu terminology and Mathematics/Bahasa references. It also exposed noisy person candidates from names mentioned on the same page and a separate `Shazwan Zakaria` spelling variant.

### `Ramli Musa`

Selected as the next identity-resolution test subject. The purpose of this test is to validate expanded Malaysian-name query variants and whether the engine can keep multiple people with the same/common name separated rather than treating search-result volume as identity proof.

**Conclusion:** the next product step is source-attributed evidence presentation and stronger identity corroboration, not simply increasing search volume.

Persistent test details are kept in `TEST_NOTES.md`.

## Investigation Limits

Current limits remain deliberately conservative:

- Search results: 5
- Pages: 5 for current investigation workflow
- Ranked people: 10
- Related signals: 15
- Search requests: bounded by provider layer
- Name query variants: bounded
- Maximum investigation depth: 2

**Do not increase crawl budgets yet.**

## Identity Resolution Golden Test

Known development ground truth:

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

The engine must never merge people solely because names are similar. Search relevance and identity resolution remain separate layers; identity requires corroborating evidence.

## Current Test Subjects

```text
Fauzi Ariffin
Shazzuwan Zakaria
Ramli Musa  <-- next pending live verification
```

These are development test subjects. Results must be treated as public-source leads, not proof of identity.

## Known Issues / Technical Debt

1. Generic page-title fragments can still be emitted as `person_candidate` values.
2. Entity/account duplicates can still appear across different searches and need stronger consolidation.
3. Organisation attribution needs stronger source-level corroboration.
4. Confidence scoring needs further calibration against known identity ground truth.
5. Related-person account matches must remain separate unless independently corroborated.
6. Public SearXNG instances remain an availability/quality dependency.
7. Live production verification of the current UI is still required after each meaningful deployment.
8. The current UI is intentionally minimal; evidence cards, investigation history, graph visualization and export/reporting are not fully implemented yet.
9. Public contact details may be extracted when openly published, but private residential addresses should not be automatically harvested or displayed.
10. Current extraction does not distinguish strongly enough between a person who owns/controls a profile and a person merely mentioned by a page.

## Immediate Next Steps — Build, Don't Just Test

1. **Evidence-backed signal cards** — work, education, public social accounts, broad location and explicitly published public contact channels, each with source provenance.
2. **Entity-noise filtering** — stop page titles, headings and unrelated names from becoming person candidates.
3. **Identity corroboration** — score independent evidence dimensions separately: name, accounts, organisation, location, education/work overlap, contradictions and source quality.
4. **Relationship graph v1** — connect candidate ↔ account ↔ organisation ↔ location ↔ source using existing data.
5. **Investigation history** — persist recent investigations in the browser/session without requiring an always-on database.
6. **Report/export** — generate a clean investigation summary with evidence and source links.
7. **Production verification** — run the real Worker UI after each meaningful deployment.
8. Only then consider broader crawl budgets and advanced OSINT modules.

## Development Rule

Do not get stuck in endless isolated search tests. Each test must validate or improve a product feature. Keep project documentation updated after meaningful milestones so the work can be resumed in a new chat without losing the engineering state.

## Resume Note

**Current engineering milestone: evidence-v2 scoring is working and has been validated with `Fauzi Ariffin`. Next coding milestone: M6 evidence-backed signal cards + explicit corroboration state, followed by graph and reporting. `Ramli Musa` remains the pending identity-resolution verification test.**
