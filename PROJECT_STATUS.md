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

Successfully tested with:

- `liverpool`
- `Alicia Amin`
- `Alicia Amin tattoo`

---

## `/fetch`

Example:

`/fetch?url=https%3A%2F%2Fexample.com`

Current behaviour:

- Accepts HTTP/HTTPS URLs.
- Fetches public webpages.
- Returns:
  - URL
  - HTTP status
  - content type
  - content length
  - HTML preview.

Successfully tested with:

`https://example.com`

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
- Returns up to 10,000 characters of readable text.
- Returns up to 100 extracted links.

Successfully tested with:

`https://example.com`

Successful output included:

```json
{
  "status": "success",
  "url": "https://example.com/",
  "httpStatus": 200,
  "title": "Example Domain",
  "textLength": 142,
  "text": "Example Domain Example Domain This domain is for use in documentation examples without needing permission. Avoid use in operations. Learn more",
  "linkCount": 1,
  "links": [
    {
      "text": "Learn more",
      "url": "https://iana.org/domains/example"
    }
  ]
}
