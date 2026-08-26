# Free OSINT Explorer — Test Notes

Last updated: 2026-08-26

## Purpose

This file preserves end-to-end test observations so development can resume after a chat reset without relying on conversation history.

## Test: `Fauzi Ariffin`

Observed behaviour:

- Exact two-token name produced a top `Fauzi Ariffin` candidate with multiple public-source hits.
- Sources included Facebook, Instagram and IMDb.
- A separate `Mohd Fauzi Ariffin` candidate was retained instead of being merged automatically.
- No organisation or location was reliably attributed by the current extraction pipeline.
- Public phone/email fields were empty.

Interpretation:

- Name fan-out is useful for common Malaysian names.
- Source diversity is a useful identity signal, but the current score must not imply identity proof.
- IMDb/other unrelated public profiles demonstrate why source-level corroboration is required before merging candidates.

## Test: `Shazzuwan Zakaria`

Observed behaviour:

- Exact-name candidate was found with confidence signal around 0.75.
- Public sources included an Instagram profile and a long-form education-related article.
- The article produced useful context signals including Malaysia/Selangor, education/cikgu terminology, Bahasa, Matematik, and year references.
- The extractor also produced noisy person candidates such as page-title fragments and names mentioned in the same article.
- A spelling variant `Shazwan Zakaria` was retained as a separate candidate.
- No phone or email was extracted.

Key product lesson:

The engine is now finding useful public context, but it needs **evidence attribution** rather than simply dumping extracted entities. A signal should show:

1. signal type;
2. value;
3. source title;
4. source URL;
5. confidence/reason;
6. whether it is directly associated with the top candidate or merely mentioned on the page.

## Next implementation milestone

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
- source quality.

Do not merge people solely because names are similar.

### UI target

Replace the current mostly-flat result presentation with:

- `Possible identity`
- `Why this matched`
- `Public profiles`
- `Work & education`
- `Location signals`
- `Other public signals`
- `Sources`

Every signal should be clickable back to its source.

## Regression subjects

Keep these as development tests:

- `Ramzul Mazwan bin Ramli` — full-name test subject
- `Ramzul Ramli` — common/public name test
- `Ramzulhakim Ramli` — different-person separation test
- `Fauzi Ariffin` — common Malaysian name / multi-source test
- `Shazzuwan Zakaria` — context-rich page / noisy extraction test
