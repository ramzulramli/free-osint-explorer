# Free OSINT Explorer — Architecture

Last updated: 2026-08-30

## Current Architecture Status

The project uses a shared search-provider abstraction behind `/search` and `/investigate`. DuckDuckGo is attempted first in `auto` mode, with bounded SearXNG fallback. Search results are normalized before downstream processing.

A key finding from testing is that **HTTP 200 + valid JSON does not prove search quality**. The search layer therefore scores results against the query and filters results with insufficient query-term evidence.

SearXNG probing is intentionally bounded because public instances can consume the Cloudflare Worker subrequest budget.

## API Flow

```text
USER / CLIENT
     │
     ▼
Cloudflare Worker
     │
 ┌───┼──────────────┐
 ▼   ▼              ▼
/search /read   /investigate
 │     │              │
 ▼     ▼              ▼
Search Fetch/Read   Seed search
 │     │              │
 ▼     └──────┐       ▼
Provider       │   Controlled pages
abstraction    │       │
 │             └───────┘
 ▼
Normalized search results
 │
 ▼
Search quality / relevance
 │
 ▼
Entity extraction
 │
 ▼
Discovery filtering
 │
 ▼
Controlled queue
 │
 ▼
Bounded recursion
```

## Search Provider Architecture

```text
                 Search request
                       │
                       ▼
                Provider selector
                       │
              ┌────────┴────────┐
              ▼                 ▼
        DuckDuckGo          SearXNG
              │                 │
       bot/challenge      primary + fallback
              │                 │
              └────────┬────────┘
                       ▼
              normalized results
                       │
                       ▼
             quality/relevance check
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
          useful              poor/noisy
             │                   │
             ▼                   ▼
          return            bounded fallback
```

Provider success is two-stage: transport/parser success followed by search-quality success.

For name-like queries, bounded query fan-out improves discovery while compound-name partial matches are deliberately penalized.

## Web Reading Engine

Endpoints: `/fetch`, `/read`.

Responsibilities:
- Validate HTTP/HTTPS URLs.
- Fetch public pages.
- Extract title and readable text.
- Remove common non-content HTML.
- Extract and normalize links.
- Limit output to protect Worker execution.

## Entity Extraction

Initial types:
- Person candidates
- Organisation candidates
- Locations
- URLs
- Usernames/accounts
- Dates
- Years
- Keywords

Processing includes normalization, deduplication, confidence scoring and false-positive filtering.

Recognizable public profile URLs can produce account candidates such as LinkedIn or Shutterstock profiles. Account relevance filtering is applied before final presentation, but account ownership is still an identity-resolution question rather than proof.

Known remaining extraction noise includes generic page-title/UI fragments and names merely mentioned by a page. These must be filtered before deeper identity reasoning.

## Investigation Orchestrator

Endpoint: `/investigate`.

Responsibilities:
1. Accept a seed.
2. Search through the shared provider abstraction.
3. Validate result-set quality.
4. Collect a bounded result set.
5. Read selected pages.
6. Extract page and search-result entities/accounts.
7. Aggregate and score discoveries.
8. Filter metadata/noise.
9. Queue eligible discoveries when recursion is requested.
10. Prevent duplicate query processing.
11. Track budgets and execution history.

Current limits remain conservative, including bounded search results, page reads, search requests, queue items and recursion depth.

## Live Investigation UI

The V2 UI is implemented on branch `ui-v2-live-investigation` and consumes the `/investigate` JSON response.

```text
Browser
  │
  ▼
Live dashboard
  │
  │ GET /investigate?q=<subject>
  ▼
Cloudflare Worker
  │
  ▼
Investigation engine
  │
  ├── search provider
  ├── page reader
  ├── entity/account extraction
  ├── relevance scoring
  └── identity/discovery scoring
  │
  ▼
JSON response
  │
  ▼
Dashboard renderer
```

The dashboard presents:
- primary subject;
- confidence/match signal;
- evidence/related entities;
- accounts/profiles;
- organisations and locations;
- public contact signal area;
- identity signals;
- sources;
- investigation statistics.

The V2 dashboard has been successfully verified against a real investigation in the Worker version preview.

## Production Verification Problem

The Worker version preview for the latest UI deployment was reachable and `/investigate` successfully returned investigation data. However, after promotion to production, the browser UI still reported `Failed to fetch`.

This means production verification is currently a separate engineering problem from the investigation engine.

Debug order:

```text
Production UI
    │
    ├── direct production /investigate test
    │
    ├── browser Network/Console
    │
    ├── CORS response headers
    │
    ├── API URL/path
    │
    ├── Worker entry point/version
    │
    └── environment bindings
```

Do not change the investigation engine until this connectivity path is isolated.

## Identity Resolution Principle

Search relevance and identity resolution are separate layers.

Known development test case:

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

A similar name can be retained as a candidate discovery, but the system must not merge people solely on name similarity. Identity requires corroborating evidence such as usernames, profiles, locations, organisations, education/work overlap, links, dates, source quality and contradictions.

Confidence is a match signal, not proof of identity.

## Evidence Model — Target

Every surfaced discovery should eventually retain:

```text
Entity
  ├── type
  ├── normalized value
  ├── confidence
  ├── supporting evidence[]
  │      ├── source URL
  │      ├── source title
  │      ├── evidence text/context
  │      └── evidence type
  ├── relationships[]
  └── contradictions[]
```

This is required before the project can safely expose a richer knowledge graph or claim strong identity matches.

## Target Architecture

```text
USER
 │
 ▼
Web UI
 │
 ▼
Cloudflare Worker API
 │
 ▼
Investigation Engine
 │
 ├── Search Provider Abstraction
 │      ├── DuckDuckGo
 │      └── SearXNG
 │
 ├── Search Result Quality / Relevance
 ├── Fetch / Read
 ├── Entity Extraction
 ├── Account Extraction
 ├── Identity Resolution
 ├── Evidence / Provenance Model
 ├── Discovery Queue
 ├── Controlled Recursion
 ├── Relationship Engine
 └── Knowledge Graph
          │
          ├── Sources
          ├── Entities
          └── Relationships
```

## Current Investigation Flow

```text
Seed
 │
 ▼
Search providers
 │
 ▼
Raw results
 │
 ▼
Result quality / relevance
 │
 ├── poor → bounded provider fallback
 │
 └── useful
       │
       ▼
   Select top results
       │
       ▼
   Read pages
       │
       ▼
   Extract entities + accounts
       │
       ▼
   Aggregate / score
       │
       ▼
   Filter discoveries
       │
       ▼
   Queue + bounded recursion
       │
       ▼
   JSON response
       │
       ▼
   Live UI
```

## Test Findings

Recent testing established:

1. **Fallback works.** DuckDuckGo bot/challenge responses can trigger SearXNG fallback.
2. **Subrequest exhaustion is real.** Public-provider probing must remain bounded.
3. **Search relevance filtering works for observed cases.** Name searches are better separated from unrelated compound-name results.
4. **Account extraction works for recognizable public profiles.**
5. **False-positive account suppression improved.**
6. **Identity separation remains required.** Similar names must not be merged without corroboration.
7. **Source provenance is incomplete.** Evidence can reference more pages than the current top-level source list exposes.
8. **Confidence calibration is incomplete.** A high model score is not equivalent to certainty.
9. **Live UI rendering works in Worker preview.**
10. **Production UI still has a `Failed to fetch` blocker after promotion.**

## Immediate Architectural Step

The next engineering step is **production connectivity diagnosis**, followed by evidence quality:

- verify production `/investigate` directly;
- isolate CORS/path/version/environment differences;
- preserve source provenance for every entity/account discovery;
- reject generic page-title/UI fragments as person candidates;
- consolidate duplicates across recursion;
- calibrate confidence;
- strengthen identity resolution using independent corroborating signals;
- rerun the golden investigations.

Only after these tests pass should deeper recursion, relationship extraction and the knowledge graph be expanded.
