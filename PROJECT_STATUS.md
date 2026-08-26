# Free OSINT Explorer — Project Status

Last updated: 2026-08-26

## Goal

Build a free/RM0 where practical, on-demand OSINT discovery and investigation system using GitHub + Cloudflare Workers. No always-running server.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 RELEVANCE VALIDATION WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION / ACCOUNT EXTRACTION WORKING
Phase 4  Discovery Intelligence WORKING / REFINEMENT NEEDED
Phase 5  Recursive Crawler      CONTROLLED WORKFLOW / TESTED TO DEPTH 1
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       PLANNED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT         FUTURE
Phase 10 Optimization           FUTURE
```

## Infrastructure

- Repository: `ramzulramli/free-osint-explorer`
- Worker: `free-osint-explorer`
- Production: `https://free-osint-explorer.ramzul.workers.dev`
- Wrangler entry point: `src/investigate.js`
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

Status: **SEARCH PROVIDER + RELEVANCE VALIDATION WORKING**

### `/fetch` / `/read`

Core web-reading functions remain available internally to the investigation engine. Pages are fetched over HTTP/HTTPS, readable text is extracted, and entity candidates are generated.

Status: **WORKING / core**

### `/investigate`

Controlled investigation workflow:
1. Accept a seed subject/query.
2. Optionally apply explicit user refinements.
3. Search through the shared provider abstraction.
4. Validate result quality.
5. Collect a bounded result set.
6. Read selected pages.
7. Extract entities and account candidates from search metadata and page content.
8. Aggregate evidence and preserve source provenance.
9. Score and filter discoveries.
10. Queue bounded automatic pivot searches.
11. Track query history, parent queries and refinement reasons.
12. Prevent duplicate query processing and enforce budgets.

### Explicit query refinement

A user can now narrow an investigation without starting a completely unrelated investigation.

Example:

```text
/investigate?q=Ramzul%20Ramli&refine=UUM
```

The engine performs the narrower search conceptually as:

```text
"Ramzul Ramli" UUM
```

Multiple refinements are supported:

```text
/investigate?q=Ramzul%20Ramli&refine=UUM&refine=Telekom%20Malaysia
```

The response records:
- original subject;
- effective query;
- parent query;
- refinement text;
- reason for the query;
- query history across the investigation.

This makes manual narrowing an explicit investigation operation rather than merely another crawl.

### Evidence/source provenance

The investigation result now retains source records for discoveries and exposes a `queryHistory` section showing how searches relate to each other.

A discovery can therefore be traced from:

```text
subject
  → query
    → source
      → extracted entity/account
```

This addresses the earlier problem where the evidence set could contain more supporting pages than the top-level `sources` field reported.

## Investigation Limits

Current limits remain deliberately conservative:

- Search results: 5
- Pages: 5
- Entities/source: 50
- Ranked entities: 50
- Discoveries: 25
- Depth: 2
- Queue: 5
- Search requests: 5
- Visited queries: 10

**Do not increase crawl budgets yet.**

## Identity Resolution Golden Test

Known development ground truth:

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

The engine must never merge people solely because names are similar. Search relevance and identity resolution remain separate layers; identity requires corroborating evidence.

## Known Issues / Technical Debt

1. Generic page-title fragments can still be emitted as `person_candidate` values.
2. Entity/account duplicates can still appear across different searches and need stronger consolidation.
3. Organisation attribution needs stronger source-level corroboration.
4. Confidence scoring can reach 1.00 without representing actual certainty; calibration is still required.
5. Related-person account matches must remain separate unless independently corroborated.
6. Public SearXNG instances remain an availability/quality dependency.
7. Live production verification of the new refinement endpoint still needs to be performed after deployment.

## Immediate Next Steps

1. **Run live refinement test:** `Ramzul Ramli` → `Ramzul Ramli UUM`.
2. Re-run the three golden investigations: `Ramzul Ramli`, `Ramzul Mazwan Ramli`, `Ramzulhakim Ramli`.
3. Inspect whether query history and evidence provenance remain correct through automatic pivots.
4. Improve entity-noise filtering further.
5. Consolidate duplicate discoveries across recursion/refinement passes.
6. Calibrate confidence so model scores are clearly distinguished from real-world certainty.
7. Strengthen identity resolution using independent corroborating signals.
8. Only then move toward relationship extraction and the knowledge graph.

## Resume Note

**Current engineering milestone: explicit query refinement + source/query provenance implemented. Next task is live validation against the three golden identity investigations, especially `Ramzul Ramli` → `Ramzul Ramli UUM`.**
