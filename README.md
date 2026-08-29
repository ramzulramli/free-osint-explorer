# Free OSINT Explorer

Free, on-demand OSINT research and investigation workspace.

## What it does

Free OSINT Explorer searches public sources, reads selected pages, extracts candidate entities/accounts and presents the resulting evidence in an investigation dashboard.

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

**Live investigation UI V2 is implemented.** The `/investigate` API works and the dashboard has successfully rendered real investigation data in the Cloudflare Worker version preview.

Production verification is currently blocked by a browser **`Failed to fetch`** error after deployment. The next task is to diagnose the production API/CORS/path/version configuration before adding more crawler complexity.

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

## Identity safety principle

A search match is not proof of identity. Similar names, accounts and organisations must not be merged without independent corroborating evidence. Confidence values are match signals, not certainty claims.

## Development

The repository is deployed through GitHub → Cloudflare. Current UI development is on `ui-v2-live-investigation`.

Production Worker:

`https://free-osint-explorer.ramzul.workers.dev`

The eventual product rename to **Silk Stalker** remains deferred until the architecture and UI are stable.
