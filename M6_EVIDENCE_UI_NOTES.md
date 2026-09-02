# M6 Evidence UI Notes

## 2026-09-03

M6 evidence-backed investigation presentation is now part of the live Silk Stalker Worker workflow.

The UI separates:
- identity assessment and confidence
- evidence signals and provenance
- discovered accounts
- independent attributes
- readable versus failed sources
- caution that discovered leads are not proof of identity

The product is now branded **Silk Stalker**. The primary UI wording is `Stalk a person` with a `STALK` action button.

Normal investigation requests use `POST /investigate` with JSON so the searched subject is not placed in the browser query URL. Legacy GET support remains for compatibility.

Related image discovery is also integrated with source/page provenance. The image feature does not perform face recognition or claim that an image proves identity.

The loading animation was attempted but is intentionally not a current milestone.

## Evidence lesson

The Fauzi Ariffin test demonstrated why the presentation must separate matching signals from identity claims: multiple matching-name results and social-profile leads were found, but no independent identity attribute was corroborated, so the assessment remains limited rather than claiming a confirmed identity.

## Next

Create the golden identity test set and improve cross-source corroboration before increasing crawl budgets. Then build the relationship graph, investigation history and reporting/export layers.
