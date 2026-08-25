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

The relevance layer scores exact phrases, all terms in titles, split title/snippet matches and weaker partial matches. For name-like queries it deliberately reduces the score of compound first-name matches such as `Ramzulhakim` when the query is `Ramzul Ramli`.

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

Account extraction is now implemented for recognizable public profile URLs. Latest testing successfully extracted:
- `Shutterstock: ramzul`
- `LinkedIn: ramzul`

The latest filtering also removed previously observed false-positive Shutterstock accounts for `Ramzul Alam` / `Mohd Ramzul b. Abdul Alam` from the final account summary. This demonstrates that account relevance filtering is improving, but it is not yet a complete identity-resolution system.

Known remaining extraction noise includes generic page-title fragments being emitted as person candidates. These must be filtered before deeper identity reasoning.

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
- `maxPages = 5`
- `maxEntitiesPerSource = 50`
- `maxRankedEntities = 50`
- `maxDiscoveries = 25`
- `maxDepth = 2`
- `maxQueueItems = 5`
- `maxSearchRequests = 5`
- `maxVisitedQueries = 10`

The latest successful investigation reached depth 1 with 5 investigations, 25 pages read, 5 search requests and no skipped searches.

## Latest Investigation Findings

Test query: `Ramzul Mazwan Ramli`

Observed:
- overall confidence: 1.00 under the current scoring model;
- primary full-name candidate: `Ramzul Mazwan bin Ramli`;
- organisation candidates: `Telekom Malaysia`, `United Nations`;
- locations: `Malaysia`, `Selangor`;
- strongly corroborated account: `Shutterstock: ramzul` (0.975, 3 sources);
- LinkedIn account: `ramzul` (0.7083, 1 source).

Important distinction: the score of 1.00 is a model score, **not proof of identity**. Confidence calibration is still required.

The latest result also showed that unrelated account candidates can be suppressed successfully. However, source attribution remains incomplete: the top-level `sources` field currently exposes only the MSTB record while the evidence references LinkedIn and Shutterstock pages as well. The architecture therefore needs a source/evidence model that preserves provenance for every discovery.

`United Nations` is also currently insufficiently attributed in the supplied output and should remain an unverified discovery until supporting source evidence is retained.

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
 ├── Account Extraction
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
```

## Test Findings

Recent testing established these behaviours:

1. **Fallback works.** When DuckDuckGo returned a bot/challenge response, the system successfully moved to SearXNG.
2. **Subrequest exhaustion is a real constraint.** Probing too many public SearXNG instances caused Cloudflare to reject the invocation, so provider probing must remain bounded.
3. **Search relevance filtering works for the observed cases.** `Ramzul Ramli`, `Ramzul Mazwan Ramli`, `Ramzulhakim Ramli` and `Microsoft Windows` produced relevant direct-search result sets.
4. **Account extraction works for the strongest observed profiles.** The latest investigation identifies Shutterstock `ramzul` and LinkedIn `ramzul`.
5. **False-positive account suppression improved.** Earlier unrelated Shutterstock accounts are no longer present in the latest summary.
6. **Identity separation remains required.** `Ramzulhakim Ramli` is a separate known person. It may appear as a weaker compound-name candidate in a broad `Ramzul Ramli` search, but it must not be merged into the test subject without corroborating evidence.
7. **Source provenance is incomplete.** Evidence can reference more pages than the current top-level source list reports.
8. **Confidence calibration is incomplete.** A model score of 1.00 is not equivalent to real-world certainty.

## Immediate Architectural Step

The next engineering step is **not** to increase recursion. It is to improve the evidence model and entity-quality layer:

- preserve source provenance for every entity/account discovery;
- reject generic page-title/UI fragments as person candidates;
- consolidate duplicates across recursion;
- calibrate confidence;
- strengthen identity resolution using independent corroborating signals;
- rerun the three golden investigations.

Only after these tests pass should deeper recursion, relationship extraction and the knowledge graph be expanded.
