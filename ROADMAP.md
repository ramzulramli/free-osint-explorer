# Silk Stalker — Roadmap

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

## Phase 4 — Discovery Intelligence

Status: WORKING / IDENTITY RESOLUTION INITIAL IMPLEMENTATION

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
- [x] Related image discovery
- [x] Image source/page provenance
- [x] Bounded image collection
- [ ] Evidence/source provenance completeness
- [ ] Better entity confidence
- [ ] Source confidence
- [ ] Related-query generation
- [ ] Priority queue
- [ ] Cross-source corroboration model

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

Status: LIVE UI + RELATED IMAGES + PRIVACY/BRANDING UPDATE

- [x] Silk Stalker branding
- [x] `Stalk a person` prompt
- [x] `STALK` action button
- [x] Search interface
- [x] Investigation configuration
- [ ] Progress indicator animation
- [x] Results page
- [ ] Entity explorer
- [x] Source explorer
- [ ] Relationship explorer
- [ ] Mind map
- [ ] Timeline
- [x] Evidence panel
- [x] Related Images panel
- [x] Click-through image → original image URL
- [x] Click-through image → source page provenance
- [x] Responsive layout
- [x] POST investigation requests to keep subject names out of query URLs

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

1. Build evidence-backed signal cards.
2. Improve entity-noise filtering.
3. Strengthen identity corroboration using independent evidence dimensions.
4. Preserve complete source/evidence provenance.
5. Re-run the golden investigations and compare false merges/false splits.
6. Verify the production Worker after deployment/promotion.
7. Build relationship/graph structures.
8. Add browser/session investigation history.
9. Build reporting/export.
10. Only after identity/evidence quality is acceptable, consider broader recursion and advanced OSINT modules.

### Related Images scope

The current implementation discovers images exposed by investigated source pages using standard HTML image signals such as `img`, `srcset`, Open Graph and Twitter image metadata. It records the image URL, source page, source title and available caption/alt text. It does **not** perform face recognition or claim that an image proves a person's identity.

Do not jump directly to unrestricted crawling.
