# Free OSINT Explorer — Roadmap

## Phase 0 — Infrastructure

Status: COMPLETE

- [x] GitHub repository
- [x] Cloudflare Worker
- [x] GitHub → Cloudflare deployment
- [x] Production Worker URL
- [x] Browser-based development

## Phase 1 — Search

Status: PROVIDER FALLBACK WORKING / SEARCH QUALITY BLOCKER

- [x] `/search`
- [x] DuckDuckGo provider
- [x] Search parsing
- [x] URL decoding
- [x] Advertisement filtering
- [x] Duplicate removal
- [x] Bot/challenge detection
- [x] Explicit provider failure reporting
- [x] Search provider abstraction
- [x] SearXNG integration
- [x] DuckDuckGo → SearXNG automatic fallback
- [x] Bounded SearXNG fallback to protect Worker subrequests
- [ ] Search-result quality/relevance validation
- [ ] Validate multiple SearXNG instances for quality
- [ ] Search result ranking

Current blocker: public SearXNG instances can return valid JSON with irrelevant results. The next task is to detect poor-quality result sets before returning them and use a bounded fallback when appropriate.

## Phase 2 — Web Reading

Status: COMPLETE (CORE)

- [x] `/fetch`
- [x] `/read`
- [x] HTML fetching
- [x] Title/text/link extraction
- [x] URL normalization
- [x] Duplicate link removal
- [x] Real-world testing
- [ ] Better article extraction
- [ ] Page-type detection
- [ ] PDF handling

## Phase 3 — Entity Extraction

Status: INITIAL IMPLEMENTATION

- [x] Person candidates
- [x] Organisation candidates
- [x] Location candidates
- [x] URLs
- [x] Dates/years
- [x] Keywords
- [x] Usernames
- [x] Normalization/deduplication
- [x] Basic confidence scoring
- [x] Initial false-positive filtering
- [ ] Better person/entity recognition
- [ ] Better organisation filtering
- [ ] Email extraction
- [ ] Phone extraction with context
- [ ] More language-aware extraction

## Phase 4 — Discovery Intelligence

Status: INITIAL IMPLEMENTATION / REFINEMENT BLOCKED BY SEARCH QUALITY

- [x] `/investigate`
- [x] Seed search
- [x] Controlled page reading
- [x] Entity aggregation
- [x] Duplicate prevention
- [x] Relevance scoring groundwork
- [x] Metadata separation
- [x] Discovery filtering
- [x] Discovery queue
- [x] Queue deduplication
- [x] Investigation budgets
- [x] Recursion depth control
- [ ] Search-result relevance scoring
- [ ] Better entity confidence
- [ ] Source confidence
- [ ] Related-query generation
- [ ] Priority queue
- [ ] Identity resolution

## Phase 5 — Recursive Crawler

Status: CONTROLLED INITIAL WORKFLOW

- [x] Seed investigation
- [x] Depth 0
- [x] Depth 1 support
- [x] Depth 2 maximum
- [x] Page/search/entity/queue limits
- [x] Visited-query tracking
- [x] Search-provider fallback
- [ ] Reliable multi-provider recursion testing
- [ ] Relevance threshold refinement
- [ ] Domain controls

Do not increase crawl budgets until search quality is stable.

## Phase 6 — Knowledge Graph

Status: PLANNED

- [ ] Entity nodes
- [ ] Relationship edges
- [ ] Source relationships
- [ ] Confidence
- [ ] Graph data structure
- [ ] Graph visualization
- [ ] Interactive mind map
- [ ] Timeline

## Phase 7 — Investigation UI

Status: PLANNED

- [ ] Search interface
- [ ] Investigation configuration
- [ ] Progress indicator
- [ ] Results page
- [ ] Entity explorer
- [ ] Source explorer
- [ ] Relationship explorer
- [ ] Mind map
- [ ] Timeline
- [ ] Evidence panel

## Phase 8 — Reporting

Status: PLANNED

- [ ] Investigation summary
- [ ] Key findings
- [ ] Entity/source/relationship tables
- [ ] Timeline
- [ ] Confidence indicators
- [ ] Limitations
- [ ] HTML report
- [ ] PDF export
- [ ] Archive/export

## Phase 9 — Advanced OSINT

Status: FUTURE

Possible capabilities:
- [ ] Username correlation
- [ ] Domain intelligence
- [ ] Email correlation
- [ ] Social-media discovery
- [ ] Image metadata
- [ ] Reverse-image search integration
- [ ] Historical webpages
- [ ] DNS
- [ ] Certificate information
- [ ] WHOIS/RDAP
- [ ] RSS/news monitoring
- [ ] Document metadata
- [ ] Cross-source correlation

Only add capabilities where technically and legally appropriate and where free/public access is practical.

## Phase 10 — Optimization

Status: FUTURE

- [ ] Search caching
- [ ] Page-read caching
- [ ] Duplicate-request reduction
- [ ] Improved scoring
- [ ] Improved extraction
- [ ] Reduced Worker execution time/resource use

## Current Priority

1. Implement `/search` result-quality/relevance validation.
2. Test `/search?provider=searxng` and `/search?provider=auto`.
3. Use `Ramzul Ramli` as the known golden test case while ensuring `Ramzulhakim Ramli` is not automatically merged as the same person.
4. Re-test `/investigate` only after search quality is reliable.
5. Refine entity and identity scoring.
6. Strengthen controlled recursion.
7. Build relationship/graph structures.
8. Build UI and reporting.

Do not jump directly to unrestricted crawling.
