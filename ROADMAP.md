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

Status: COMPLETE

- [x] `/search`
- [x] DuckDuckGo provider
- [x] Search result parsing
- [x] URL decoding
- [x] Advertisement filtering
- [x] Duplicate removal
- [x] Search testing

Future:

- [ ] Search provider abstraction
- [ ] Additional providers if viable
- [ ] Search result ranking

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
- [x] Entity normalization
- [x] Entity deduplication
- [x] Confidence scoring
- [x] False-positive filtering improvements

Still to improve:

- [ ] Better person/entity recognition
- [ ] Better organisation filtering
- [ ] Username extraction
- [ ] Email extraction
- [ ] Phone extraction with context validation
- [ ] More language-aware extraction

---

# Phase 4 — Discovery Intelligence

Status: IN PROGRESS

- [x] `/investigate` endpoint
- [x] Seed query support
- [x] Search result collection
- [x] Controlled initial page reading
- [x] Entity aggregation
- [x] Basic duplicate prevention
- [x] Investigation response structure
- [ ] Relevance scoring
- [ ] Entity confidence refinement
- [ ] Source confidence
- [ ] Related keyword generation
- [ ] Search query generation
- [ ] Discovery queue
- [ ] Priority queue
- [ ] Investigation limits and budgeting

---

# Phase 5 — Recursive Crawler

Status: PLANNED

- [ ] Seed investigation
- [x] Initial investigation workflow
- [ ] Depth 0
- [ ] Depth 1
- [ ] Depth 2
- [ ] Maximum depth
- [ ] Maximum pages
- [ ] Maximum searches
- [ ] Maximum entities
- [ ] Execution limits
- [ ] Relevance threshold
- [ ] Domain controls

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

1. Test `/investigate` with multiple seeds and real-world pages.
2. Improve relevance scoring and entity ranking.
3. Build the discovery queue.
4. Add controlled recursive investigation.
5. Build relationship extraction.
6. Build graph data structures.
7. Build the UI.
8. Build reporting/PDF.

Do not jump directly to unrestricted crawling.

Each stage must be tested before moving to the next stage.
