# Free OSINT Explorer — Project Status

Last updated: 2026-08-27

## Project Identity

- Current repository/project name: **Free OSINT Explorer**
- Planned future product name: **Silk Stalker** (rename deferred until the architecture and UI stabilize)
- Product concept: a free/RM0 where practical, on-demand OSINT discovery and investigation workspace using GitHub + Cloudflare Workers.
- Constraint: no always-running server.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 NAME QUERY FAN-OUT WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION / ACCOUNT EXTRACTION WORKING
Phase 4  Discovery Intelligence WORKING / REFINEMENT NEEDED
Phase 5  Recursive Crawler      CONTROLLED WORKFLOW / TESTED TO DEPTH 1
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       FIRST STATIC WEB UI IMPLEMENTED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT         FUTURE
Phase 10 Optimization           FUTURE
```

## Infrastructure

- Repository: `ramzulramli/free-osint-explorer`
- Worker: `free-osint-explorer`
- Production Worker: `https://free-osint-explorer.ramzul.workers.dev`
- Wrangler entry point: `src/investigate.js` (legacy/current investigation module reference)
- Main Worker entry point: `src/index.js`
- GitHub → Cloudflare deployment is configured.
- Repository default branch: `main`.
- UI work currently lives on branch `ui-v1-dashboard`.

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
- Name-like queries fan out into up to five bounded variants: original name, quoted exact name, `bin` form, `b.` form, and reversed order for two-token names; longer names also get compact/bin/binti-normalised variants where appropriate.
- Duplicate URLs from variants are merged and ranked against the original query.
- Provider, attempted-query and variant-count information is returned.
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
8. Aggregate evidence and preserve source provenance where currently available.
9. Score and filter discoveries.

Current API response includes:
- investigation subject/query and confidence signal;
- search provider and result count;
- readable source list;
- ranked person candidates;
- related entities/accounts/locations;
- investigation statistics and limits.

## Investigation UI — Current Milestone

A first polished static dashboard preview has been implemented on branch `ui-v1-dashboard`.

Commit: `ac9d320` — `Add first polished investigation dashboard UI preview`

File:
- `ui-preview.html`

The preview contains:
- Free OSINT Explorer branding and system status;
- investigation search box with `Ramli Musa` sample data;
- primary subject card;
- confidence/match signal visualization;
- source/account/organisation/location statistics;
- evidence graph-style signal list;
- public contact signal section with masked values;
- identity signal panel;
- source list;
- investigation statistics;
- responsive layout for smaller screens.

Important: **this is currently a static UI preview, not yet connected to `/investigate`.** The HTML intentionally uses hardcoded sample values so the visual direction can be evaluated first.

The preview was successfully opened locally after saving the HTML as a real `.html` file. Earlier HTML-preview hosting was confusing because it displayed source rather than a rendered application; local browser rendering is the reliable current UI check.

## UI Design Direction

The intended product flow is:

```text
Search subject
      ↓
Investigation
      ↓
Possible identity
      ↓
Why this matched
      ↓
Public profiles / work / education / location / other signals
      ↓
Evidence + source provenance
```

The UI should treat confidence as a **match signal**, never as proof of identity.

The next UI implementation should replace hardcoded values with data from the real `/investigate` JSON response.

Planned signal groups:
- Possible identity
- Why this matched
- Public profiles
- Work & education
- Location signals
- Other public signals
- Sources

## Recent End-to-End Tests

### `Fauzi Ariffin`

The engine found a strong exact-name candidate across Facebook, Instagram and IMDb, while retaining `Mohd Fauzi Ariffin` separately. This validates name fan-out and candidate separation, but also shows that multi-source hits do not necessarily mean the same person.

### `Shazzuwan Zakaria`

The engine found an exact-name candidate plus an education-related long-form source and useful broad context such as Malaysia/Selangor, education/cikgu terminology and Mathematics/Bahasa references. It also exposed noisy person candidates from names mentioned on the same page and a separate `Shazwan Zakaria` spelling variant.

### `Ramli Musa`

This was the latest test subject used to validate the UI sample and expose the common-name problem. The returned investigation identified a strong-looking `Ramli Musa` / `Prof Dr Ramli Musa` candidate backed by a personal site, ResearchGate and LinkedIn search results, plus related organisation/location/contact signals.

Important identity-resolution lesson: **the result is not proof that the discovered Prof Dr Ramli Musa is the user's father.** The user's father is 70+ and a former teacher, while the discovered public identity is a different person with a strong online academic/psychiatry footprint. This is exactly the type of same-name collision the product must handle safely.

The current `Ramli Musa` output also demonstrated a major extraction-quality problem: page-title fragments such as `Ramli Musa Gender`, `Negeri Sembilan Musa`, and `Dr Ramli Musa Knowledge` were emitted as person candidates. These must be filtered before they are presented as meaningful people.

## Investigation Limits

Current limits remain deliberately conservative:

- Search results: 5
- Pages: 3 for the current `/investigate` path
- Ranked people: 10
- Related signals: 15
- Search requests: bounded by provider layer
- Name query variants: maximum 5

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
Ramzul Mazwan bin Ramli
Ramzul Ramli
Ramzulhakim Ramli
Fauzi Ariffin
Shazzuwan Zakaria
Ramli Musa
```

These are development test subjects. Results must be treated as public-source leads, not proof of identity.

## Known Issues / Technical Debt

1. Generic page-title fragments can still be emitted as `person_candidate` values.
2. Entity/account duplicates can still appear across different searches and need stronger consolidation.
3. Organisation attribution needs stronger source-level corroboration.
4. Confidence scoring can reach high values without representing actual certainty; calibration is still required.
5. Related-person account matches must remain separate unless independently corroborated.
6. Public SearXNG instances remain an availability/quality dependency.
7. The current UI is static and is not yet wired to live `/investigate` JSON.
8. Investigation history, graph visualization and export/reporting are not implemented yet.
9. Public contact details may be extracted when openly published, but private residential addresses should not be automatically harvested or displayed.
10. Current extraction does not distinguish strongly enough between a person who owns/controls a profile and a person merely mentioned by a page.
11. Same-name collisions such as `Ramli Musa` can produce a highly ranked but wrong identity; corroboration must be independent of name alone.

## Immediate Next Steps — Build, Don't Just Test

1. **Connect the UI to `/investigate`** — replace hardcoded dashboard values with live JSON rendering.
2. **Evidence-backed signal cards** — work, education, public social accounts, broad location and explicitly published public contact channels, each with source provenance.
3. **Entity-noise filtering** — stop page titles, headings and unrelated names from becoming person candidates.
4. **Identity corroboration** — score independent evidence dimensions separately: name, accounts, organisation, location, education/work overlap, contradictions and source quality.
5. **Relationship graph v1** — connect candidate ↔ account ↔ organisation ↔ location ↔ source using existing data.
6. **Investigation history** — persist recent investigations in the browser/session without requiring an always-on database.
7. **Report/export** — generate a clean investigation summary with evidence and source links.
8. **Production verification** — run the real Worker UI after each meaningful deployment.
9. Only then consider broader crawl budgets and advanced OSINT modules.

## Development Rule

Do not get stuck in endless isolated search tests. Each test must validate or improve a product feature. Keep project documentation updated after meaningful milestones so the work can be resumed in a new chat without losing the engineering state.

## Resume Note

**Next session: continue from the static dashboard on `ui-v1-dashboard`. First coding task: create the UI's dynamic data layer, call `/investigate`, render the returned JSON into the dashboard, and verify the real Worker flow with `Ramli Musa`. After that, implement evidence-backed signal cards and stronger entity/identity corroboration. Keep the final product rename `Silk Stalker` deferred until the structure is stable.**
