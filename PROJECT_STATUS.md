# Free OSINT Explorer — Project Status

Last updated: 2026-08-30

## Project Identity

- Current repository/project name: **Free OSINT Explorer**
- Planned future product name: **Silk Stalker** (rename deferred until architecture/UI stabilise)
- Product concept: a free/RM0 where practical, on-demand OSINT discovery and investigation workspace using GitHub + Cloudflare Workers.
- Constraint: no always-running server.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 NAME QUERY FAN-OUT WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      WORKING / REFINEMENT NEEDED
Phase 4  Discovery Intelligence WORKING / IDENTITY RESOLUTION INITIAL
Phase 5  Recursive Crawler      CONTROLLED WORKFLOW / DEPTH 1 TESTED
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       LIVE V2 IMPLEMENTATION / PRODUCTION VERIFICATION IN PROGRESS
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT         FUTURE
Phase 10 Optimization            FUTURE
```

## Infrastructure

- Repository: `ramzulramli/free-osint-explorer`
- Worker: `free-osint-explorer`
- Production Worker: `https://free-osint-explorer.ramzul.workers.dev`
- Main Worker entry point: `src/index.js`
- Investigation engine: `src/investigate.js`
- GitHub → Cloudflare deployment is configured.
- Repository default branch: `main`.
- Active UI development branch: `ui-v2-live-investigation`.

### Latest deployment state

- Latest manually uploaded Worker version during the current UI session: `ec66e829`.
- Its Cloudflare preview URL was successfully reachable.
- The version exposed a working `/investigate` flow in the preview environment.
- Cloudflare production was subsequently promoted to a newer deployment (`6a2db44f`), but production UI verification still showed **`Failed to fetch`**.
- The immediate production problem is therefore deployment/runtime/API connectivity verification, not the basic investigation engine itself.
- Do not mark production UI integration complete until the production Worker endpoint and browser request path are verified end-to-end.

## Current APIs

### `/search`

Uses the shared search-provider abstraction.

Providers:
- DuckDuckGo
- SearXNG

Current behaviour:
- `auto` tries DuckDuckGo first.
- DuckDuckGo bot/challenge responses are detected.
- SearXNG is used as fallback.
- SearXNG results are normalized to `{title,url,snippet}`.
- Search results are scored against the query before being returned.
- Weak results with no query-term evidence are filtered out.
- Compound-name partial matches are scored lower than exact name matches.
- Name-like queries fan out into bounded variants.
- Duplicate URLs are merged and ranked against the original query.
- Provider, attempted-query and variant-count information is returned.

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
7. Extract entities and account candidates.
8. Aggregate evidence and preserve source provenance where available.
9. Score and filter discoveries.

The live investigation response now supplies data consumed by the V2 dashboard, including:
- subject/query;
- confidence signal;
- search provider and result count;
- readable sources;
- ranked person candidates;
- related accounts/entities/locations/organisations;
- investigation statistics and limits.

Status: **WORKING**

## Investigation UI — Current Milestone

The project has moved from the earlier static dashboard concept to a **live investigation UI** on branch `ui-v2-live-investigation`.

Recent UI/deployment commits include:
- `0bf5722` — Add web entry point for live dashboard
- `2474d45` — Deploy live investigation UI from v2 branch
- `1bb6b3c` — Fix UI investigation query parameter
- `1f97ba9` — Update index.js
- `ce3cbbf` — Fix live UI mapping to current investigation API response
- `793fd92` — fix: add CORS wrapper for production API
- `3eb778c` — fix: deploy CORS wrapper as Worker entrypoint

The live dashboard has successfully rendered a real investigation for `Ramzul Mazwan Ramli` in the version preview environment.

Observed live preview result:
- investigation completed;
- confidence signal: 82% under the current model;
- 5 search results;
- 5 pages read;
- 0 failed pages;
- 60 extracted entities;
- 1 surfaced source;
- 1 surfaced account;
- 1 surfaced organisation;
- 2 surfaced locations.

The dashboard currently presents:
- primary subject;
- confidence/match signal;
- evidence/related entities;
- public contact signal area;
- identity signals;
- source list;
- investigation statistics.

Important: confidence is a **match signal**, never proof of identity.

## Current UI Production Blocker

The live preview works, but production verification currently reports **`Failed to fetch`** from the dashboard.

The latest Cloudflare production deployment shown by the user is `6a2db44f`, with 100% traffic but no observed requests immediately after deployment. The version preview itself was reachable and `/investigate` worked.

Next debugging sequence:
1. Test production `/investigate` directly.
2. Inspect browser Network/Console error for the dashboard request.
3. Verify production CORS headers on `/investigate`.
4. Verify the dashboard is calling the exact production API URL/path expected by the current Worker.
5. Verify production and preview use the same Worker entry point and environment bindings.
6. Only after this passes, mark the V2 UI as production-ready.

Do not rewrite the investigation engine merely because the browser reports `Failed to fetch`; first isolate whether the failure is CORS, URL routing, deployment version, or environment configuration.

## Evidence / Identity Quality

The current UI correctly exposes evidence-oriented entities, but the underlying model still needs stronger provenance and corroboration.

Known principles:
- Search relevance and identity resolution are separate layers.
- A high score is not proof of identity.
- Same-name candidates must remain separate unless independently corroborated.
- A person merely mentioned by a source must not automatically be treated as the source owner's identity.
- Public contact channels may be surfaced when explicitly published, but private residential addresses should not be automatically harvested or displayed.

## Recent End-to-End Tests

### `Ramzul Mazwan Ramli`

This is the current primary development test subject. The live dashboard successfully rendered the investigation in preview, including a strong person candidate, account, organisation, location signals and source evidence.

The current result demonstrates that the complete chain can work:

```text
Browser UI → /investigate → search → read → entity extraction → scoring → JSON → dashboard
```

Production still needs the same end-to-end verification because the browser currently reports `Failed to fetch` there.

### Golden identity tests

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

The engine must never merge these people solely because names are similar.

### Other test subjects

- `Fauzi Ariffin`
- `Shazzuwan Zakaria`
- `Ramli Musa`

These tests demonstrated both the usefulness of multi-source discovery and the risk of same-name collisions/noisy page-title extraction.

## Investigation Limits

Current limits remain deliberately conservative:

- Search results: 5
- Pages: 5
- Ranked entities/candidates: bounded by investigation layer
- Search requests: bounded by provider layer
- Maximum recursion depth: 2

**Do not increase crawl budgets yet.**

## Known Issues / Technical Debt

1. Generic page-title fragments can still become person candidates.
2. Entity/account duplicates can appear across different searches.
3. Organisation attribution needs stronger source-level corroboration.
4. Confidence scoring needs calibration; a high score must not imply certainty.
5. Related-person account matches must remain separate unless independently corroborated.
6. Public SearXNG instances remain an availability/quality dependency.
7. Production V2 dashboard currently reports `Failed to fetch`; preview works.
8. Source/evidence provenance is not yet complete for every surfaced entity.
9. Investigation history, graph visualisation and export/reporting are not implemented yet.
10. Extraction does not always distinguish profile ownership from a person merely mentioned by a page.
11. Same-name collisions can still produce highly ranked but incorrect identities.

## Immediate Next Steps

1. **Fix production `Failed to fetch`** by comparing preview vs production `/investigate` and browser CORS/request behaviour.
2. Verify the promoted production version directly before making further UI changes.
3. Complete evidence/source provenance for every surfaced signal.
4. Improve entity-noise filtering.
5. Strengthen identity corroboration using independent evidence dimensions.
6. Run the golden identity investigations and compare false merges/false splits.
7. Build relationship graph v1.
8. Add browser/session investigation history.
9. Add report/export.
10. Only then consider broader crawl budgets and advanced OSINT modules.

## Development Rule

Do not get stuck in endless isolated search tests. Each test must validate or improve a product feature. Keep project documentation updated after meaningful milestones so the work can be resumed in a new chat without losing engineering state.

## Resume Note

**Next session: start with the production `Failed to fetch` issue. The live V2 dashboard and `/investigate` flow are already working in the Worker version preview. First task is to verify the production API directly and inspect the browser request/CORS path. Do not rebuild the UI or investigation engine until the production connectivity problem is isolated.**
