
---

# 3. `ROADMAP.md`

This is our **master plan**.

Copy:

```markdown
# Free OSINT Explorer — Roadmap

## Phase 1 — Foundation

- [x] GitHub repository
- [x] Cloudflare Worker
- [x] Automatic deployment
- [x] Worker URL
- [x] Basic API
- [x] `/search`
- [x] DuckDuckGo provider
- [x] Search result parsing
- [x] URL normalization
- [x] `/fetch`

---

# Phase 2 — Web Content

- [ ] `/read`
- [ ] HTMLRewriter
- [ ] Extract page title
- [ ] Extract visible text
- [ ] Extract links
- [ ] Extract metadata
- [ ] Detect page type
- [ ] Handle PDFs where practical
- [ ] Handle common social/news pages

---

# Phase 3 — Entity Extraction

- [ ] Person detection
- [ ] Organisation detection
- [ ] Location detection
- [ ] Username detection
- [ ] URL extraction
- [ ] Email extraction
- [ ] Phone extraction
- [ ] Date extraction
- [ ] Keyword extraction
- [ ] Entity normalization
- [ ] Duplicate entity detection

---

# Phase 4 — Intelligence Engine

- [ ] Relevance scoring
- [ ] Entity confidence
- [ ] Source confidence
- [ ] Candidate ranking
- [ ] Search query generation
- [ ] Related keyword generation
- [ ] Discovery queue
- [ ] Recursive investigation
- [ ] Maximum depth
- [ ] Maximum pages
- [ ] Maximum searches
- [ ] Duplicate prevention

---

# Phase 5 — Knowledge Graph

- [ ] Entity nodes
- [ ] Relationship edges
- [ ] Source relationships
- [ ] Entity confidence
- [ ] Relationship confidence
- [ ] Graph storage
- [ ] Graph visualization
- [ ] Interactive exploration
- [ ] Mind map

---

# Phase 6 — Investigation UI

- [ ] Search box
- [ ] Investigation settings
- [ ] Progress indicator
- [ ] Search results
- [ ] Entity list
- [ ] Relationship list
- [ ] Source list
- [ ] Graph view
- [ ] Timeline
- [ ] Findings panel

---

# Phase 7 — Reporting

- [ ] Investigation summary
- [ ] Source citations
- [ ] Entity report
- [ ] Relationship report
- [ ] Timeline
- [ ] Confidence indicators
- [ ] Limitations
- [ ] HTML report
- [ ] PDF export
- [ ] Archive investigation

---

# Phase 8 — Advanced Features

- [ ] Multiple search providers
- [ ] Domain-specific searching
- [ ] Social media discovery
- [ ] News discovery
- [ ] Historical information
- [ ] Alias discovery
- [ ] Cross-source identity matching
- [ ] Relationship inference
- [ ] Change detection
- [ ] Investigation comparison

---

# Phase 9 — Security

- [ ] SSRF protection
- [ ] Private IP blocking
- [ ] Internal hostname blocking
- [ ] Redirect validation
- [ ] URL allow/deny rules
- [ ] Rate limiting
- [ ] Request limits
- [ ] Crawl depth limits
- [ ] Content size limits
- [ ] Abuse protection

---

# Phase 10 — Cost Optimization

Target:

RM0 for occasional personal use.

Principles:

- Use free Cloudflare capabilities where practical.
- Avoid paid search APIs unless absolutely necessary.
- Avoid always-running infrastructure.
- Prefer on-demand execution.
- Cache results when possible.
- Avoid duplicate searches.
- Limit recursive crawling.
- Archive completed investigations instead of repeatedly crawling.

---

# Current Priority

Complete Phase 2:

1. `/read`
2. HTML cleaning
3. Link extraction
4. Metadata extraction

Then begin Phase 3.
