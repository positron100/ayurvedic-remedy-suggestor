# Review queue — what still needs authoritative sourcing and review

The legacy CSV contained only `condition, age, gender, severity → drug name`.
It has **no** ingredients, preparation, dosage, contraindications,
interactions, or red-flag information. None of that was invented to fill the
schema. This file lists what is missing and what a qualified reviewer needs to
sign off before any of it should be presented as authoritative.

## Status at a glance

| Area | State |
|---|---|
| Conditions (4) | `needs_review` — symptom links & severity text are **editorial**; professional-care guidance is **sourced** (NHS). |
| Remedies (54) | **50 `unverified`**, 4 `sourced` (`ginger`, `ashwagandha`, `fenugreek`, `boswellia-curcumin`). |
| Red flags (16) | 15 `sourced` (NHS), 1 `editorial` (`rf-young-child`). |
| Symptom vocabulary (22) | `editorial` — lay descriptions, not clinical definitions. |

## 1. Remedy clinical content — 50 records, all fields

For every `unverified` remedy, these are absent and must be sourced per remedy:

- **Botanical / compositional identity** — for single herbs, the binomial and
  plant part; for `classical-formulation`, the ingredient list per a
  pharmacopoeia (e.g. the Ayurvedic Pharmacopoeia of India); for
  `mineral-preparation` (`bhasma` / `pishti` / `rasa`), the constituents and
  the well-documented heavy-metal-contamination concern.
- **Traditional use** — what the formulation is classically indicated for, with
  a text/pharmacopoeia citation. Several legacy pairings look wrong and are
  flagged in the data:
  - `sitopaladi-churna` ↔ diarrhea (classically respiratory)
  - `haritaki` ↔ severe diarrhea (classically a bowel regulator)
  - `shankha-prakshalana` ↔ migraine (an intensive supervised procedure, not a remedy)
- **Preparation & dosage** — deliberately left `null`. Do **not** add a dose
  without a citation and reviewer sign-off.
- **Contraindications, precautions, interactions** — currently only the 5
  `avoidIf: ["pregnancy"…]` flags below exist, and only for the sourced/obvious
  cases. Every other remedy has an empty safety profile, which is **not** a
  statement that it is safe.

Structured `avoidIf` flags currently set:
`fenugreek` (pregnancy), `ashwagandha` (pregnancy, breastfeeding),
`boswellia-curcumin` (pregnancy), `castor-oil` (pregnancy),
`shankha-prakshalana` (pregnancy).

## 2. Editorial safety notes that need a specific citation

These are in the data with `provenance: "editorial"` and a `note` asking for a
source; they should either be cited or removed:

- `ginger` — anticoagulant / antiplatelet interaction (widely stated, not on the cited NCCIH page).
- `giloy-satva` — reports of liver injury associated with Tinospora cordifolia.
- Generic `mineral-preparation` heavy-metal cautions on `tribhuvankirti-rasa`, `mrityunjaya-rasa`, `shankha-bhasma`, `vasant-kusumakar-ras`, `mukta-pishti`, `kamdudha-ras`, `praval-pishti`, `jahar-mohra-pishti`, `akik-pishti`.

## 3. Conditions

- `symptoms` weights and `hallmark` flags are editorial judgement — a clinician should confirm the symptom→condition weighting.
- `severityGuidance` text is editorial.
- `ayurvedicView` is `null` for all four — the Ayurvedic (dosha) framing has not been sourced.
- `whenToSeeProfessional` / `generalPrecautions` are sourced from NHS condition pages (accessed 2026-08-30) and should be re-checked against current guidance periodically.

## 4. Red flags

- Trigger phrase lists are hand-authored to match the cited guidance; they are
  not exhaustive and free-text matching is approximate. A reviewer should widen
  the trigger phrasings and confirm nothing critical is missing.
- `rf-young-child` is editorial (conservative — routes children to a professional).
- Known limitation: single-word triggers like `pregnant` can match negated text
  ("not pregnant"). Only affects `advisory` (non-diverting) flags today; worth
  fixing with proper negation handling.

## 5. Sources currently relied on

NHS condition pages (diarrhoea, gastritis, migraine, arthritis) and NCCIH herb
pages (ginger, ashwagandha, fenugreek, turmeric) — all Western health-authority
sources. **No classical Ayurvedic text or the Ayurvedic Pharmacopoeia of India
has been consulted yet**; that is the main gap for remedy-level content.
