# Free OSINT Explorer — Project Status

Last updated: 2026-08-23

## Project Goal

Build a free, on-demand OSINT discovery and investigation system.

The user enters a keyword, name, organisation, topic, or other seed.

The system should:

1. Search the public web.
2. Collect relevant search results.
3. Fetch public webpages.
4. Extract readable content.
5. Discover related entities and keywords.
6. Score discovered entities by relevance.
7. Search important discoveries again.
8. Continue recursively with controlled limits.
9. Build relationships between entities.
10. Produce an investigation report.
11. Produce a visual mind map / knowledge graph.
12. Allow the final report to be archived as PDF.

Primary requirement:

- Free / RM0 where realistically possible.
- No always-running server.
- On-demand usage only.
- Browser/cloud-based development preferred.

---

# Current Infrastructure

## GitHub

Repository: `ramzulramli/free-osint-explorer`

GitHub is used for source code and Cloudflare deployment.

## Cloudflare

Worker: `free-osint-explorer`

Production URL: `https://free-osint-explorer.ramzul.workers.dev`

Cloudflare automatically deploys changes from GitHub.

---

# Current API

## `/`

Returns basic Worker status.

---

## `/search`

Example:

`/search?q=Alicia%20Amin`

Current provider: DuckDuckGo HTML search.

Current behaviour:

- Sends search query to DuckDuckGo.
- Parses search result blocks.
- Extracts title, URL and snippet.
- Decodes DuckDuckGo redirect URLs.
- Removes obvious advertisements.
- Removes duplicate URLs.

Status: WORKING

---

## `/fetch`

Example:

`/fetch?url=https%3A%2F%2Fexample.com`

Current behaviour:

- Accepts HTTP/HTTPS URLs.
- Fetches public webpages.
- Returns URL, HTTP status, content type, content length and an HTML preview.

Status: WORKING

---

## `/read`

Example:

`/read?url=https%3A%2F%2Fexample.com`

Current behaviour:

- Accepts HTTP/HTTPS URLs.
- Fetches public webpages.
- Extracts page title.
- Removes scripts, styles, noscript, SVG and comments.
- Converts HTML into readable plain text.
- Extracts hyperlinks.
- Converts relative links into absolute URLs.
- Removes duplicate links.
- Limits readable text and extracted links.
- Extracts initial entities from page text.

Current entity extraction includes:

- Person candidates
- Organisation candidates
- Malaysian location candidates
- URLs
- Dates
- Years
- Repeated keywords
- Normalization and deduplication
- Basic confidence values
- Initial false-positive filtering

Real-world testing was performed on the Wikipedia page for Ramzul Zahini Adenan. The extraction is functional but still heuristic; some false positives remain, especially for organisation-like phrases and ambiguous names.

Status: WORKING / IMPROVEMENT ONGOING

---

## `/investigate`

Example:

`/investigate?q=Ramzul%20Ramli`

Current behaviour:

1. Accepts a seed query.
2. Executes the search workflow.
3. Collects initial search results.
4. Reads a controlled number of result pages.
5. Extracts entities from each readable page.
6. Aggregates discoveries.
7. Applies basic duplicate prevention.
8. Returns investigation data in a single response.

This is the first orchestration layer of the project.

It is currently a controlled initial investigation workflow, not yet a full recursive crawler. Relevance scoring, discovery queues, generated follow-up queries and multi-depth recursion are still pending.

Status: WORKING / INITIAL IMPLEMENTATION

---

# Current Development Position

```text
Phase 0  Infrastructure        ██████████ COMPLETE
Phase 1  Search                ██████████ COMPLETE
Phase 2  Web Reading           ██████████ COMPLETE (core)
Phase 3  Entity Extraction     ████████░░ INITIAL IMPLEMENTATION
Phase 4  Discovery Intelligence ████░░░░░░ IN PROGRESS
Phase 5  Recursive Crawler     ██░░░░░░░░ INITIAL WORKFLOW ONLY
Phase 6  Knowledge Graph       ░░░░░░░░░░ PLANNED
Phase 7  Investigation UI      ░░░░░░░░░░ PLANNED
Phase 8  Reporting             ░░░░░░░░░░ PLANNED
Phase 9  Advanced OSINT        ░░░░░░░░░░ FUTURE
Phase 10 Optimization          ░░░░░░░░░░ FUTURE
```

---

# Immediate Next Steps

1. Test `/investigate` using several different seed types.
2. Inspect source and entity aggregation quality.
3. Add relevance scoring for entities and sources.
4. Rank discoveries instead of treating all entities equally.
5. Build a discovery queue with explicit execution limits.
6. Generate controlled follow-up searches from high-value discoveries.
7. Add recursive investigation only after queueing and limits are stable.

The next major engineering focus is **Discovery Intelligence**, not UI or unrestricted crawling.
