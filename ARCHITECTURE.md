# Free OSINT Explorer — Architecture

## 1. Overview

Free OSINT Explorer is an on-demand web investigation system.

The system accepts a seed such as:

- Person
- Organisation
- Company
- Website
- Username
- Location
- Topic
- Keyword

It searches public sources, reads webpages, extracts entities and relationships, aggregates discoveries, and progressively investigates the most relevant discoveries under controlled limits.

The current implementation includes search, webpage reading, initial entity extraction, relevance scoring, a controlled discovery queue, and an `/investigate` orchestration endpoint.

The system is designed for:

- RM0 / free operation where realistically possible
- On-demand execution
- No always-running server
- Browser-based development
- Cloudflare Workers
- GitHub-based deployment

---

# 2. Current API Flow

```text
                 USER / CLIENT
                       │
                       ▼
               ┌───────────────┐
               │ Cloudflare    │
               │ Worker API    │
               └───────┬───────┘
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   /search          /read            /investigate
       │               │                │
       ▼               ▼                ▼
 Search provider   Fetch webpage     Seed query
       │               │                │
       ▼               ▼                ▼
 Search results   Clean readable     Controlled search
                  text + links            │
                       │                  ▼
                       ▼             Read selected pages
                Entity extraction         │
                       │                  ▼
                       └──────────┬───────┘
                                  ▼
                         Aggregate entities
                                  │
                                  ▼
                          Relevance scoring
                                  │
                                  ▼
                         Discovery filtering
                                  │
                                  ▼
                           Discovery queue
                                  │
                                  ▼
                       Controlled recursion
```

---

# 3. Current Components

## Search Engine

Endpoint: `/search`

Current provider: DuckDuckGo HTML search.

Responsibilities:

- Submit search queries.
- Parse result blocks.
- Extract title, URL and snippet.
- Decode redirect URLs.
- Filter obvious advertisements.
- Remove duplicate URLs.
- Detect bot/challenge responses.
- Attempt a fallback DuckDuckGo parsing path where appropriate.

Important limitation:

DuckDuckGo may return a bot/challenge response from Cloudflare Workers. The system now reports this explicitly instead of silently converting it to an empty result set.

Planned architecture:

```text
Search Provider Abstraction
        │
   ┌────┴────┐
   ▼         ▼
 DuckDuckGo SearXNG
   │         │
   └────┬────┘
        ▼
 Normalized Search Results
```

A SearXNG fallback should be configurable rather than hard-coding a public instance.

## Web Reading Engine

Endpoints: `/fetch`, `/read`

Responsibilities:

- Validate HTTP/HTTPS URLs.
- Fetch public webpages.
- Extract page title.
- Remove common non-content HTML.
- Convert HTML into readable text.
- Extract and normalize hyperlinks.
- Limit output size to protect Worker execution.

## Entity Extraction Engine

Currently integrated into page reading.

Initial entity types:

- Person candidates
- Organisation candidates
- Location candidates
- URLs
- Usernames
- Dates
- Years
- Repeated keywords

Processing:

- Normalize values.
- Remove duplicates.
- Apply basic confidence values.
- Apply false-positive filtering.

This is heuristic extraction, not yet a full NLP or named-entity-recognition engine.

## Investigation Orchestrator

Endpoint: `/investigate`

Current responsibilities:

1. Accept a seed query.
2. Execute a web search through shared search functions.
3. Collect initial results.
4. Read a controlled number of pages.
5. Extract entities from each page.
6. Aggregate discoveries.
7. Score and rank entities.
8. Filter metadata and obvious discovery noise.
9. Build a controlled queue when a recursion depth greater than zero is requested.
10. Prevent duplicate query processing.
11. Return sources, entities, discoveries, queue state and investigation history.

The endpoint is intentionally limited. It is a controlled recursive workflow, not an unrestricted crawler.

Current limits:

- `maxSearchResults = 5`
- `maxPages = 5`
- `maxEntitiesPerSource = 50`
- `maxRankedEntities = 50`
- `maxDiscoveries = 25`
- `maxDepth = 2`
- `maxQueueItems = 10`
- `maxSearchRequests = 10`
- `maxVisitedQueries = 20`

---

# 4. Target Architecture

```text
                    USER
                     │
                     ▼
              ┌─────────────┐
              │ Web UI      │
              │ Investigation│
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │ Cloudflare  │
              │ Worker API  │
              └──────┬──────┘
                     │
                     ▼
             Investigation Engine
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Search      Fetch       Read
          │          │          │
          │          └──────────┘
          ▼
    Provider Abstraction
          │
     ┌────┴────┐
     ▼         ▼
    DDG      SearXNG
     │         │
     └────┬────┘
          ▼
     Search Results
          │
          ▼
   Entity Extraction
          │
          ▼
   Relevance Engine
          │
          ▼
   Discovery Queue
          │
          ▼
 Controlled Recursion
          │
          ▼
 Relationship Engine
          │
          ▼
 Knowledge Graph
          │
     ┌────┼────┐
     ▼    ▼    ▼
 Sources Entities Relations
          │
          ▼
   Report Generator
          │
     ┌────┼────┐
     ▼    ▼    ▼
 Summary Timeline Mind Map
          │
          ▼
         PDF
```

---

# 5. Execution Model

The system is designed to remain controlled and on-demand.

Every investigation run uses explicit limits such as:

- Maximum search results
- Maximum pages read
- Maximum recursion depth
- Maximum entities retained
- Maximum generated/follow-up queries
- Maximum queue size
- Maximum total search requests
- Maximum visited queries
- Relevance filtering
- Domain controls (future)
- Worker execution budget

The investigation pipeline prioritizes high-value discoveries rather than recursively processing everything.

The queue records parent query, depth, visited queries, search-request count, page count and remaining queue size so investigation growth is observable and bounded.

---

# 6. Current Investigation Flow

```text
Seed Query
    │
    ▼
Search Provider
    │
    ▼
Top 5 Results
    │
    ▼
Read up to 5 Pages
    │
    ▼
Extract Entities
    │
    ▼
Aggregate / Deduplicate
    │
    ▼
Score + Rank
    │
    ▼
Filter Useful Discoveries
    │
    ▼
Depth Limit Reached?
   / \
 yes  no
  │     │
  │     ▼
  │  Queue Discoveries
  │     │
  │     ▼
  │  Follow-up Search
  │     │
  └─────┘
```

Recursive execution must stop when any configured budget is exhausted.

---

# 7. Next Architectural Step

The immediate next layer is **Search Provider Abstraction + Free Fallback**.

The current DuckDuckGo implementation has proven functional but can be challenged by the provider when called from Cloudflare Workers. This is now an explicit provider limitation rather than a parser ambiguity.

The next design should support:

```text
Provider Selection
       │
       ├── auto
       │     ├── DuckDuckGo
       │     └── SearXNG fallback
       │
       ├── duckduckgo
       │
       └── searxng
```

The SearXNG endpoint should be supplied through configuration rather than embedded in source code.

Only after provider reliability is restored should deeper recursive investigation and relationship extraction be expanded.
