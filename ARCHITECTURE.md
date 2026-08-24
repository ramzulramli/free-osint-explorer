# Free OSINT Explorer — Architecture

Last updated: 2026-08-25

## Current Architecture Status

The project uses a shared search-provider abstraction behind `/search` and `/investigate`. DuckDuckGo is attempted first in `auto` mode, with bounded SearXNG fallback. Search results are normalized before downstream processing.

A key finding from testing was that **HTTP 200 + valid JSON does not prove search quality**. A public SearXNG instance previously returned unrelated Microsoft/Windows/AppLocker pages for `Ramzul Ramli`. The search layer now scores results against the query and filters results with no query-term evidence.

Five sequential public SearXNG instance requests exhausted the Cloudflare Worker subrequest budget. SearXNG probing is therefore intentionally bounded to a primary instance plus at most one fallback.

## API Flow

```text
USER / CLIENT
     │
     ▼
Cloudflare Worker API
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
Search-result quality / relevance validation
 │
 ▼
Entity extraction
 │
 ▼
Relevance / discovery filtering
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
       bot/challenge      primary + one fallback
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

DuckDuckGo currently often produces a bot/challenge response from the Worker. SearXNG fallback works, but public instances are not guaranteed to return relevant results.

The current relevance layer scores exact phrases, all terms in titles, split title/snippet matches and weaker partial matches. For name-like queries it deliberately reduces the score of compound first-name matches such as `Ramzulhakim` when the query is `Ramzul Ramli`.

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
- Usernames
- Dates
- Years
- Keywords

Processing includes normalization, deduplication, basic confidence and false-positive filtering.

Search-result titles/snippets can also provide evidence when a target page cannot be fetched.

This remains heuristic extraction, not full NLP/NER. Generic words from unrelated pages must not become strong discoveries merely because they occur repeatedly. Search-quality validation now precedes downstream entity extraction.

## Investigation Orchestrator

Endpoint: `/investigate`.

Responsibilities:
1. Accept a seed.
2. Search through the shared provider abstraction.
3. Validate result-set quality.
4. Collect a bounded result set.
5. Read selected pages.
6. Extract page and search-result entities.
7. Aggregate and score discoveries.
8. Filter metadata/noise.
9. Queue eligible discoveries when recursion is requested.
10. Prevent duplicate query processing.
11. Track budgets and execution history.

Current limits:
- `maxSearchResults = 5`
- `maxPages = 3`
- `maxEntitiesPerSource = 50`
- `maxRankedEntities = 50`
- `maxDiscoveries = 25`
- `maxDepth = 2`
- `maxQueueItems = 5`
- `maxSearchRequests = 5`
- `maxVisitedQueries = 10`

Do not increase these budgets until the investigation golden tests pass.

## Identity Resolution Principle

Search relevance and identity resolution are separate layers.

Known development test case:

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

A similar name can be retained as a candidate discovery, but the system must not merge people solely on name similarity. Identity requires corroborating evidence such as usernames, profiles, locations, organisations, links, dates or other independent signals.

The `Ramzul Ramli` test is specifically intended to expose this distinction.

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
 ├── Search Result Quality / Relevance Engine
 │
 ├── Fetch / Read
 │
 ├── Entity Extraction
 │
 ├── Identity Resolution
 │
 ├── Discovery Queue
 │
 ├── Controlled Recursion
 │
 ├── Relationship Engine
 │
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
   Extract entities
       │
       ▼
   Aggregate / score
       │
       ▼
   Filter discoveries
       │
       ▼
   Queue + bounded recursion
```

## Test Findings

Recent testing established four important behaviours:

1. **Fallback works.** When DuckDuckGo returned a bot/challenge response, the system successfully moved to SearXNG.
2. **Subrequest exhaustion is a real constraint.** Probing too many public SearXNG instances caused Cloudflare to reject the invocation, so provider probing must remain bounded.
3. **Search relevance filtering works for the observed cases.** `Ramzul Ramli`, `Ramzul Mazwan Ramli`, `Ramzulhakim Ramli` and `Microsoft Windows` all produced relevant result sets in the latest direct tests.
4. **Identity separation remains required.** `Ramzulhakim Ramli` is a separate known person. It may appear as a weaker compound-name candidate in a broad `Ramzul Ramli` search, but it must not be merged into the test subject without corroborating evidence.

## Immediate Architectural Step

The next step is no longer direct `/search` debugging. It is **retesting `/investigate` with the golden identity cases**.

The investigation tests should verify that:
- irrelevant Microsoft/AppLocker pages no longer contaminate discoveries;
- generic terms such as `control`, `windows` and `policy` do not dominate a personal investigation;
- `Ramzul Mazwan Ramli` can be connected as a possible full-name form of `Ramzul Ramli` only through evidence;
- `Ramzulhakim Ramli` remains a separate candidate/person;
- recursion remains within the existing resource budgets.

Only after these tests pass should deeper identity resolution, relationship extraction and recursive discovery be expanded.
