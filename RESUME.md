# Silk Stalker — Resume Point

Last updated: 2026-09-03

> **Canonical quick-resume note for the next coding session.**

## Product

- Repository: `ramzulramli/free-osint-explorer`
- Product/UI name: **Silk Stalker**
- Repository rename: not done; keep repository name unchanged for now.
- Current free Worker URL: `https://free-osint-explorer.ramzul.workers.dev`
- Paid custom domain: not planned at this stage.
- Goal: free/RM0 where practical, on-demand OSINT discovery/investigation using GitHub + Cloudflare Workers; no always-running server.

## Current state

The live investigation implementation is synchronized to `main`.

The current Worker entry point is `src/worker.js`; it imports the canonical investigation engine and image evidence module, and loads the dashboard from `src/investigate.js`.

The Worker root `/` serves the Silk Stalker investigation dashboard and `/investigate` returns structured JSON.

## What is working

### Search
- `/search` works through a provider abstraction.
- DuckDuckGo is attempted first.
- DuckDuckGo bot/challenge responses are detected.
- SearXNG is used as fallback.
- Results are normalized, relevance-scored and weak/noisy results are filtered.
- Name-like queries use bounded fan-out variants.
- Compound-name partial matches receive a penalty.

### Reading
- `/fetch` / `/read` can fetch public HTTP/HTTPS pages and extract readable text/title/links.

### Investigation
- `/investigate` performs controlled search → read → extraction → aggregation → scoring/filtering.
- Budgets and recursion are deliberately bounded.
- Account/profile extraction works for recognizable public profile URLs.
- Evidence-v2 assessment exposes confidence, level and reasons instead of relying only on a raw score.
- Source failures such as HTTP 429/999 are preserved in the response.
- Related image discovery is implemented with source/page provenance.
- Identity resolution remains a match signal, not proof of identity.

### UI
The dashboard is live in the Worker rather than a static preview.

Implemented:
- Silk Stalker branding;
- `Stalk a person` prompt;
- `STALK` action button;
- search box;
- Direct search / Follow-up / Deep investigation depth selector;
- error state;
- primary subject card;
- confidence visualization;
- identity candidates;
- public profiles/accounts;
- related organisations, locations and public contact signals;
- evidence trail;
- inspected sources with clickable links;
- investigation statistics;
- related images;
- responsive layout.

Normal UI investigations use `POST /investigate` with JSON `{q, provider, depth}` so the subject is not placed in the request URL. Legacy GET remains available for compatibility.

The loading animation experiment is intentionally not a current priority.

## Important deployment note

Cloudflare **Builds** and **Versions** are not the same thing as the active production deployment.

For future production verification:

```text
GitHub main
   ↓
Cloudflare build
   ↓
Cloudflare version
   ↓
Promote when branch/version controls require it
   ↓
Test production Worker
```

Do not claim production is updated merely because a GitHub commit exists. Verify the actual Worker when a live deployment matters.

## Latest product direction

The product branding is now **Silk Stalker** while the GitHub repository and free Cloudflare hostname remain unchanged.

The normal UI wording is:

```text
Stalk a person
        ↓
      STALK
```

Search subjects are intentionally sent through POST rather than query parameters in the normal browser workflow.

## Latest important live test: `Fauzi Ariffin`

The live Worker returned a successful structured investigation response.

Observed:
- exact-name candidate found;
- Facebook, Instagram and IMDb profile signals found;
- Instagram HTTP 429 and LinkedIn HTTP 999 recorded as failed sources;
- evidence-v2 confidence `0.5`, level `moderate`;
- assessment stated that the name was corroborated but no independent identity attribute was corroborated.

This confirms that the response pipeline is working and that the scoring layer is moving toward evidence-based calibration.

## Important regression: `Ramli Musa`

Keep this as a same-name separation test. A strong-looking public identity for a common name must not automatically be treated as the intended person.

Known lesson:

**Same name does not mean same person.**

Extraction noise such as page-title fragments must also be filtered before they become person candidates.

## Golden identity tests

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

Never merge these solely because the names overlap.

## NEXT CODING MILESTONE

### 1. Evidence-backed signal cards

Turn the existing flat data into first-class signal groups:

- Possible identity
- Why this matched
- Public profiles
- Work & education
- Location signals
- Other public signals
- Sources

Each signal should retain source provenance and indicate whether the evidence is directly associated with the candidate or merely mentioned by a source.

### 2. Entity-noise filtering

Prevent generic page titles, headings and unrelated mentioned names from becoming person candidates.

### 3. Identity corroboration

Score dimensions separately:

- exact/near name match;
- independent source count;
- account/profile match;
- organisation overlap;
- location overlap;
- education/work overlap;
- contradictions;
- source quality;
- profile ownership vs merely-mentioned status where detectable.

Do not allow source volume alone to create high confidence.

### 4. Re-run golden tests

At minimum:
- `Ramzul Mazwan bin Ramli`
- `Ramzul Ramli`
- `Ramzulhakim Ramli`
- `Ramli Musa`

Compare false merges and false splits.

### 5. Then build graph/history/reporting

After identity/evidence quality is acceptable:
- candidate ↔ account ↔ organisation ↔ location ↔ source relationship model;
- graph/mind-map UI;
- browser/session investigation history;
- HTML/report export.

Do not increase recursion/crawl budgets before the golden tests pass.

## Known technical debt

- Generic page-title fragments can become person candidates.
- Entity/account duplicates can survive across searches.
- Organisation attribution needs stronger corroboration.
- Confidence calibration is incomplete.
- Profile owner vs merely-mentioned person is not reliably distinguished yet.
- Public SearXNG instances are an availability/quality dependency.
- Some public sites reject automated reads with 429/999/etc.
- Graph, history and reporting are not implemented.

## Current limits

Keep conservative:
- search results: 5;
- investigation pages: 5;
- ranked people: 10;
- related signals: 10 per group;
- name variants: bounded;
- recursion depth: maximum 2;
- search requests: maximum 5.

## Documentation map

- `PROJECT_STATUS.md` — current engineering status.
- `ARCHITECTURE.md` — system architecture and technical findings.
- `ROADMAP.md` — phased implementation plan.
- `TEST_NOTES.md` — regression/end-to-end observations.
- `RESUME.md` — fastest way to restart work in a future chat.

## Rule for future sessions

Do not restart from generic discussion. Read this file, inspect `main` and the live Worker state, then continue with the next unchecked engineering milestone. Each test must validate a product feature or fix a known weakness.
