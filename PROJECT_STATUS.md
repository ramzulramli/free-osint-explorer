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
- DuckDuckGo remains unreliable from the Worker because of bot/challenge responses.
- SearXNG fallback works, but individual public instances can fail or return poor/no results and must be treated as untrusted providers.
- Direct relevance filtering successfully removed the earlier generic Microsoft/AppLocker contamination observed during `Ramzul Ramli` testing.
- Full-name and public-name searches now consistently surface the test subject's LinkedIn, Shutterstock and MSTB pages.

Status: **SEARCH PROVIDER + RELEVANCE VALIDATION WORKING**

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
- Pages: 5
- Entities/source: 50
- Ranked entities: 50
- Discoveries: 25
- Depth: 2
- Queue: 5
- Search requests: 5
- Visited queries: 10

### Latest investigation test

Latest successful test query: `Ramzul Mazwan Ramli`

Observed result:
- Overall confidence: **1.00**
- Primary identity: `Ramzul Mazwan bin Ramli` (score 1.00 / 5 sources in summary)
- `Ramzul Mazwan Ramli` also appears as a person candidate (0.6183 / 1 source)
- Organisations: `Telekom Malaysia` (0.6033) and `United Nations` (0.6033)
- Locations: `Malaysia` (0.7567), `Selangor` (0.6233)
- Accounts: `Shutterstock: ramzul` (0.975 / 3 sources), `LinkedIn: ramzul` (0.7083 / 1 source)
- The earlier false-positive Shutterstock accounts `Ramzul Alam` / `Mohd Ramzul b. Abdul Alam` are no longer present in the latest summary, indicating the account filtering improved.
- `Shutterstock: ramzul` is strongly corroborated by three profile/portfolio URLs.
- The result reached depth 1 with 5 investigations, 25 pages read, 5 search requests and no skipped searches.
- `sources` currently exposes the MSTB page as the top source record even though the evidence set contains additional LinkedIn and Shutterstock sources; this is a reporting/data-shape issue to improve later.

Important caveat:
- `United Nations` appears as an organisation candidate in the latest result, but the supplied evidence excerpt does not show its supporting source. It should therefore be treated as an unverified discovery until source attribution is preserved and inspected.
- Confidence `1.00` currently reflects the scoring model, not proof of real-world identity. It must not be interpreted as certainty.

## Identity-resolution golden test

Known ground truth for development:
- `Ramzul Mazwan bin Ramli` = full name of the test subject.
- `Ramzul Ramli` = common/public name used on Facebook and other services by the test subject.
- `Ramzulhakim Ramli` = a different person known online.

The engine must never merge people solely because names are similar. Search relevance and identity resolution are separate layers; identity requires corroborating evidence.

## Current Position

```text
Phase 0  Infrastructure         COMPLETE
Phase 1  Search                 RELEVANCE VALIDATION WORKING
Phase 2  Web Reading            COMPLETE (core)
Phase 3  Entity Extraction      INITIAL IMPLEMENTATION / ACCOUNT EXTRACTION WORKING
Phase 4  Discovery Intelligence WORKING / REFINEMENT NEEDED
Phase 5  Recursive Crawler      CONTROLLED INITIAL WORKFLOW / TESTED TO DEPTH 1
Phase 6  Knowledge Graph        PLANNED
Phase 7  Investigation UI       PLANNED
Phase 8  Reporting              PLANNED
Phase 9  Advanced OSINT         FUTURE
Phase 10 Optimization           FUTURE
```

## Known Issues / Technical Debt

1. Generic page-title fragments can still be emitted as `person_candidate` values (`Certified Tester`, `Certification Number`, `Stock Video Portfolio`, etc.).
2. Entity and account discoveries can be duplicated across recursion passes and should be consolidated more cleanly.
3. Organisation attribution needs stronger source-level corroboration.
4. The `sources` top-level field does not yet represent every source contributing to the evidence set.
5. Confidence scoring can reach 1.00 without representing actual certainty; scoring needs calibration.
6. Related-person account matches must remain separate unless independently corroborated.
7. Public SearXNG instances remain an availability/quality dependency.

## Immediate Next Steps

1. Fix evidence/source attribution so every discovery has inspectable supporting sources.
2. Improve entity extraction to reject page-title/UI fragments and generic nouns as people.
3. Consolidate duplicate discoveries across recursion.
4. Calibrate confidence scoring so 1.00 is not misleading.
5. Strengthen identity resolution using corroborating evidence across name, profile, organisation, location and account signals.
6. Re-run the three golden investigations: `Ramzul Ramli`, `Ramzul Mazwan Ramli`, `Ramzulhakim Ramli`.
7. Only then increase recursion depth/budgets.

Do not increase crawl budgets yet.

## Resume Note

**Next engineering task: improve evidence/source attribution and entity-noise filtering, then rerun the identity-resolution golden tests.**
