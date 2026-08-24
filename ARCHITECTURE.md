# Free OSINT Explorer — Architecture

## 1. Overview

Free OSINT Explorer is an on-demand web investigation system. A seed can be a person, organisation, company, website, username, location, topic or keyword.

The system searches public sources, reads webpages, extracts entities, scores discoveries and progressively investigates relevant discoveries under explicit resource limits.

Design goals:
- RM0/free where realistically possible
- On-demand execution
- No always-running server
- Cloudflare Workers
- GitHub-based deployment

## 2. Current API Flow

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

## 3. Search Provider Architecture

`/search` and `/investigate` use the same provider abstraction.

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
              │          primary + one fallback
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

Important design rule: **HTTP 200 and valid JSON do not prove that a search response is useful.** A public SearXNG instance has already returned completely unrelated Microsoft/Windows/Outlook results for `Ramzul Ramli`. The search layer therefore needs result-quality validation before downstream crawling consumes the results.

Another design rule: SearXNG probing must remain bounded. Five sequential public-instance requests exhausted the Cloudflare Worker subrequest budget. The implementation was changed to a primary instance plus at most one fallback.

## 4. Web Reading Engine

Endpoints: `/fetch`, `/read`.

Responsibilities:
- Validate HTTP/HTTPS URLs.
- Fetch public pages.
- Extract title and readable text.
- Remove common non-content HTML.
- Extract and normalize links.
- Limit output to protect Worker execution.

## 5. Entity Extraction

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

This remains heuristic extraction, not full NLP/NER.

## 6. Investigation Orchestrator

Endpoint: `/investigate`.

Responsibilities:
1. Accept a seed.
2. Search through the shared provider abstraction.
3. Collect a bounded result set.
4. Read selected pages.
5. Extract page and search-result entities.
6. Aggregate and score discoveries.
7. Filter metadata/noise.
8. Queue eligible discoveries when recursion is requested.
9. Prevent duplicate query processing.
10. Track budgets and execution history.

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

Do not increase these budgets while search quality is unstable.

## 7. Identity Resolution Principle

Search relevance and identity resolution are separate layers.

Known development test case:

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

A similar name can be retained as a candidate discovery, but the system must not merge people solely on name similarity. Identity requires corroborating evidence such as usernames, profiles, locations, organisations, links, dates or other independent signals.

## 8. Target Architecture

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
 ├── Fetch / Read
 │
 ├── Entity Extraction
 │
 ├── Search Result Quality / Relevance Engine
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

## 9. Execution Model

Every investigation is explicitly bounded by search-result, page, entity, recursion, queue, request and visited-query limits. The system prioritizes high-value discoveries instead of recursively processing everything.

## 10. Current Investigation Flow

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

## 11. Immediate Architectural Step

The immediate engineering task is **search-result quality/relevance validation in `src/search.js`**.

The goal is to reject obviously unrelated result sets while preserving useful partial-name/alias matches. For example, a search for `Ramzul Ramli` should allow `Ramzul Mazwan Ramli` as a potentially relevant result, but must not automatically equate `Ramzulhakim Ramli` with the same person.

Only after direct `/search` quality is stable should deeper recursive investigation, identity resolution and relationship extraction be expanded.
