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

`/search?q=Ramzul%20Ramli`

Current provider: DuckDuckGo HTML search.

Current behaviour:

- Sends search query to DuckDuckGo.
- Parses search result blocks.
- Extracts title, URL and snippet.
- Decodes DuckDuckGo redirect URLs.
- Removes obvious advertisements.
- Removes duplicate URLs.
- Detects DuckDuckGo bot/challenge responses instead of silently reporting zero results.
- Uses the DuckDuckGo Lite endpoint as a fallback when appropriate.

Important current limitation:

- DuckDuckGo can return a bot/challenge response from Cloudflare Workers. This is now reported explicitly as a provider error rather than being misinterpreted as a genuine zero-result search.

Status: WORKING WHEN PROVIDER ACCESS IS AVAILABLE / PROVIDER LIMITATION IDENTIFIED

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
- Usernames
- Normalization and deduplication
- Basic confidence values
- Initial false-positive filtering

Real-world testing was performed on the Wikipedia page for Ramzul Zahini Adenan. The extraction is functional but still heuristic; some false positives remain, especially for generic webpage/navigation text and ambiguous names.

Status: WORKING / IMPROVEMENT ONGOING

---

## `/investigate`

Example:

`/investigate?q=Ramzul%20Ramli`

Controlled recursive example:

`/investigate?q=Ramzul%20Ramli&depth=1`

Current behaviour:

1. Accepts a seed query.
2. Executes the search workflow through shared search functions.
3. Collects up to 5 search results.
4. Reads up to 5 result pages per investigation.
5. Extracts up to 50 entities per source.
6. Aggregates duplicate entities across sources.
7. Counts distinct supporting sources.
8. Calculates initial relevance scores.
9. Separates useful discoveries from metadata such as years, dates and generic keywords.
10. Reports failed sources instead of silently discarding them.
11. Returns a controlled ranked discovery list.
12. Can optionally process discovered queries at controlled recursion depth.
13. Tracks visited queries, search requests, pages processed and remaining queue items.

Discovery types currently eligible for follow-up investigation:

- Person candidates
- Organisation candidates
- Location candidates
- Email addresses
- Phone numbers
- Usernames
- URLs

Metadata such as years, dates and generic keywords is retained for context but is not treated as a recursive discovery target.

Current controlled recursion limits:

- Maximum search results: 5
- Maximum pages per investigation: 5
- Maximum entities per source: 50
- Maximum ranked entities: 50
- Maximum discoveries: 25
- Maximum recursion depth: 2
- Maximum queue items: 10
- Maximum search requests: 10
- Maximum visited queries: 20

Important testing result:

- `Ramzul Ramli` successfully returned 10 DuckDuckGo results, 5 processed results, 2 successful readable sources, and a clean discovery containing `@ramzul.ramli`.
- Instagram and ZoomInfo may fail with HTTP 429/403; these failures are surfaced in the investigation response.
- Subsequent tests for other queries returned zero results because DuckDuckGo began returning a bot/challenge response from the Worker.
- The provider now explicitly reports `DuckDuckGo returned a bot/challenge response; search was not parsed` rather than treating that condition as zero search results.

Status: WORKING PIPELINE / SEARCH PROVIDER LIMITATION BLOCKING RELIABLE REPEATABLE TESTING

---

# Current Development Position

```text
Phase 0  Infrastructure         ██████████ COMPLETE
Phase 1  Search                 █████████░ COMPLETE WITH PROVIDER LIMITATION
Phase 2  Web Reading            ██████████ COMPLETE (core)
Phase 3  Entity Extraction      ████████░░ INITIAL IMPLEMENTATION
Phase 4  Discovery Intelligence ████████░░ INITIAL IMPLEMENTATION
Phase 5  Recursive Crawler      ████░░░░░░ CONTROLLED INITIAL WORKFLOW
Phase 6  Knowledge Graph        ░░░░░░░░░░ PLANNED
Phase 7  Investigation UI       ░░░░░░░░░░ PLANNED
Phase 8  Reporting              ░░░░░░░░░░ PLANNED
Phase 9  Advanced OSINT         ░░░░░░░░░░ FUTURE
Phase 10 Optimization           ░░░░░░░░░░ FUTURE
```

---

# Immediate Next Steps

1. Add a provider abstraction that allows DuckDuckGo to remain available without making it a single point of failure.
2. Evaluate a genuinely free SearXNG-based fallback that can be configured through a Worker environment variable rather than hard-coding a public instance.
3. Test `/search` with the fallback provider before testing `/investigate` recursion again.
4. Keep the existing controlled queue and limits unchanged while search reliability is fixed.
5. Improve relevance/entity scoring after a reliable search provider is available.
6. Continue with relationship extraction and knowledge-graph structures only after discovery quality is stable.

The next major engineering focus is **Search Provider Abstraction + Free Fallback**, followed by refinement of **Discovery Intelligence** and controlled recursive investigation.

---

# Resume Note

When development resumes, start with the search provider layer. Do not immediately modify the discovery queue. The queue currently has controlled limits and should be tested again only after a reliable search provider is available.
