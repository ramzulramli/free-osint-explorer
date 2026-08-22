# Free OSINT Explorer — Roadmap

## Phase 0 — Infrastructure

Status: COMPLETE

- [x] GitHub repository
- [x] Cloudflare Worker
- [x] GitHub → Cloudflare deployment
- [x] Production Worker URL
- [x] Browser-based development

---

# Phase 1 — Search

Status: COMPLETE CORE / PROVIDER RESILIENCE IN PROGRESS

- [x] `/search`
- [x] DuckDuckGo provider
- [x] Search result parsing
- [x] URL decoding
- [x] Advertisement filtering
- [x] Duplicate removal
- [x] Search testing
- [x] Bot/challenge detection
- [x] Explicit provider failure reporting
- [x] DuckDuckGo fallback parsing attempt
- [ ] Search provider abstraction
- [ ] Free secondary provider
- [ ] Automatic provider fallback
- [ ] Search result ranking

Current blocker: DuckDuckGo can return bot/challenge responses from Cloudflare Workers. Do not treat this as a genuine zero-result search.

---

# Phase 2 — Web Reading

Status: COMPLETE

- [x] `/fetch`
- [x] `/read`
- [x] HTML fetching
- [x] Title extraction
- [x] Text extraction
- [x] Link extraction
- [x] Relative URL normalization
- [x] Duplicate link removal
- [x] Real-world page testing
- [x] Metadata extraction groundwork
- [ ] Improve article extraction
- [ ] Detect page type
- [ ] Handle PDFs

---

# Phase 3 — Entity Extraction

Status: COMPLETE (INITIAL IMPLEMENTATION)

- [x] Person candidate extraction
- [x] Organisation candidate extraction
- [x] Location extraction
- [x] URL extraction
- [x] Date extraction
- [x] Year extraction
- [x] Keyword extraction
- [x] Username extraction
- [x] Entity normalization
- [x] Entity deduplication
- [x] Confidence scoring
- [x] False-positive filtering improvements

Still to improve:

- [ ] Better person/entity recognition
- [ ] Better organisation filtering
- [ ] Email extraction
- [ ] Phone extraction with context validation
- [ ] More language-aware extraction

---

# Phase 4 — Discovery Intelligence

Status: INITIAL IMPLEMENTATION COMPLETE / REFINEMENT IN PROGRESS

- [x] `/investigate` endpoint
- [x] Seed query support
- [x] Search result collection
- [x] Controlled initial page reading
- [x] Entity aggregation
- [x] Basic duplicate prevention
- [x] Investigation response structure
- [x] Initial relevance scoring
- [x] Initial entity ranking
- [x] Metadata separation
- [x] Useful discovery filtering
- [x] Discovery queue
- [x] Queue deduplication
- [x] Investigation limits and budgeting
- [x] Configurable recursion depth
- [ ] Better relevance scoring
- [ ] Entity confidence refinement
- [ ] Source confidence
- [ ] Related keyword generation
- [ ] Better search query generation
- [ ] Priority queue

---

# Phase 5 — Recursive Crawler

Status: CONTROLLED INITIAL WORKFLOW

- [x] Seed investigation
- [x] Initial investigation workflow
- [x] Depth 0
- [x] Depth 1 workflow support
- [x] Depth 2 maximum
- [x] Maximum depth
- [x] Maximum pages
- [x] Maximum searches
- [x] Maximum entities
- [x] Execution limits
- [x] Visited-query tracking
- [x] Queue-size limit
- [ ] Relevance threshold refinement
- [ ] Domain controls
- [ ] Search-provider fallback
- [ ] Robust multi-provider recursion

Important: recursive investigation should not be expanded further until search-provider reliability is solved.

---

# Phase 6 — Knowledge Graph

Status: PLANNED

- [ ] Entity nodes
- [ ] Relationship edges
- [ ] Source relationships
- [ ] Confidence
- [ ] Graph data structure
- [ ] Graph visualization
- [ ] Interactive mind map
- [ ] Timeline

---

# Phase 7 — Investigation UI

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

---

# Phase 8 — Reporting

Status: PLANNED

- [ ] Investigation summary
- [ ] Key findings
- [ ] Entity table
- [ ] Source table
- [ ] Relationship table
- [ ] Timeline
- [ ] Confidence indicators
- [ ] Limitations
- [ ] HTML report
- [ ] PDF export
- [ ] Archive/export

---

# Phase 9 — Advanced OSINT

Status: FUTURE

Possible capabilities:

- [ ] Username correlation
- [ ] Domain intelligence
- [ ] Email correlation
- [ ] Social-media discovery
- [ ] Image metadata
- [ ] Reverse-image search integration
- [ ] Historical webpages
- [ ] DNS information
- [ ] Certificate information
- [ ] WHOIS/RDAP
- [ ] RSS/news monitoring
- [ ] Document metadata
- [ ] Cross-source correlation

These will only be added where technically and legally appropriate and where free/public access is practical.

---

# Phase 10 — Optimization

Status: FUTURE

- [ ] Cache repeated searches
- [ ] Cache webpage reads
- [ ] Reduce duplicate requests
- [ ] Improve scoring
- [ ] Improve extraction
- [ ] Reduce Worker execution time
- [ ] Reduce resource consumption
- [ ] Improve investigation speed

---

# Current Priority

The immediate development order is:

1. Add search-provider abstraction.
2. Evaluate a free SearXNG-based fallback using a configurable Worker environment variable.
3. Test the fallback through `/search`.
4. Re-test `/investigate` with several seed types.
5. Refine relevance/entity scoring.
6. Strengthen controlled recursive investigation.
7. Build relationship extraction.
8. Build graph data structures.
9. Build the UI.
10. Build reporting/PDF.

Do not jump directly to unrestricted crawling.

Each stage must be tested before moving to the next stage.
