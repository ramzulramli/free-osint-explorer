# M6 Evidence UI Notes

## 2026-08-31

Implemented the evidence-backed investigation presentation in `src/index.js`.

The UI now separates:
- identity assessment and confidence
- evidence signals and provenance
- discovered accounts
- independent attributes
- readable versus failed sources
- caution that discovered leads are not proof of identity

The Fauzi Ariffin test demonstrated why this separation matters: multiple matching-name results and social-profile leads were found, but no independent identity attribute was corroborated, so the assessment remains limited rather than claiming a confirmed identity.

## Next

Create a golden identity test set and improve cross-source corroboration before increasing crawl budgets.
