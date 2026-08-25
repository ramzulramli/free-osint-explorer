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
- [x] Bounded SearXNG fallback to protect Worker subrequests
- [x] Initial search-result quality/relevance validation
- [x] Exact phrase and all-term matching
- [x] Compound-name partial-match penalty
- [ ] Validate more SearXNG instances for quality
- [ ] Advanced search result ranking
- [ ] Broader noisy-result detection

Recent direct tests pass for `Ramzul Ramli`, `Ramzul Mazwan Ramli`, `Ramzulhakim Ramli` and `Microsoft Windows`.

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

Status: INITIAL IMPLEMENTATION / ACCOUNT EXTRACTION WORKING

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

Latest investigation successfully identifies the strongest Shutterstock `ramzul` and LinkedIn `ramzul` profiles while suppressing previously observed unrelated Shutterstock accounts.

## Phase 4 — Discovery Intelligence

Status: WORKING / REFINEMENT NEEDED

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
- [ ] Evidence/source provenance completeness
- [ ] Better entity confidence
- [ ] Source confidence
- [ ] Related-query generation
- [ ] Priority queue
- [ ] Identity resolution
- [ ] Cross-source corroboration model

Latest successful test reached depth 1 with 5 investigations, 25 pages read, 5 search requests and no skipped searches.

## Phase 5 — Recursive Crawler

Status: CONTROLLED INITIAL WORKFLOW / DEPTH-1 TESTED

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

1. Preserve complete source/evidence provenance for every discovery.
2. Remove generic page-title/UI fragments from person candidates.
3. Consolidate duplicate discoveries across recursive investigations.
4. Calibrate confidence so 1.00 does not imply certainty.
5. Strengthen identity resolution using independent corroborating signals.
6. Run the golden investigations: `Ramzul Ramli`, `Ramzul Mazwan Ramli`, `Ramzulhakim Ramli`.
7. Only after those pass, increase recursion depth/budgets.
8. Build relationship/graph structures.
9. Build UI and reporting.

Do not jump directly to unrestricted crawling.
