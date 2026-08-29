# Free OSINT Explorer — Roadmap

## Phase 0 — Infrastructure

Status: COMPLETE

- [x] GitHub repository
- [x] Cloudflare Worker
- [x] GitHub → Cloudflare deployment
- [x] Production Worker URL
- [x] Browser-based development

## Phase 1 — Search

Status: RELEVANCE VALIDATION WORKING

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
- [x] Bounded SearXNG fallback
- [x] Search-result quality/relevance validation
- [x] Exact phrase and all-term matching
- [x] Compound-name partial-match penalty
- [ ] Validate more SearXNG instances for quality
- [ ] Advanced search result ranking
- [ ] Broader noisy-result detection

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

Status: WORKING / REFINEMENT NEEDED

- [x] Person candidates
- [x] Organisation candidates
- [x] Location candidates
- [x] URLs
- [x] Dates/years
- [x] Keywords
- [x] Usernames
- [x] Account/profile extraction
- [x] Normalization/deduplication
- [x] Basic confidence scoring
- [x] Initial false-positive filtering
- [x] Initial account relevance filtering
- [ ] Better person/entity recognition
- [ ] Better organisation filtering
- [ ] Email extraction
- [ ] Phone extraction with context
- [ ] More language-aware extraction

## Phase 4 — Discovery Intelligence

Status: WORKING / IDENTITY RESOLUTION INITIAL

- [x] `/investigate`
- [x] Seed search
- [x] Controlled page reading
- [x] Entity aggregation
- [x] Duplicate prevention groundwork
- [x] Relevance scoring groundwork
- [x] Metadata separation
- [x] Discovery filtering
- [x] Discovery queue
- [x] Queue deduplication
- [x] Investigation budgets
- [x] Recursion depth control
- [x] Initial search-result relevance scoring
- [x] Initial person-candidate grouping
- [x] Initial identity-resolution scoring
- [x] Account-to-candidate association
- [ ] Evidence/source provenance completeness
- [ ] Better entity confidence
- [ ] Source confidence
- [ ] Related-query generation
- [ ] Priority queue
- [ ] Cross-source corroboration model

## Phase 5 — Recursive Crawler

Status: CONTROLLED WORKFLOW / DEPTH-1 TESTED

- [x] Seed investigation
- [x] Depth 0
- [x] Depth 1 support
- [x] Depth 2 maximum
- [x] Page/search/entity/queue limits
- [x] Visited-query tracking
- [x] Search-provider fallback
- [x] Controlled recursion execution
- [ ] Golden identity investigation tests
- [ ] Reliable multi-provider recursion testing
- [ ] Relevance threshold refinement
- [ ] Domain controls

Do not increase crawl budgets until the golden investigation tests pass.

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

Status: LIVE V2 IMPLEMENTATION / PRODUCTION VERIFICATION BLOCKED

- [x] Search interface
- [x] Investigation entry point
- [x] Live `/investigate` data layer
- [x] Primary subject card
- [x] Confidence/match signal
- [x] Evidence/related-entity section
- [x] Account/profile section
- [x] Organisation/location signals
- [x] Public contact signal section
- [x] Identity signal panel
- [x] Source list
- [x] Investigation statistics
- [x] Responsive dashboard layout
- [x] Worker preview verification
- [ ] Production end-to-end verification
- [ ] Investigation configuration controls
- [ ] Progress indicator for long investigations
- [ ] Entity explorer
- [ ] Source explorer
- [ ] Relationship explorer
- [ ] Mind map
- [ ] Timeline
- [ ] Detailed evidence panel

The V2 dashboard successfully renders a real `Ramzul Mazwan Ramli` investigation in the Worker version preview. Production currently reports `Failed to fetch`, so the UI is not yet considered production-complete.

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

1. Fix production `Failed to fetch` and verify the live Worker API from the production URL.
2. Verify CORS, production route/path and environment bindings.
3. Preserve complete source/evidence provenance for every surfaced discovery.
4. Improve entity-noise filtering.
5. Improve confidence calibration so high scores never imply certainty.
6. Strengthen cross-source identity corroboration.
7. Run the golden identity tests.
8. Build relationship/graph structures.
9. Add reporting/export.
10. Only after these foundations pass, increase crawl budgets or add advanced OSINT modules.

Do not jump directly to unrestricted crawling.
