# Silk Stalker — Test Notes

Last updated: 2026-09-03

## Purpose

This file preserves end-to-end test observations so development can resume after a chat reset without relying on conversation history.

## Product / UI wrap-up

The investigation product is now branded **Silk Stalker** while the GitHub repository name remains `free-osint-explorer` and the free Cloudflare hostname remains unchanged.

The normal browser workflow uses:

- `Stalk a person` as the primary prompt;
- `STALK` as the primary action;
- `POST /investigate` with the subject in JSON rather than the query string.

This keeps investigated names out of the visible browser address bar and normal request URL. Legacy GET `/investigate?q=...` remains supported for compatibility.

The loading animation was attempted but is intentionally not a current priority.

## Deployment / Worker regression — 2026-08-30

Recent Cloudflare Worker versions exposed response-handling failures while the live investigation UI was being connected to the Worker.

Observed errors included:

- `Unexpected token '<', "<!DOCTYPE ..." is not valid JSON`
- Cloudflare Worker Error 1101
- `Responses may only be constructed with status codes in the range 200 to 599, inclusive.`
- `Application returned a non-Response value`

The fixes were developed on the UI development branch and then synchronized back to `main`. Cloudflare build history and Version History are separate: a successful build/version does not necessarily mean it is the active production deployment when branch/version controls require manual promotion.

The current Worker entry point is `src/worker.js` and Wrangler points to that file.

## Test: `Fauzi Ariffin`

Observed behaviour from the live Worker:

- Investigation returned `status: success` with structured JSON.
- Exact `Fauzi Ariffin` candidate was found.
- Public profile signals included Facebook, Instagram and IMDb.
- Instagram failed with HTTP 429.
- LinkedIn failed with HTTP 999.
- Failed sources were retained under `failed` instead of being counted as successful evidence.
- A later evidence-v2 run returned confidence `0.5` / `moderate`.
- The assessment correctly explained that the name was corroborated but no independent identity attribute was corroborated.

Key lesson:

Source count alone must not imply identity. The scoring layer needs independent corroboration dimensions.

## Test: `Shazzuwan Zakaria`

Observed behaviour:

- Exact-name candidate was found with useful education/context signals.
- Public sources included social profile and long-form education-related material.
- Context signals included Malaysia/Selangor, education/cikgu terminology, Bahasa, Matematik and year references.
- The extractor also produced noisy person candidates such as page-title fragments and names mentioned in the same article.
- `Shazwan Zakaria` remained a separate spelling variant.

Key product lesson:

Every signal needs source attribution and association status. A person merely mentioned on a page must not automatically become a candidate associated with the subject.

## Test: `Ramli Musa`

This remains a same-name separation regression test.

A strong-looking public academic identity can be returned for the common name, but that does not mean it is the same person as another `Ramli Musa`. The engine must keep search relevance and identity resolution as separate layers.

Previously observed extraction noise included page-title/content fragments such as:

- `Ramli Musa Gender`
- `Negeri Sembilan Musa`
- `Dr Ramli Musa Knowledge`

These should not become meaningful person candidates.

## Test: `Fauzi Ariffin` scoring-v2 regression

The evidence-v2 output exposes an explicit assessment:

- confidence level;
- reason for the score;
- corroboration count;
- independent identity-attribute status.

For the observed run:

```text
confidence: 0.5
level: moderate
reasons:
- Name corroborated by 1 evidence item
- 5 distinct sources
- no independent identity attribute corroborated
```

This is preferable to an earlier high-looking score because it makes the lack of independent corroboration visible.

## Current implementation target

### Evidence-backed signal cards

Add first-class signal groups for:

- Work / organisation
- Education
- Public social accounts
- Public contact channels when explicitly published by the source
- Broad location signals (city/state/country)
- Dates / years where context is clear

Do not automatically harvest or display private residential addresses. Keep public-source provenance visible.

### Identity corroboration

For each candidate, calculate separate evidence dimensions instead of one opaque confidence score:

- exact/near name match;
- number of independent sources;
- account-name match;
- organisation overlap;
- location overlap;
- education/work overlap;
- contradictory evidence;
- source quality;
- direct profile ownership vs merely-mentioned person where detectable.

Do not merge people solely because names are similar.

### UI target

The live dashboard should group results into:

- `Possible identity`
- `Why this matched`
- `Public profiles`
- `Work & education`
- `Location signals`
- `Other public signals`
- `Sources`

Every signal should be clickable back to its source where available.

## Regression subjects

Keep these as development tests:

- `Ramzul Mazwan bin Ramli` — full-name test subject
- `Ramzul Ramli` — common/public name test
- `Ramzulhakim Ramli` — different-person separation test
- `Fauzi Ariffin` — common Malaysian name / multi-source test
- `Shazzuwan Zakaria` — context-rich page / noisy extraction test
- `Ramli Musa` — common-name / false-positive separation test
