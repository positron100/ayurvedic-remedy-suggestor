# Knowledge base (`content/`)

This directory **is** the Ayurvedic knowledge model — the single source of
truth for the recommendation engine. The legacy CSV (`data/drug-prescription.csv`)
is frozen archival input and is not read at runtime.

Editing a file here and running `npm run kb:build` is the whole update workflow.
No application code changes.

## Files

| File | Contents |
|---|---|
| `conditions.json` | The four in-scope conditions: symptom links, severity guidance, remedy links, red-flag references, professional-care guidance. |
| `remedies.json` | Canonical remedy records — one per remedy, deduplicated from the legacy spellings. |
| `symptoms.json` | The symptom vocabulary used for input matching (labels + lay synonyms). |
| `red-flags.json` | Symptoms/situations that divert to professional care instead of a remedy. |
| `safety.json` | Engine-wide safety policy: confidence thresholds, global red flags, the standing disclaimer. |
| `sources.json` | Citation registry. Every `sources` id elsewhere resolves to an entry here. |
| `PROVENANCE.md` | _Generated_ — maps every legacy CSV row to its canonical remedy. `npm run kb:ingest`. |
| `REVIEW-QUEUE.md` | What still needs authoritative sourcing and qualified review. |

## Provenance and verification — read before trusting a field

Every clinically-meaningful value carries a `provenance`:

| `provenance` | Meaning |
|---|---|
| `inherited-legacy-dataset` | Carried over from the old CSV. Tells us only that the old app paired these — **not clinically validated**. |
| `sourced` | Backed by a cited entry in `sources.json`. |
| `editorial` | Neutral connective text written by the maintainer (summaries, symptom phrasings). Makes no medical claim. |
| `unverified` | Placeholder. The field exists in the schema but has no trustworthy content yet. |

And every record carries a `verification.level`: `unverified` → `needs_review`
→ `sourced` → `reviewed`.

**A field existing in the schema does not mean it is authoritative.** Most
remedy clinical fields (`ingredients`, `traditionalUse`, `preparation`,
`usage`, most `contraindications`) are deliberately `null`/empty and the
remedy is `unverified`. They were **not** filled from model knowledge. See
`REVIEW-QUEUE.md`.

## Validation

`npm run kb:build` compiles `content/` → `src/generated/knowledge.json` and
**fails the build** on:

- a duplicate id within any collection
- a condition referencing an unknown symptom, remedy, or red flag
- any `sources` id that is not in `sources.json`
- a `sourced` field with no sources listed
- a missing required field (e.g. a condition without `whenToSeeProfessional`)

The same invariants are re-checked at runtime by `src/engine/validate.ts`.

## Adding a remedy

1. Add a record to `remedies.json` (start it `unverified` with empty clinical fields).
2. Link it from one or more conditions in `conditions.json`.
3. `npm run kb:build`.
4. If you have cited sources, fill the fields with `provenance: "sourced"` and add the citation to `sources.json`, then raise `verification.level`.
