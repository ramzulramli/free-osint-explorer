# Free OSINT Explorer — Test Notes

Last updated: 2026-08-31

## Purpose

Preserve end-to-end test observations and implementation decisions so development can resume after a chat reset without relying on conversation history.

## Test: `Fauzi Ariffin`

Observed behaviour:

- Exact two-token name produced a top `Fauzi Ariffin` candidate with multiple public-source hits.
- Sources included Facebook, Instagram and IMDb.
- A separate `Mohd Fauzi Ariffin` candidate was retained instead of being merged automatically in the earlier pipeline.
- Current evidence-v2 assessment correctly stayed moderate when no independent identity attribute was corroborated.
- Instagram returned HTTP 429 and LinkedIn returned HTTP 999 during one run; blocked pages are not corroboration.

Key product lesson:

Source count alone must not drive identity confidence. Accounts discovered from URLs are useful leads but are not proof of ownership.

## Test: `Shazzuwan Zakaria`

Observed behaviour:

- Exact-name candidate was found with useful public context.
- Sources included an Instagram profile and a long-form education-related article.
- The article produced useful context signals including Malaysia/Selangor, education/cikgu terminology, Bahasa, Matematik, and year references.
- The earlier extractor produced noisy person candidates such as page-title fragments and unrelated names mentioned in the same article.
- A spelling variant `Shazwan Zakaria` was retained separately.

Key product lesson:

Entity extraction needs source context. A person name mentioned on a page is not automatically the person represented by that page.

## M6 — Evidence-backed UI

Implemented:

- `Possible identity` / primary subject presentation
- candidate confidence signal
- public account/profile signals
- related organisations and locations
- evidence trail
- inspected source list
- investigation health and crawl statistics
- explicit UI language that public-source signals are not proof of identity

## M6.1 — Entity-noise filtering

Implemented in `src/investigate.js`.

Changes:

- Person extraction now accepts a search/page context seed.
- Candidate names must contain at least two plausible name tokens.
- Known navigation/platform/location noise is rejected.
- Candidate names must be represented by the search/page context rather than being accepted merely because they look like capitalized words.
- Multi-token context matching is stricter for longer candidate names, reducing unrelated people mentioned in articles.
- Search-result and page extraction both pass the investigation subject into person extraction.
- Existing account extraction and evidence aggregation remain intact.

This is intentionally a filtering improvement, not a claim that name-based matching can establish identity.

## Next implementation milestone: M6.2

Strengthen identity corroboration with separate evidence dimensions:

- exact/near name match;
- independent source count;
- account-name/profile match;
- organisation overlap;
- location overlap;
- education/work overlap;
- contradictory evidence;
- source quality.

The final confidence should explain which dimensions actually contributed. Do not increase crawl depth simply to obtain a higher score.

## M7 — Relationship graph v1

Planned relationship model:

`candidate ↔ account ↔ organisation ↔ location ↔ source`

Every edge should retain provenance so the graph does not imply a relationship that the source did not establish.

## Regression subjects

Keep these as development tests:

- `Ramzul Mazwan bin Ramli` — full-name test subject
- `Ramzul Ramli` — common/public name test
- `Ramzulhakim Ramli` — different-person separation test
- `Fauzi Ariffin` — common Malaysian name / multi-source test
- `Shazzuwan Zakaria` — context-rich page / noisy extraction test

Default UI query must remain generic; do not hard-code the user's or user's father's name as the application default.
