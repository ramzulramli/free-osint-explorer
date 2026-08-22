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

The current implementation includes search, webpage reading, initial entity extraction, and an `/investigate` orchestration endpoint.

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
 DuckDuckGo       Fetch webpage     Seed query
       │               │                │
       ▼               ▼                ▼
 Search results   Clean readable     Run search
                  text + links            │
                       │                  ▼
                       ▼            Select controlled
                Entity extraction    initial results
                       │                  │
                       └──────────┬───────┘
                                  ▼
                         Aggregate entities
                                  │
                                  ▼
                       Investigation response
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
- Dates
- Years
- Repeated keywords

Processing:

- Normalize values.
- Remove duplicates.
- Apply basic confidence values.
- Apply simple false-positive filtering.

This is heuristic extraction, not yet a full NLP or named-entity-recognition engine.

## Investigation Orchestrator

Endpoint: `/investigate`

Current responsibilities:

1. Accept a seed query.
2. Execute a web search.
3. Collect initial results.
4. Read a controlled number of pages.
5. Extract entities from each page.
6. Aggregate discoveries.
7. Prevent basic duplicate processing.
8. Return sources, pages and discovered entities in one investigation response.

The endpoint is intentionally limited. It is not yet an unrestricted recursive crawler.

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
          └──────────┼──────────┘
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
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Sources    Entities   Relations
          │          │          │
          └──────────┼──────────┘
                     ▼
              Report Generator
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Summary    Timeline    Mind Map
                     │
                     ▼
                  PDF
```

---

# 5. Execution Model

The system is designed to remain controlled and on-demand.

Future investigation runs should use explicit limits such as:

- Maximum search results
- Maximum pages read
- Maximum recursion depth
- Maximum entities retained
- Maximum generated queries
- Relevance threshold
- Domain allow/block controls
- Worker execution budget

The investigation pipeline should prioritize high-value discoveries rather than recursively processing everything.

---

# 6. Next Architectural Step

The next layer after the initial `/investigate` workflow is Discovery Intelligence:

```text
Extracted Entities
       │
       ▼
Normalization
       │
       ▼
Relevance Scoring
       │
       ▼
Entity Ranking
       │
       ▼
Discovery Queue
       │
       ▼
Controlled Next Search / Read
```

Only after this controlled queue exists should deeper recursive crawling be added.
