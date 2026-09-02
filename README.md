# Silk Stalker

Free, on-demand OSINT research and investigation workspace.

> Repository name remains `free-osint-explorer` for now. The product/UI branding is now **Silk Stalker**.

## What it does

Silk Stalker searches public sources, reads selected pages, extracts candidate entities/accounts and presents the resulting evidence in an investigation dashboard.

```text
Subject
  ↓
Search
  ↓
Relevant public sources
  ↓
Read pages
  ↓
Extract entities / accounts
  ↓
Score + filter
  ↓
Evidence-backed investigation
```

## Current status

**Live investigation UI V2 is implemented.** The Worker root serves the investigation dashboard and `/investigate` returns structured JSON.

The UI now uses `POST /investigate` for normal searches so the searched person's name is not placed in the browser address bar or request query string. Legacy GET support remains available for compatibility.

The loading animation experiment is intentionally not a current priority; the product remains functional without it.

## UI language

The primary action is now deliberately branded around **Stalk**:

- `Stalk a person` — search prompt.
- `STALK` — investigation action button.

The product still means public-source OSINT discovery and does not treat a search match as proof of identity.

## Core endpoints

- `/search` — search through the provider abstraction.
- `/fetch` — fetch a public HTTP/HTTPS page.
- `/read` — extract readable page text and links.
- `/entities` — extract entity candidates from a page.
- `/investigate` — run a bounded investigation and return scored discoveries/evidence.

## Search providers

- DuckDuckGo
- SearXNG fallback

Search quality is validated separately from transport success. Name-like queries use bounded variants and partial compound-name matches are penalised.

## Architecture

The system runs primarily through GitHub + Cloudflare Workers and is designed to remain free/RM0 where practical without an always-running server.

See:

- `ARCHITECTURE.md` — current system design and engineering decisions.
- `PROJECT_STATUS.md` — current implementation state and resume point.
- `ROADMAP.md` — phased development plan.
- `TEST_NOTES.md` — regression/end-to-end observations.
- `RESUME.md` — fastest way to restart work in a future chat.

## Identity safety principle

A search match is not proof of identity. Similar names, accounts and organisations must not be merged without independent corroborating evidence. Confidence values are match signals, not certainty claims.

## Privacy / URL design

Normal UI searches send the subject in the POST body rather than the URL query string. This keeps investigated names out of the visible browser URL.

The current free deployment remains on the Cloudflare `workers.dev` hostname. A cleaner free hostname is a later deployment/configuration task; no paid custom domain is required for the current project.

## Development

The repository is deployed through GitHub → Cloudflare. The Worker entry point is `src/worker.js` and the investigation UI module is `src/investigate.js`.

Current free Worker URL:

`https://free-osint-explorer.ramzul.workers.dev`

Future product branding: **Silk Stalker**.
