# Free OSINT Explorer — Project Status

Last updated: 2026-08-22

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
- User cannot install software on company laptop.
- Cloud/browser-based development preferred.

---

# Current Infrastructure

## GitHub

Repository:

`ramzulramli/free-osint-explorer`

GitHub is used for source code and Cloudflare deployment.

## Cloudflare

Worker:

`free-osint-explorer`

Production URL:

`https://free-osint-explorer.ramzul.workers.dev`

Cloudflare automatically deploys changes from GitHub.

---

# Current API

## `/`

Returns basic Worker status.

Example:

`https://free-osint-explorer.ramzul.workers.dev/`

---

## `/search`

Example:

`/search?q=Alicia%20Amin`

Current provider:

DuckDuckGo HTML search.

Current behaviour:

- Sends search query to DuckDuckGo HTML endpoint.
- Parses search result blocks.
- Extracts:
  - title
  - URL
  - snippet
- Decodes DuckDuckGo redirect URLs.
- Removes obvious advertisements.
- Removes duplicate URLs.

Example successful result:

```json
{
  "status": "success",
  "provider": "duckduckgo",
  "query": "Alicia Amin",
  "results": [
    {
      "title": "Alicia Amin (@hangriii) • Instagram photos and videos",
      "url": "https://www.instagram.com/hangriii/",
      "snippet": "..."
    }
  ]
}
