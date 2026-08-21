
---

### 2. `ROADMAP.md`

This is the **master development plan**.

```markdown
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

Status: MOSTLY COMPLETE

- [x] `/fetch`
- [x] `/read`
- [x] HTML fetching
- [x] Title extraction
- [x] Text extraction
- [x] Link extraction
- [x] Relative URL normalization
- [x] Duplicate link removal

Next:

- [ ] Test real news/article pages
- [ ] Improve article extraction
- [ ] Extract metadata
- [ ] Detect page type
- [ ] Handle PDFs

---

# Phase 3 — Entity Extraction

Status: NEXT

- [ ] Person extraction
- [ ] Organisation extraction
- [ ] Location extraction
- [ ] Username extraction
- [ ] Website extraction
- [ ] Email extraction
- [ ] Phone extraction
- [ ] Date extraction
- [ ] Keyword extraction
- [ ] Entity normalization
- [ ] Entity deduplication

---

# Phase 4 — Discovery Intelligence

Status: PLANNED

- [ ] Relevance scoring
- [ ] Entity confidence
- [ ] Source confidence
- [ ] Related keyword generation
- [ ] Search query generation
- [ ] Discovery queue
- [ ] Priority queue
- [ ] Duplicate investigation prevention

---

# Phase 5 — Recursive Crawler

Status: PLANNED

- [ ] Seed investigation
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

1. Test `/read` on a real article.
2. Improve `/read` if required.
3. Build entity extraction.
4. Build entity normalization.
5. Build relevance scoring.
6. Build discovery queue.
7. Build recursive investigation.
8. Build graph.
9. Build UI.
10. Build reporting/PDF.

Do not jump directly to the full crawler.

Each stage must be tested before moving to the next stage.
