# Free OSINT Explorer — Resume Point

Last updated: 2026-08-27

> **This is the canonical quick-resume note for the next coding session.**

## Product

- Repository: `ramzulramli/free-osint-explorer`
- Current name: **Free OSINT Explorer**
- Planned final name: **Silk Stalker**
- Do **not** rename yet. Rename after the architecture, dynamic UI and investigation workflow are stable.
- Goal: free/RM0 where practical, on-demand OSINT discovery/investigation using GitHub + Cloudflare Workers; no always-running server.

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
- Account/profile extraction is working for recognizable public profile URLs.
- Identity resolution is only an initial scoring layer; it is not proof of identity.

### UI
A polished **static dashboard preview** was implemented on branch:

`ui-v1-dashboard`

Commit:

`ac9d320` — `Add first polished investigation dashboard UI preview`

File:

`ui-preview.html`

The preview was successfully rendered locally as an HTML file. It is currently hardcoded sample data for `Ramli Musa` and is **not yet connected to the real `/investigate` JSON**.

UI already contains:
- search box;
- primary subject card;
- confidence/match signal;
- source/account/organisation/location statistics;
- evidence graph-style list;
- identity signals;
- sources;
- investigation statistics;
- responsive layout;
- masked public contact signal preview.

## Latest important test: `Ramli Musa`

The engine returned a strong-looking `Ramli Musa` / `Prof Dr Ramli Musa` public identity with a personal site, ResearchGate and LinkedIn results, plus organisation/location/contact signals.

This exposed the exact product problem we need to solve:

**Same name does not mean same person.**

The user clarified that his father is 70+ and a former teacher. The discovered Prof Dr Ramli Musa is a different public identity with an academic/psychiatry footprint. Therefore this test is useful as a **false-positive / same-name separation test**, not as evidence about the user's father.

The result also exposed extraction noise such as:
- `Ramli Musa Gender`
- `Negeri Sembilan Musa`
- `Dr Ramli Musa Knowledge`

These are page-title/content fragments and should not become meaningful person candidates.

## Other regression tests

### `Fauzi Ariffin`
- Exact-name candidate found across multiple public sources.
- `Mohd Fauzi Ariffin` remained separate.
- Lesson: source diversity helps but does not prove identity.

### `Shazzuwan Zakaria`
- Exact-name candidate plus useful education/context signals.
- Noisy names from the same article appeared as person candidates.
- `Shazwan Zakaria` spelling variant remained separate.
- Lesson: every signal needs source attribution and association status.

### Golden identity tests

```text
Ramzul Mazwan bin Ramli  = full-name test subject
Ramzul Ramli             = common/public name used by test subject
Ramzulhakim Ramli        = different person
```

Never merge these solely because the names overlap.

## NEXT SESSION — DO THIS FIRST

### 1. Wire UI to real API

Start from branch `ui-v1-dashboard` and turn the static preview into a live dashboard.

Target flow:

```text
User enters name
      ↓
INVESTIGATE button
      ↓
fetch('/investigate?...')
      ↓
real JSON response
      ↓
render dashboard
```

Do not redesign the whole UI first. Make the existing preview consume the real investigation JSON.

### 2. Add proper UI states

Implement:
- idle;
- loading;
- success;
- empty/no useful results;
- error.

### 3. Add evidence-backed signal rendering

Group the returned data into:
- Possible identity
- Why this matched
- Public profiles
- Work & education
- Location signals
- Other public signals
- Sources

Every displayed signal should retain/carry source provenance where available.

### 4. Fix extraction noise

Prevent generic page titles/headings/unrelated mentioned names from becoming person candidates.

### 5. Improve identity corroboration

Score dimensions separately:
- exact/near name match;
- independent source count;
- account/profile match;
- organisation overlap;
- location overlap;
- education/work overlap;
- contradictions;
- source quality.

Do not allow a single opaque confidence score to imply certainty.

### 6. Re-run golden tests

At minimum:
- `Ramzul Mazwan bin Ramli`
- `Ramzul Ramli`
- `Ramzulhakim Ramli`
- `Ramli Musa`

Compare false merges and false splits.

### 7. Then build graph/reporting

After identity/evidence quality is acceptable:
- candidate ↔ account ↔ organisation ↔ location ↔ source relationship model;
- graph/mind-map UI;
- investigation history;
- HTML/report export.

Do **not** increase recursion/crawl budgets before the golden tests pass.

## Known technical debt

- Generic page-title fragments can become person candidates.
- Entity/account duplicates can survive across searches.
- Organisation attribution needs stronger corroboration.
- Confidence calibration is incomplete; `1.00` is a model score, not certainty.
- Profile owner vs merely-mentioned person is not reliably distinguished yet.
- Public SearXNG instances are an availability/quality dependency.
- Evidence/source provenance is incomplete in some investigation responses.
- Static UI is not yet connected to `/investigate`.
- Graph, history and reporting are not implemented.

## Current limits

Keep these conservative for now:
- search results: 5;
- investigation pages: 3 on the current `/investigate` path;
- ranked people: 10;
- related signals: 15;
- name variants: maximum 5;
- recursion depth/budgets: bounded.

## Documentation map

- `PROJECT_STATUS.md` — current engineering status and resume note.
- `ARCHITECTURE.md` — system architecture and technical findings.
- `ROADMAP.md` — phased implementation plan.
- `TEST_NOTES.md` — regression/end-to-end observations.
- `RESUME.md` — fastest way to restart work in a future chat.

## Rule for future sessions

Do not restart from generic discussion. Read this file, inspect the current UI branch, then continue with the next unchecked engineering milestone. Each test should validate a product feature or fix a known weakness.
