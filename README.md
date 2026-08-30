# Sattva

**Calm, structured Ayurvedic remedy guidance from a curated knowledge base.**

Sattva takes a plain-language description of how you feel, matches it —
_deterministically_ — against a small, hand-curated Ayurvedic knowledge base,
and returns structured guidance: a primary remedy suggestion, how it is
traditionally used, precautions, a match-strength indicator, and honest signals
for when to see a professional instead.

_Sattva_ (सत्त्व) is the Ayurvedic principle of balance, clarity and calm. The
name is provisional and lives in exactly two places — `src/data/site.ts` and
`index.html`.

- **Production:** https://ayurvedic-remedy-suggestor.vercel.app
- **Stack:** React 19 · TypeScript (strict) · Vite 8 · Tailwind v4 · Framer Motion 13 · Vitest 3 · oxlint
- **Hosting:** Vercel (GitHub `main` → auto-deploy), Vite SPA + `api/` edge functions

> **Not medical advice.** Sattva offers general information drawn from
> traditional Ayurvedic sources and cited health-authority guidance. It is not a
> medical diagnosis or a treatment plan, and it cannot account for your full
> health history. Always consult a qualified healthcare professional before
> starting any remedy, and seek prompt medical care for severe, sudden, or
> worsening symptoms.

---

## Table of contents

1. [What is Sattva?](#1-what-is-sattva)
2. [Current product status](#2-current-product-status)
3. [User flow — step by step](#3-user-flow--step-by-step)
4. [High-level architecture](#4-high-level-architecture)
5. [Recommendation engine](#5-recommendation-engine)
6. [Recommendation scoring](#6-recommendation-scoring)
7. [Safety architecture](#7-safety-architecture)
8. [Knowledge base](#8-knowledge-base)
9. [Adding / updating knowledge](#9-adding--updating-knowledge)
10. [Knowledge validation & compilation](#10-knowledge-validation--compilation)
11. [Frontend architecture](#11-frontend-architecture)
12. [State management](#12-state-management)
13. [AI / LLM architecture](#13-ai--llm-architecture)
14. [API architecture](#14-api-architecture)
15. [Environment variables](#15-environment-variables)
16. [Local development](#16-local-development)
17. [Available scripts](#17-available-scripts)
18. [Testing](#18-testing)
19. [Deployment](#19-deployment)
20. [Design system](#20-design-system)
21. [Performance](#21-performance)
22. [Common development tasks](#22-common-development-tasks)
23. [Architectural rules / guardrails](#23-architectural-rules--guardrails)
24. [Troubleshooting](#24-troubleshooting)
25. [Future roadmap](#25-future-roadmap)
26. [Contributing / developer checklist](#26-contributing--developer-checklist)

---

## 1. What is Sattva?

### The problem it solves

The original application was a single CSV (`condition, age, gender, severity,
drug`) behind a lookup. It could only answer "given this exact condition and
severity, what drug string did the dataset list?" — no symptom understanding, no
safety handling, no provenance, no way to know whether a pairing was trustworthy
or just an artefact of an old spreadsheet.

Sattva rebuilds that idea as a **symptom-first, safety-first guidance tool**:

- You describe symptoms in your own words (or pick from chips).
- A deterministic engine normalises that text, matches it to conditions and
  remedies in a curated knowledge base, and filters the result through explicit
  safety rules.
- Every fact on screen is traceable to a knowledge-base record, and every record
  carries provenance and a verification level so the UI can be honest about what
  is sourced and what is just an inherited legacy pairing.

### What makes it different from the original app

| Original app | Sattva |
|---|---|
| Exact `condition + severity` lookup | Free-text symptom description → normalised → matched |
| Raw drug string | Canonical remedy record with aliases, type, provenance |
| No safety logic | Red-flag diversion + demographic contraindication filtering, evaluated **before** any remedy |
| No confidence signal | 0–1 confidence from match quality, surfaced as "Strong / Good / Limited match" |
| CSV is the runtime dependency | CSV is **frozen archival input**; a curated JSON knowledge base is the source of truth |
| No citations | `sources.json` registry; every clinical claim resolves to a citation or is explicitly marked unverified |

### Deterministic recommendation vs optional AI enhancement

The recommendation is **100% deterministic**. It is computed by pure TypeScript
in the browser (`src/engine/`), from the compiled knowledge base, with no network
call and no language model.

An **optional** LLM layer (`api/`) does exactly two _presentational_ things when
it is configured:

1. **`parse-intent`** — turn free text the deterministic normalizer could not
   understand into candidate symptom ids (constrained to the KB vocabulary),
   which are re-fed into the deterministic engine.
2. **`phrase`** — rewrite already-decided templated prose into warmer language,
   in fixed UI slots, grounded strictly in facts the engine already produced.

The LLM can never choose a remedy, name a condition, override a safety rule,
change a confidence value, or invent a fact. If it is absent, slow, or fails, the
user sees the deterministic result and nothing looks wrong.

### The role of the curated knowledge base

`content/*.json` is the entire medical model. It is condition-centric: symptoms
link to conditions, conditions link to remedies and red flags, and every
clinically-meaningful value carries `provenance` + `verification`. Editing a file
in `content/` and running `npm run kb:build` is the whole content-update
workflow — no application code changes.

### Safety-first philosophy

When the engine is unsure, it says so. When any input looks like a red flag, it
diverts to "see a professional" and suggests **no remedy at all**. When a remedy
conflicts with a volunteered demographic (pregnancy, breastfeeding, young child,
older adult), it is removed. Absence of a warning is never presented as
"confirmed safe".

---

## 2. Current product status

### Implemented and working

- **React 19 + Vite 8 SPA**, TypeScript strict, Tailwind v4 CSS-first tokens.
- **Symptom input** — free text, autocomplete search, suggested/starter symptom
  chips, "your symptoms" chip list, severity segmented control, optional
  demographic context.
- **Natural-language normalization** — lowercase / punctuation strip / stopword
  drop / light stemmer / phrase matching with two matchers (loose for symptoms,
  ordered for red flags). No dependency, ~170 lines.
- **Deterministic recommendation engine** — `src/engine/`, pure functions, fully
  unit-tested.
- **Curated knowledge base** — 4 conditions, 54 remedies (4 with sourced
  content), 22 symptoms, 16 red flags. Compiled + validated by
  `scripts/build-knowledge.mjs`.
- **Confidence / match strength** — 0–1 value with plain-language reasons,
  rendered as a `ConfidenceMeter`.
- **Safety / red-flag handling** — red-flag diversion, demographic
  contraindication filtering, unverified-content flagging, standing disclaimer.
- **Structured recommendation UI** — distinct screens for each outcome kind
  (`ok`, `low_confidence`, `insufficient_information`, `no_matching_condition`,
  `red_flag`), remedy cards, disclosure sections, provenance badges, source
  lists.
- **Themes** — light / dark, no-flash inline boot script, drag-controlled
  reveal animation using the View Transitions API.
- **Responsive + accessible** — mobile-first, keyboard skip link, `inert` gate
  during the opening reveal, `prefers-reduced-motion` respected throughout,
  `aria-live` regions on processing and result.
- **Optional LLM enhancement layer** (`api/recommend.ts` + `api/_llm/`) —
  provider-agnostic, two providers implemented (`anthropic`, `nvidia`).
  **Currently active in production** with `LLM_PROVIDER=nvidia`,
  `LLM_MODEL=meta/llama-3.2-11b-vision-instruct`. Best-effort — see §13.
- **Contact form + API** (`src/components/Contact/` + `api/contact.ts`) — letter/
  envelope send animation, validation, honeypot, per-address rate limit, Resend
  delivery. Inert without `RESEND_API_KEY`.
- **Deployment** — live on Vercel, GitHub `main` auto-deploy, both edge functions
  verified working.
- **Performance pass (Phase E)** — `LazyMotion` + `m` + `domAnimation`,
  code-split Result view with prefetch, `vendor-react` manual chunk,
  `scrollbar-gutter: stable`. See §21.

### Optional / disabled by default

- **LLM layer** is optional by design. With `LLM_PROVIDER` unset the app runs
  fully deterministically and the UI is identical minus the rephrased prose.
- **Anthropic provider** is implemented and tested but not the configured
  production provider.
- **Contact form** returns "Unable to send right now." and points at the
  `mailto:` link when `RESEND_API_KEY` / `CONTACT_EMAIL` / `EMAIL_FROM` are
  missing.

### Planned / not built

- Font `<link rel="preload">` for the two first-screen faces (Phase E §5 — not
  done; `index.html` still loads fonts via a single render-non-blocking Google
  Fonts stylesheet with `display=swap`).
- `knowledge.json` async chunk split (Phase E §3 — deliberately deferred; the
  95 kB compiled KB is still in the entry chunk).
- Any condition beyond the four in scope; any remedy clinical content beyond the
  4 sourced remedies — see `content/REVIEW-QUEUE.md`.
- Ayurvedic-practitioner review of the editorial symptom/condition text.

---

## 3. User flow — step by step

```text
Opening reveal overlay  (IntroOverlay — covers the KB load; site is `inert` beneath it)
        │
        ▼
Landing  (stage = "compose")
   Hero + SymptomInput, "How it works", "About", "Contact"
        │
        │  user types free text  AND/OR  picks symptom chips
        │  optionally sets severity + demographic context
        ▼
Submit  →  useAssessment.run(EngineInput)
        │
        ▼
recommend(kb, input)  — synchronous, deterministic  (src/engine/assemble.ts)
   1. normalize      free text → matched symptoms (+ named conditions, + red-flag hits)
   2. red-flag check detectRedFlags — emergency/urgent short-circuits everything
   3. retrieve       scoreConditions → ranked conditions; rankRemedies → candidates
   4. safety filter  applySafetyFilter — drop/annotate remedies by demographic flags
   5. confidence     assessConfidence → 0–1 value + contenders + reasons
   6. assemble       pick `kind` from thresholds; buildNarrative → templated prose
        │
        ▼
Processing  (stage = "processing", ~950 ms honest hand-off — skipped under reduced motion)
        │
        │  (only if the engine said insufficient/no-match AND free text was given AND LLM ready)
        │  parse-intent → symptom hints → merge → recommend() runs AGAIN
        │
        ▼
Result  (stage = "result")  — Result.tsx routes on `recommendation.kind`
        │
        │  (background, non-blocking, only for ok/low_confidence with free text + LLM ready)
        │  phrase → rewrites narrative.summary / whyItMayHelp / howItIsUsed in place
        ▼
Refine (re-runs the engine with more symptoms)  |  Restart (back to compose)
```

### Alternate flows

**Normal recommendation (`ok`).** ≥ 2 recognised symptoms, confidence ≥
`lowConfidenceThreshold` (0.5). Renders `Guidance` — `ConfidenceMeter`, a primary
`RemedyCard`, secondary remedies, "when to see a professional", condition
sources.

**Low confidence (`low_confidence`).** Confidence in `[0.22, 0.5)`. Same
`Guidance` screen, but the copy is hedged ("a tentative match, read it lightly")
and a "Not sure this is right?" panel offers clarifying-symptom chips that call
`onRefine`.

**Insufficient information (`insufficient_information`).** Fewer than
`minSymptomSignals` (2) recognised symptoms, **or** confidence <
`insufficientInfoThreshold` (0.22). Renders `NeedMoreInfo` with suggested
clarifying symptoms. If the user typed free text and the LLM layer is on, this is
the state that triggers a `parse-intent` call before the result is shown.

**No matching condition (`no_matching_condition`).** ≥ 2 symptoms recognised but
none scored against any of the 4 in-scope conditions. Renders `NoMatch` — "this
is outside what Sattva covers", with a professional-care pointer.

**Red flag (`red_flag`).** Any red-flag hit whose urgency is `emergency` or
`urgent` (from free text triggers or from a demographic flag). Short-circuits
**before retrieval** — `suggestions` is empty. Renders `SeeAProfessional` with
the red-flag guidance. `advisory`-urgency hits do _not_ divert; they ride along
as `redFlags` on a normal result.

**Restart / refine.** `restart()` clears state and returns to `compose`.
`refine(patch)` merges new symptom ids / demographics into the existing input and
re-runs the whole engine (so safety and red flags are always re-evaluated).

---

## 4. High-level architecture

```mermaid
flowchart TD
    U[User] --> UI[React UI - src/views, src/components]
    UI --> H[useAssessment hook - src/hooks]
    H --> ENG[Deterministic engine - src/engine]

    subgraph ENG[src/engine - pure TypeScript, no React, no network]
      N[normalize] --> SF1[safety.detectRedFlags]
      SF1 --> R[retrieve.scoreConditions + rankRemedies]
      R --> SF2[safety.applySafetyFilter]
      SF2 --> C[confidence.assessConfidence]
      C --> A[assemble.recommend + templates.buildNarrative]
    end

    KB[(content/*.json)] -->|build-knowledge.mjs| GEN[(src/generated/knowledge.json)]
    GEN --> H
    A --> RES[Recommendation object]
    RES --> RUI[Result UI - src/views/Result.tsx]

    H -. optional, best-effort .-> API[/api/recommend - Vercel edge fn/]
    API --> PROV[LLM provider - anthropic | nvidia]
    PROV -. hints / prose only .-> H

    UI -. contact form .-> CAPI[/api/contact - Vercel edge fn/]
    CAPI --> RESEND[Resend email API]
```

Key properties the diagram encodes:

- The engine is a closed box. Its only inputs are `EngineInput` and the compiled
  `KnowledgeBase`. It never touches the network, `window`, or `import.meta.env`.
- The knowledge base is **compiled at build time** (`content/` → `generated/`)
  and validated again at load time as a fail-safe.
- The LLM path is a dashed side-channel. The solid path (KB → engine →
  `Recommendation` → UI) always runs and always wins.
- `api/` functions are the only place server-side secrets live. The browser only
  ever sees JSON on the wire.

---

## 5. Recommendation engine

`src/engine/` — a pure TypeScript module. **No React import, no `fetch`, no env
access.** Every step is a pure function; the same input always produces the same
output. This is why the engine is exhaustively unit-testable in Node with no DOM.

| File | Responsibility |
|---|---|
| `types.ts` | The `KnowledgeBase` data model — `Condition`, `Remedy`, `Symptom`, `RedFlag`, `SafetyConfig`, the `Attributed<T>` / `Provenance` / `VerificationLevel` provenance model. No logic. |
| `result.ts` | The engine's **I/O contract** — `EngineInput` (text? / symptomIds? / severity? / demographics), `RecommendationKind`, `Recommendation`, `RecommendationNarrative`, `MatchedSymptom`, `RemedySuggestion`, `RedFlagHit`. |
| `normalize.ts` | Text → normalised tokens → vocabulary matches. `normalizeText`, `stem`, `tokenize`, `matchText` (symptoms + red flags + named conditions), `resolveChosenSymptoms`, `mergeSymptoms` (chip wins over text). Pure string work. |
| `retrieve.ts` | Scoring. `scoreConditions` (matched symptoms → ranked conditions) and `rankRemedies` (condition + severity + age → ranked candidate remedies). No safety, no prose. |
| `safety.ts` | Safety policy. `detectRedFlags` (whole-request diversion), `demographicFlags` (volunteered demographics → structured flags), `applySafetyFilter` (drop / annotate individual remedies). |
| `confidence.ts` | `assessConfidence(ranked, signalCount)` → 0–1 value + contenders + plain-language reasons. Isolated so "how sure are we" policy lives in one place. |
| `assemble.ts` | `recommend(kb, input)` — the **only** place the pipeline order is expressed. Wires the modules above and decides `kind` from the safety thresholds. |
| `templates.ts` | `buildNarrative(...)` — deterministic templated prose per `kind`. Tolerates missing / unverified fields: if the KB has nothing trustworthy, the prose says exactly that. |
| `validate.ts` | `assertValidKnowledgeBase` / `findKnowledgeBaseProblems` / `KnowledgeBaseError` — runtime structural re-check (no dup ids, no dangling cross-refs, required collections present). |
| `index.ts` | The public surface. `recommend` + the validators + re-exported types, plus the lower-level functions for tests. |
| `__fixtures__/kb.ts` | A hand-built `KnowledgeBase` fixture. Engine tests use this, **never** the real compiled KB. |

### Data flow through the engine

```text
EngineInput { text?, symptomIds?, severity?, demographics? }
      │
      ▼  normalize.ts
matchText(text)  →  { symptoms, redFlags, namedConditionIds }
resolveChosenSymptoms(symptomIds)  →  chip symptoms
mergeSymptoms(chips, text)  →  MatchedSymptom[]
      │
      ▼  safety.ts   (BEFORE retrieval)
detectRedFlags(kb, input)  →  { hits, diverts, highestUrgency }
      │  diverts?  ──► return { kind: "red_flag", suggestions: [] }
      │
      ▼  assemble.ts guard
symptoms.length < minSymptomSignals?  ──► return { kind: "insufficient_information" }
      │
      ▼  retrieve.ts
scoreConditions(kb, symptoms, namedConditionIds)  →  ConditionMatch[]  (ranked)
      │  empty?  ──► return { kind: "no_matching_condition" }
      │
      ▼  confidence.ts
assessConfidence(ranked, symptoms.length)  →  { value, contenders, reasons }
      │
      ▼  retrieve.ts + safety.ts
rankRemedies(kb, top.condition, { severity, ageYears })  →  RemedySuggestion[]
applySafetyFilter(suggestions, input)  →  { kept, removed }
      │
      ▼  assemble.ts
kind = value < 0.22 ? "insufficient_information"
     : value < 0.5  ? "low_confidence"
     : "ok"
buildNarrative(...)  →  RecommendationNarrative
      │
      ▼
Recommendation  { kind, condition?, suggestions, redFlags, confidence,
                  confidenceReasons, contenderConditionNames,
                  recognisedSymptoms, clarifyingSymptomIds, disclaimer,
                  narrative, enhanced? }
```

**Recommendation logic does not belong in React components.** Views and
components consume a finished `Recommendation` and render it. `Result.tsx`
explicitly has "no logic here — the engine already decided `kind`". If you find
yourself computing a score, a threshold, or a safety decision inside a component,
it belongs in `src/engine/`.

---

## 6. Recommendation scoring

This is the **actual algorithm in the code today**, not a hypothetical.

### Symptom matching (`normalize.ts`)

Free text is lowercased, apostrophes removed, non-`[a-z0-9\s-]` replaced with
spaces, whitespace collapsed. A conservative stemmer strips `ing` / `ed` / `ly` /
`es` / trailing `s` (never `ss`). Stopwords (`a`, `the`, `i`, `feel`, `my`,
`have`, …) are dropped.

Two matchers run over the normalised text:

- **`loose`** — used for the **symptom** vocabulary. Every significant stemmed
  word of a symptom label/synonym must appear, in _any_ order. High recall:
  "burns in my stomach" matches "burning stomach".
- **`ordered`** — used for **red flags** and **condition names**. The phrase must
  appear verbatim, or its significant stemmed words must appear in the same
  relative order. Tighter on purpose: "no blood but I was vomiting" does **not**
  match the red-flag trigger "vomiting blood".

Each `Symptom` has a `label`, `synonyms[]` (lay phrasings — e.g.
`upper-abdominal-burning` has 13), and a `category`. A match on any phrase counts
as a hit for that symptom id. Chip selections are resolved directly by id;
`mergeSymptoms` de-dupes so a chip wins over a text match for the same id.

### Condition scoring (`retrieve.ts` → `scoreConditions`)

For each condition:

```text
totalWeight = Σ (weight of every symptom link on this condition)   (min 1)
hitWeight   = Σ (weight of each symptom link whose id was matched)

score = hitWeight / totalWeight
if a matched link is a hallmark symptom:      score = min(1, score + 0.15)
if the condition was named outright in text:  score = min(1, score + 0.35)
```

Symptom link `weight` is `1`–`3` (`3` = hallmark-level prominence). Normalising by
the condition's own total weight stops a condition with many listed symptoms from
always winning on raw overlap. Conditions with `score > 0` are kept and sorted
descending.

### Remedy ranking (`retrieve.ts` → `rankRemedies`)

For each `remedyId` linked from the chosen condition:

```text
relevance = link.weight / 3                         (0.33 – 1.0 base)

if a severity was supplied:
  bandDistance = min |SEVERITY_ORDER.indexOf(linkSeverity) − indexOf(requested)|
  bandDistance == 0 →  relevance += 0.35   (+ rationale line)
  bandDistance == 1 →  relevance += 0.10
  else             →  relevance -= 0.10

if an age was supplied and link.ageContext matches the age band:
  relevance += 0.10   (+ rationale line)

if link.weight == 3:  add "one of the more prominent options" rationale
if link.note:         add the note as a rationale line

relevance = clamp(relevance, 0, 1)
```

`SEVERITY_ORDER = ["mild", "moderate", "severe"]`. Age bands: `<12` child, `<18`
adolescent, `<60` adult, else older-adult. Sorted descending, then the safety
filter runs, then the top `MAX_SUGGESTIONS` (4) are kept.

### Gender

**Not used.** The legacy CSV had a `gender` column; migration analysis
(`content/PROVENANCE.md`) found the remedy never varied by gender, so it was
dropped. There is no gender input and no gender logic anywhere.

### Confidence (`confidence.ts` → `assessConfidence`)

```text
value = topCondition.score
value += min(0.2, max(0, signalCount − 1) * 0.07)      (signal-count boost)

gap = topScore − runnerUpScore   (or topScore if no runner-up)
if runnerUp and gap < 0.12 (AMBIGUITY_BAND):  value -= 0.15   (+ contenders listed)
else if gap >= 0.3:                           value += 0.10

value = clamp(value, 0, 1)
```

`contenders` = every condition within `0.12` of the top score (used to suggest
clarifying symptoms).

### Thresholds (`content/safety.json` → `safety`)

| Threshold | Value | Effect |
|---|---|---|
| `minSymptomSignals` | `2` | Fewer recognised symptoms → `insufficient_information` |
| `insufficientInfoThreshold` | `0.22` | `confidence < 0.22` → `insufficient_information` |
| `lowConfidenceThreshold` | `0.5` | `0.22 ≤ confidence < 0.5` → `low_confidence`; `≥ 0.5` → `ok` |

Change these in `content/safety.json`, re-run `npm run kb:build`, and **re-run the
engine tests** — several assertions are calibrated against these numbers.

### Worked example

Input: `"burning pain in my upper stomach that gets worse after meals"`, severity
`moderate`.

1. `matchText` → `upper-abdominal-burning` (synonym "burning after eating" area),
   `worse-after-eating`. 2 signals.
2. No red flags.
3. `scoreConditions` — Gastritis links: `upper-abdominal-burning` w3 (hallmark),
   `worse-after-eating` w2, plus others; `totalWeight` ≈ 13. `hitWeight` = 5 →
   `score` ≈ 0.38, `+0.15` hallmark → ≈ 0.53. Other conditions score ~0.
4. `assessConfidence` — `value` = 0.53, `+0.07` (2 signals) → 0.60, big gap to
   runner-up → `+0.10` → ~0.70. → `kind: "ok"`.
5. `rankRemedies(Gastritis, { severity: "moderate" })` — `panchakola-churna`
   (w3, severity `[moderate, severe]`, bandDistance 0) → `1.0 + 0.35` clamped to
   1.0. Top suggestion.
6. `applySafetyFilter` — no demographics volunteered, remedy is `unverified` →
   kept with an "informational only" note.

---

## 7. Safety architecture

> **Safety always overrides recommendation.**

Safety logic lives entirely in `src/engine/safety.ts`. Its data comes from
`content/red-flags.json`, `content/safety.json`, and the `avoidIf` /
`contraindications` / `verification` fields on each remedy in
`content/remedies.json`. It is pure and deterministic like the rest of the
engine.

### Precedence (enforced in `assemble.ts`, in this order)

1. **Red-flag diversion.** `detectRedFlags` runs _before_ retrieval. If any hit's
   urgency is `emergency` or `urgent`, the engine returns `kind: "red_flag"` with
   an empty `suggestions` array. No remedy is ranked, scored, or shown.
2. **Insufficient information.** Fewer than `minSymptomSignals` recognised
   symptoms → stop and ask for more.
3. **No matching condition.** Symptoms recognised but nothing scored → out of
   scope.
4. **Confidence gate.** `low_confidence` vs `ok` from the thresholds.
5. **Per-remedy safety filter.** `applySafetyFilter` on the ranked candidates.

### Red flags (`content/red-flags.json`, 16 records)

Each has `triggers[]` (phrases matched with the strict `ordered` matcher),
`guidance`, `urgency` (`emergency` | `urgent` | `advisory`), `provenance`, and
usually `sources` (15/16 are NHS-sourced). Red flags are matched two ways:

- **Text triggers** — `matchText` scans _every_ red flag in the KB, so a red flag
  never depends on the engine first guessing the condition correctly.
- **Demographic triggers** — `demographicFlags(input)` turns volunteered
  demographics into `pregnancy` / `breastfeeding` / `child` (age < 12) /
  `older-adult` (age ≥ 60), matched against each red flag's `triggers`.

`advisory` hits do not divert — they attach to a normal result as context.

### Per-remedy filtering (`applySafetyFilter`)

- **`avoidIf` ∩ demographic flags** → remedy **removed**, recorded in `removed`
  with a reason.
- **Structured `contraindications`** matching a demographic flag → remedy
  **kept**, but a `Caution (…)` note is added and surfaced in the UI.
- **`verification.level === "unverified"`** → kept, but flagged "details have not
  been verified — treat as informational only". The UI shows verification state
  via its own badge and filters this specific line out of the per-request notes.

If _every_ remedy for a matched condition is filtered out, `Guidance` renders a
"speak with a professional about options appropriate for you" panel instead of a
remedy card.

### Disclaimers

The standing disclaimer (`content/safety.json` → `safety.disclaimer`, mirrored in
`src/data/site.ts`) is attached to **every** `Recommendation` and shown in the
footer, under the symptom input, and on every result screen. It is defined
centrally so it reads identically everywhere.

### The LLM cannot touch any of this

- `parse-intent` output is re-validated (`api/_llm/validate.ts` →
  `validateIntent`) against the allowed symptom id set, then fed back through the
  **full** deterministic engine — red flags and safety filtering re-run on the
  original text regardless of what the model returned.
- `phrase` output is re-validated (`validatePhrasing`): strips markup, rejects
  overclaim language (`proven`, `cures`, `treats`, …) on non-verified remedies,
  rejects invented `traditionalContext` when the KB has no such fact, enforces
  length caps. On any failure the deterministic template prose is kept.
- `applyPhrasing` (`src/lib/grounding.ts`) only ever writes `narrative.summary`,
  `narrative.whyItMayHelp`, and (conditionally) `narrative.howItIsUsed`. It never
  touches `precautionsIntro`, `professionalCareIntro`, the structured
  suggestions, confidence, or provenance.

---

## 8. Knowledge base

```text
content/
├── conditions.json      { _note, conditions: [...] }   4 in-scope conditions
├── remedies.json        { _note, unverifiedSummary, remedies: [...] }   54 canonical remedies
├── symptoms.json        { _note, symptoms: [...] }      22 symptoms (label + lay synonyms)
├── red-flags.json       { _note, redFlags: [...] }      16 divert-to-professional triggers
├── safety.json          { _note, safety: { globalRedFlags, thresholds, disclaimer } }
├── sources.json         { sources: [...] }              citation registry
├── README.md            how to edit content + the provenance/verification model
├── REVIEW-QUEUE.md       what still needs authoritative sourcing + qualified review
└── PROVENANCE.md         GENERATED — every legacy CSV row → its canonical remedy id
```

| File | Purpose |
|---|---|
| `conditions.json` | Each condition: `id`, `name`, `aliases[]`, `summary`, `symptoms[]` (`{ symptomId, weight 1–3, hallmark? }`), `severityGuidance` (all 3 bands required), `sensitiveDemographics[]`, `remedies[]` (`{ remedyId, severity[], ageContext, weight, provenance, note? }`), `redFlags[]`, `generalPrecautions[]`, `whenToSeeProfessional[]` (required), `sources[]`, `verification`. |
| `remedies.json` | One canonical record per remedy, deduplicated from legacy spellings: `id`, `canonicalName`, `aliases[]`, `type` (6 kinds — `single-herb`, `classical-formulation`, `mineral-preparation`, …), `summary`, `ingredients[]`, `traditionalUse`, `preparation`, `usage`, `contraindications[]`, `precautions[]`, `interactions[]`, `avoidIf[]` (demographic flags), `sources[]`, `verification` (`{ level, summary }`). Most clinical fields are deliberately `null`/`[]` and `unverified`. |
| `symptoms.json` | The input-matching vocabulary: `id`, `label`, `synonyms[]` (lay phrasings), `category`. Editorial — lay descriptions, not clinical definitions. |
| `red-flags.json` | `id`, `label`, `triggers[]`, `guidance`, `urgency`, `provenance`, `sources[]`. |
| `safety.json` | `globalRedFlags[]` (always in scope), `lowConfidenceThreshold`, `insufficientInfoThreshold`, `minSymptomSignals`, `disclaimer` (`short` + `full`). |
| `sources.json` | The citation registry. Every `sources` id used anywhere else must resolve to an entry here (build fails otherwise). |

### Relationships

```text
symptoms.json ──(symptomId, weight, hallmark)──►  conditions.json
                                                       │
                                        (remedyId, severity[], weight)
                                                       ▼
                                                 remedies.json
                                                       │
                                    (sources[], provenance, verification)
                                                       ▼
                                    sources.json  +  per-record verification level
```

### Provenance & verification (read `content/README.md` before trusting a field)

Every clinically-meaningful value carries a `provenance`:

| `provenance` | Meaning |
|---|---|
| `inherited-legacy-dataset` | Carried over from the old CSV. Tells us only that the old app paired these — **not clinically validated**. |
| `sourced` | Backed by a cited entry in `sources.json`. |
| `editorial` | Neutral connective text written by the maintainer. Makes no medical claim. |
| `unverified` | Placeholder — the field exists in the schema but has no trustworthy content yet. |

And every record carries a `verification.level`: `unverified` → `needs_review` →
`sourced` → `reviewed`. **A field existing in the schema does not mean it is
authoritative.** Currently: 50/54 remedies are `unverified`; 4 (`ginger`,
`ashwagandha`, `fenugreek`, `boswellia-curcumin`) are `sourced`.

### Compilation

`content/*.json` → `scripts/build-knowledge.mjs` → `src/generated/knowledge.json`
(git-ignored). The build runs automatically on `predev`, `prebuild`, and
`pretest`. `src/lib/knowledge.ts` imports the generated file, runs
`assertValidKnowledgeBase` once as a fail-safe, and caches it.

`data/drug-prescription.csv` is **frozen archival input** — it is not read at
runtime and the engine does not depend on it. `PROVENANCE.md` records how each
legacy row was folded into a canonical remedy during migration.

---

## 9. Adding / updating knowledge

The whole workflow: **edit a file in `content/`, run `npm run kb:build`, run
`npm test`.** No application code changes.

### Add a new symptom

1. Add to `content/symptoms.json` → `symptoms[]`:
   ```json
   { "id": "night-sweats", "label": "Waking up sweating at night",
     "synonyms": ["night sweats", "sweating in my sleep", "wake up drenched"],
     "category": "general" }
   ```
2. Link it from at least one condition (see below) — an unlinked symptom compiles
   but can never contribute to a score.
3. `npm run kb:build`.

### Add a synonym

Add a string to an existing symptom's `synonyms[]` in `content/symptoms.json`.
Run `npm run kb:build`. Consider adding a `normalize.test.ts` case if the phrasing
is non-obvious (contractions, word order).

### Add a new condition

1. Add to `content/conditions.json` → `conditions[]`. Required fields: `id`,
   `name`, `aliases[]`, `summary`, `symptoms[]`, `severityGuidance` (**all three
   of** `mild` / `moderate` / `severe`), `sensitiveDemographics[]`, `remedies[]`,
   `redFlags[]`, `generalPrecautions[]`, `whenToSeeProfessional[]` (**required**,
   non-empty), `sources[]`, `verification`.
2. Every `symptomId`, `remedyId`, `redFlags` id, and `sources` id must already
   exist in the respective file.
3. Add the condition name to `conditionsInScope` in `src/data/site.ts` and the
   `no_matching_condition` / `no_matching` copy in `src/engine/templates.ts` if
   you want the "in scope" prose to mention it.
4. `npm run kb:build && npm test`.

### Add a remedy

1. Add to `content/remedies.json` → `remedies[]`. Start it **`unverified` with
   empty clinical fields**:
   ```json
   { "id": "triphala-churna", "canonicalName": "Triphala Churna",
     "aliases": ["triphala"], "type": "classical-formulation",
     "summary": null, "ingredients": [], "traditionalUse": null,
     "preparation": null, "usage": null, "contraindications": [],
     "precautions": [], "interactions": [], "avoidIf": [], "sources": [],
     "verification": { "level": "unverified", "summary": "Legacy pairing only." } }
   ```
2. Link it from one or more conditions' `remedies[]`:
   ```json
   { "remedyId": "triphala-churna", "severity": ["mild", "moderate"],
     "ageContext": "any", "weight": 2, "provenance": "inherited-legacy-dataset" }
   ```
3. `npm run kb:build`. (An unlinked remedy is a **warning**, not an error.)
4. If you have citations, fill the clinical fields with `provenance: "sourced"`,
   add the citation to `sources.json`, and raise `verification.level`.

### Link a remedy to a condition

Add a `{ remedyId, severity[], ageContext, weight, provenance, note? }` object to
that condition's `remedies[]` in `conditions.json`. `weight` is `1`–`3`.
`severity[]` is any subset of `["mild","moderate","severe"]`. `ageContext` is
`"any"` or an age band.

### Add / update safety information

- **A new red flag:** add to `content/red-flags.json` → `redFlags[]` with
  `triggers[]`, `guidance`, `urgency`, `provenance`, `sources[]`. Add the id to
  `content/safety.json` → `globalRedFlags` if it should always be in scope, or to
  a condition's `redFlags[]` if condition-specific.
- **Block a remedy for a demographic:** add `"pregnancy"` / `"breastfeeding"` /
  `"child"` / `"older-adult"` to that remedy's `avoidIf[]` in `remedies.json`.
- **Softer caution:** add a `contraindications[]` entry with a `flag` +
  `detail` — the remedy stays but the UI shows the caution.
- Adjust thresholds in `content/safety.json` — then **re-run engine tests**.

### Add a source

Add to `content/sources.json` → `sources[]` (`id`, `title`, `publisher`, `url`,
etc.). Any record that cites it uses the `id` in its `sources[]` array. A
`provenance: "sourced"` field with an empty `sources[]` **fails the build**.

### Mark information verified / unverified

Set `verification.level` on the record (`unverified` → `needs_review` →
`sourced` → `reviewed`) and the per-field `provenance`. Moving a field to
`sourced` requires a matching entry in its `sources[]`.

---

## 10. Knowledge validation & compilation

```text
content/*.json
     │
     ▼   scripts/build-knowledge.mjs   (hand-rolled validator, no ajv)
  ┌──────────────────────────────────────────────┐
  │ • build id sets per collection → dup detection │
  │ • every sources id resolves in sources.json    │
  │ • provenance / verification / urgency / severity│
  │   / demographic / remedy-type enums            │
  │ • condition → symptom / remedy / redFlag / src  │
  │   cross-references all resolve                  │
  │ • weights are 1–3                              │
  │ • whenToSeeProfessional present & non-empty     │
  │ • severityGuidance has all 3 bands             │
  │ • checkAttributed: provenance "sourced" ⇒ sources│
  │ • reverse check: remedy linked from no condition│
  │   → WARNING (not error)                        │
  └──────────────────────────────────────────────┘
     │  exit 1 on any error
     ▼
src/generated/knowledge.json
  { version: 1, generatedAt, conditions, remedies, symptoms, redFlags, sources, safety }
     │
     ▼   src/lib/knowledge.ts  →  assertValidKnowledgeBase (runtime fail-safe re-check)
     ▼
src/engine  (consumes the KnowledgeBase)
```

### Why the generated file exists

- **Speed & simplicity at runtime** — one static JSON import, no runtime file
  assembly, no validation library in the bundle.
- **Build-time failure** — a broken cross-reference fails `npm run build` (via
  `prebuild`) and `npm test` (via `pretest`), not in production.
- **A single canonical shape** — the six source files with their `_note` wrappers
  become one flat `KnowledgeBase`.

### Do not edit the generated file

`src/generated/` is **git-ignored** and regenerated on every `predev` /
`prebuild` / `pretest`. Any manual edit is silently overwritten. **Edit
`content/*.json`, never `src/generated/knowledge.json`.**

### What a validation error means

The script prints the offending id and the rule. Common ones:

| Message shape | Fix |
|---|---|
| `duplicate id "x" in remedies` | Two records share an `id`. Rename one. |
| `condition "gastritis" references unknown symptom "x"` | The `symptomId` isn't in `symptoms.json`. Add it or fix the typo. |
| `unknown source id "x"` | Add the citation to `sources.json` or fix the reference. |
| `"sourced" field has no sources` | Add a `sources[]` entry, or drop `provenance` to `editorial` / `unverified`. |
| `condition "x" missing whenToSeeProfessional` | Add the required non-empty array. |
| `severityGuidance missing band "moderate"` | All three of `mild`/`moderate`/`severe` are required. |

On success: `[kb] ok — 4 conditions, 54 remedies, 22 symptoms, 16 red flags.
4/54 remedies have sourced content.`

---

## 11. Frontend architecture

```text
src/
├── main.tsx            React root
├── App.tsx             stage router (compose | processing | result), LazyMotion, intro gate
├── index.css           Tailwind v4 @import + CSS-first design tokens (@theme inline)
│
├── views/              full-screen stages — one per assessment stage
│   ├── Landing.tsx      Hero + SymptomInput + "How it works" + "About" + Contact
│   ├── Processing.tsx   ~950 ms honest hand-off (skipped under reduced motion)
│   └── Result.tsx       routes a Recommendation to an outcome screen (default export → lazy())
│
├── components/         presentational + interaction components
│   ├── SymptomInput/    SymptomInput, SymptomSearch, SymptomChip (feature-specific)
│   ├── result/          Guidance, RemedyCard, ConfidenceMeter, SeeAProfessional,
│   │                    NeedMoreInfo, NoMatch, ResultFrame, SecondaryRemedyList,
│   │                    SourceList, Provenance, PrecautionList (feature-specific)
│   ├── Contact/         Contact, ContactForm, ContactBackground (feature-specific)
│   ├── Navbar.tsx, Footer.tsx, IntroOverlay.tsx           (chrome)
│   ├── ThemeToggle.tsx, LiquidIndicator.tsx, Magnetic.tsx (reusable interaction)
│   ├── Reveal.tsx, SectionTitle.tsx, HeroBackground.tsx   (reusable presentation)
│   ├── LeafMark.tsx, Disclaimer.tsx, DisclosureSection.tsx
│
├── hooks/
│   ├── useAssessment.ts          the assessment lifecycle (see §12)
│   ├── useTheme.ts               light/dark state, localStorage, matchMedia
│   ├── useThemeToggleController.ts  drag-controlled reveal orchestration
│   ├── useIntro.ts               opening-overlay "done" state
│   ├── useActiveSection.ts       scroll-spy for the nav
│   ├── useMagnetic.ts            magnetic-hover motion values (pointer:fine + non-reduced only)
│   └── useTypeOnce.ts, useTypingPreview.ts   Contact form typing effects (ported from portfolio)
│
├── engine/            the deterministic recommendation engine (see §5) — NO React
├── lib/               glue between engine, KB, and the API
│   ├── knowledge.ts    getKnowledgeBase() — cached, validated compiled KB
│   ├── grounding.ts    buildPhrasePayload / applyPhrasing / allowedSymptoms
│   ├── recommendApi.ts browser client for /api/recommend — best-effort, never throws
│   ├── symptoms.ts     starterSymptoms / searchSymptoms / symptomLabels
│   ├── sources.ts      collectConditionSources
│   ├── contactForm.ts  validateContactForm (name ≥ 2, email pattern, message ≥ 10)
│   ├── contactService.ts  submitContactForm → POST /api/contact
│   └── cn.ts           className join helper
│
├── data/site.ts       ALL user-facing copy + config (siteConfig, disclaimer, severityOptions,
│                       confidenceBands, resultCopy, navLinks, examplePrompts) — never hardcode copy in JSX
├── utils/             leaf.ts (path geometry), themeReveal.ts (View Transitions keyframes),
│                      motion.ts (shared duration/ease/spring tokens), scroll.ts, tween.ts
└── generated/         knowledge.json — GIT-IGNORED, build output, do not edit
```

### Layer responsibilities

| Layer | Rule |
|---|---|
| `views/` | One per stage. Compose components; no business logic. |
| `components/result/*` | Render a finished `Recommendation`. `Result.tsx` switches on `kind` and hands off; the sub-components read structured fields. |
| `components/SymptomInput/*` | Build an `EngineInput` and call `onSubmit`. |
| `hooks/useAssessment` | The _only_ place stage transitions and the engine call live. |
| `engine/` | Pure. No React, no network. |
| `lib/` | Adapters. `recommendApi` + `grounding` are the LLM boundary on the client; `knowledge` + `symptoms` + `sources` are KB adapters. |
| `data/site.ts` | Copy and config. Changing wording is a one-file change here. |

### Notable components

- **`SymptomInput`** — free-text field + `SymptomSearch` autocomplete + starter /
  suggested / selected chips + severity segmented control. Emits `EngineInput`.
- **`ResultFrame`** — shared shell for every result screen (eyebrow, `aria-live`
  announce, heading, restart button).
- **`RemedyCard`** — a suggestion: name, type, rationale, precautions,
  provenance badge, source list. `primary` variant carries the narrative lead.
- **`ConfidenceMeter`** — renders the 0–1 confidence as a labelled bar
  ("Strong / Good / Limited match") with the engine's plain-language reasons and
  matched symptoms.
- **`SeeAProfessional`** — the `red_flag` screen. Red-flag guidance, no remedy.
- **`NeedMoreInfo`** — the `insufficient_information` screen with clarifying-
  symptom chips.
- **`DisclosureSection`** — reusable accessible `<details>`-style collapsible.
- **`Disclaimer`** — the standing medical disclaimer block.
- **`ThemeToggle` / `LiquidIndicator` / `Magnetic` / `Reveal`** — reusable
  interaction primitives, adapted from the author's portfolio.

---

## 12. State management

There is no state library. One hook — **`src/hooks/useAssessment.ts`** — owns the
entire assessment lifecycle. `App.tsx` renders the stage it reports.

```text
stage:  "compose"  ──submit──►  "processing"  ──(~950ms + optional parse-intent)──►  "result"
            ▲                         │ (reduced motion skips this stage entirely)      │
            └──────────── restart ────┴───────────────────────────────────────────────┘
                                          refine → re-runs run() with merged input
```

### Public surface

```ts
const { stage, input, recommendation, submit, refine, restart, llmReady } = useAssessment();
```

| Member | Meaning |
|---|---|
| `stage` | `"compose" \| "processing" \| "result"` |
| `input` | the current `EngineInput` (kept so `refine` can merge into it) |
| `recommendation` | the `Recommendation` from the engine (or `null`) |
| `submit(value)` | run the engine on a fresh `EngineInput` |
| `refine(patch)` | merge `patch` (symptom ids, demographics) into `input` and re-run — **the full engine re-runs, so safety + red flags are always re-evaluated** |
| `restart()` | clear everything, back to `compose` |
| `llmReady` | whether `/api/recommend` reported an LLM provider is configured |

### Internals (`run`)

1. `cancelPending()` — abort any in-flight request / timer.
2. `recommend(kb, input)` — synchronous deterministic result.
3. Decide `needsParse` — `true` only if there is free text **and** `llmReady`
   **and** the result was `insufficient_information` or `no_matching_condition`.
4. If `!needsParse && reduceMotion` → `finalize` immediately.
5. Otherwise `setStage("processing")`. If `needsParse`, call `parseIntent`,
   merge the validated hints, re-run `recommend`, then honour the minimum
   ~950 ms beat before `finalize`.
6. `finalize` — `setRecommendation`, `setStage("result")`, then — **only for
   `ok` / `low_confidence` with free text** — fire a background `phrase()` call
   whose result is merged with `applyPhrasing` **if** the recommendation on
   screen still matches (same `kind`, same primary remedy, not already
   `enhanced`).

### The boundary

React orchestrates _the UI_. It does not contain recommendation business logic.
`useAssessment` calls `recommend()` and routes stages; it never scores, filters,
or decides a `kind`. Everything medical is in `src/engine/`.

---

## 13. AI / LLM architecture

**Status: implemented, tested, and active in production** — but strictly a
best-effort enhancement. `LLM_PROVIDER=nvidia`,
`LLM_MODEL=meta/llama-3.2-11b-vision-instruct`.

```text
Knowledge base + deterministic engine  ──►  the recommendation  (always, authoritative)

LLM (optional)  ──►  (a) free-text → candidate symptom hints  → re-fed to the engine
                     (b) already-decided facts → warmer prose  → fixed UI slots only
```

### Provider abstraction (`api/_llm/`)

| File | Role |
|---|---|
| `types.ts` | `LLMProvider` interface (`model`, `parseIntent`, `phraseRecommendation`), `LLMEnv`, `IntentHints`, `PhrasePayload`, `PhrasedNarrative`, `ProviderError`. |
| `providers/index.ts` | `getProvider(env)` → a provider or `null`. `null` is the normal, fully-supported state. Switches on `env.LLM_PROVIDER`. |
| `providers/anthropic.ts` | Anthropic Messages API (`x-api-key` header). Default model `claude-haiku-4-5`. |
| `providers/nvidia.ts` | NVIDIA NIM, OpenAI-compatible `/chat/completions` at `https://integrate.api.nvidia.com/v1/chat/completions` (`Authorization: Bearer`). Default model `nvidia/nemotron-3.5-lightning-30b-a3b`. |
| `prompts.ts` | `INTENT_SYSTEM` / `PHRASE_SYSTEM` system prompts + user-message assembly. |
| `validate.ts` | `validateIntent`, `validatePhrasing`, `extractJsonObject` — the real grounding enforcement. |
| `dto.ts` | Wire types for `/api/recommend` (`CapabilitiesResponse`, `ParseIntentResponse`, `PhraseResponse`). |

**Adding a provider:** write `providers/<name>.ts` exposing
`create<Name>Provider(env): LLMProvider`, add one `case` to `getProvider`. Nothing
else changes.

### Request / response flow

```text
GET  /api/recommend                     → { llm: boolean, model?: string }
POST /api/recommend { op: "parse-intent", text, allowedSymptoms:[{id,label,synonyms}] }
                                        → { available: true, intent } | { available: false }
POST /api/recommend { op: "phrase", payload }
                                        → { available: true, phrased } | { available: false }
```

`_recommend.ts` (host-free core): validates `op`, applies a per-instance rate
limit (20 / 60 s per client key), calls `getProvider`, runs the operation, and
turns **any** failure into `{ available: false }` with **HTTP 200**. Input is
length-clamped (`text` 2000, `allowedSymptoms` 60, prose fields 800, …).

### Structured output & validation

- The model is asked to return a single JSON object. `extractJsonObject` pulls
  the first balanced `{…}` out of any wrapper prose.
- `validateIntent` — drops any symptom id not in the request's `allowedSymptoms`,
  accepts `severity` only from the literal set, clamps `durationDays` to
  `[0, 3650]`, caps at 8 symptoms.
- `validatePhrasing` — strips HTML tags + markdown chars, collapses whitespace,
  rejects the response entirely if it (a) puts overclaim language on a
  non-`sourced`/`reviewed` remedy, (b) returns `traditionalContext` when the
  payload has no `traditionalUse`/`preparation`/`usage`/`summary`, (c) exceeds
  the length caps.

### Fallback & timeout

- Per-call timeout: `LLM_TIMEOUT_MS` (default `8000`, clamped `1000`–`20000`),
  via `AbortController` in the provider.
- Client-side timeout: `CLIENT_TIMEOUT_MS = 12_000` in
  `src/lib/recommendApi.ts`; every client function resolves to `null` /
  `{ llm: false }` on any error and never throws.
- On the NVIDIA free tier, roughly 20–40% of real calls exceed the 8 s ceiling
  under endpoint congestion and fall back to deterministic prose. This is
  expected and invisible to the user — not a bug.

### Security & prompt-injection protection

- API keys are read from `process.env` **inside the edge function only**. They
  are never `VITE_`-prefixed, never in the client bundle, never logged to the
  wire. The dev server loads `LLM_*` with the empty env prefix precisely so they
  stay unreachable from the browser.
- User free text is **never** concatenated into a system prompt. It is placed as
  a JSON string _value_ in the user message; the system prompt states that value
  is untrusted data to be analysed, not instructions.
- Provider error bodies are read for the operator log only, sliced to 500 chars,
  and never returned to the browser.

### The distinction, restated

```text
LLM ≠ recommendation authority.
The engine decides WHAT is recommended and WHETHER it is safe.
The LLM, at most, helps READ the input and helps WORD the output.
```

---

## 14. API architecture

`api/` is a Vercel serverless directory. Both endpoints follow the same pattern:
a thin host handler (`api/<name>.ts`, `export const config = { runtime: "edge" }`)
delegating to a **host-free core** (`api/_<name>.ts`) that takes `(payload, env,
clientKey)` and returns `{ status, body }`. The same core module is mounted by
the Vite dev server (`vite.config.ts`), so local dev exercises the real
validation and grounding, not a stub.

### `POST|GET /api/recommend`

| | |
|---|---|
| **Purpose** | Optional LLM enhancement — symptom-hint extraction and prose rephrasing. |
| **GET** | Returns `{ llm, model? }` capabilities. No input, no secrets, no user data. |
| **POST** | Body `{ op: "parse-intent" \| "phrase", ... }`. Max body 16 KB. |
| **Output** | Always HTTP 200. `{ available: true, intent \| phrased }` or `{ available: false }`. `400` only for a malformed body / unknown `op`; `405` for non-GET/POST; `413` for oversize body. |
| **Validation** | `op` whitelist; all string inputs length-clamped; `parse-intent` requires a non-empty `allowedSymptoms`; provider output re-validated by `api/_llm/validate.ts`. |
| **Errors** | Provider/transport/timeout/refusal/grounding failures → logged for the operator, `{ available: false }` on the wire. |
| **Env** | `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS` — server-only. |
| **Rate limit** | 20 requests / 60 s per client key (first `x-forwarded-for` entry). A limited caller just gets `{ available: false }`. |

### `POST /api/contact`

| | |
|---|---|
| **Purpose** | Deliver a contact-form message by email via Resend. |
| **Method** | POST only (`405` otherwise). |
| **Input** | `{ name, email, message, company? }` JSON. `company` is a honeypot — if non-empty, returns `200` and sends nothing. |
| **Validation** | Re-validates server-side: `name` ≥ 2, `email` pattern, `message` ≥ 10 → `400`. Codepoint-filtered (not regex) to strip control chars; header fields collapse `\r\n`. |
| **Output** | `{ ok: true }` on send; `{ ok: false, error }` otherwise. |
| **Errors** | Missing env → `500` "Unable to send right now." (never names the missing var). Rate limit 3 / 60 s per email address → `429`. |
| **Env** | `RESEND_API_KEY`, `CONTACT_EMAIL`, `EMAIL_FROM` — server-only. |
| **Security** | The visitor's address goes in `reply_to`, never `from` (SPF/DKIM). Key never on the wire. |

### Vercel-specific note

`api/**/*.ts` relative imports must be **extensionless** (`./_recommend`, not
`./_recommend.ts`). See §19 — this bit us on the first deploy.

---

## 15. Environment variables

**All variables are server-side only.** None are `VITE_`-prefixed; none reach the
browser bundle. The app is fully functional with **none** of them set.

| Variable | Purpose | Required? | Client-safe? | Where used | If missing |
|---|---|---|---|---|---|
| `LLM_PROVIDER` | Selects the LLM provider: `anthropic` \| `nvidia`. Blank = no LLM layer. | No | **No** | `api/_llm/providers/index.ts` | App runs fully deterministically; `/api/recommend` GET returns `{ llm: false }`. |
| `LLM_API_KEY` | Provider API key (Anthropic `x-api-key` / NVIDIA `Bearer`). | Only if `LLM_PROVIDER` set | **No — secret** | `api/_llm/providers/*.ts` | `getProvider` throws internally → caught → `null` → deterministic only. |
| `LLM_MODEL` | Model override. Defaults: `claude-haiku-4-5` (anthropic) / `nvidia/nemotron-3.5-lightning-30b-a3b` (nvidia). Production: `meta/llama-3.2-11b-vision-instruct`. | No | **No** | `api/_llm/providers/*.ts` | Provider default model is used. |
| `LLM_TIMEOUT_MS` | Per-call timeout, ms. Default `8000`, clamped `1000`–`20000`. | No | **No** | `api/_llm/providers/*.ts` | `8000` is used. |
| `RESEND_API_KEY` | Resend API key for the contact form. | Only for a working contact form | **No — secret** | `api/_contact.ts` | Form returns "Unable to send right now."; visitor pointed at `mailto:`. |
| `CONTACT_EMAIL` | Destination address for contact messages. | Only for a working contact form | **No** | `api/_contact.ts` | Same as above (`500` from the endpoint). |
| `EMAIL_FROM` | Verified Resend sender, e.g. `Sattva <onboarding@resend.dev>`. Cannot be the visitor's address. | Only for a working contact form | **No** | `api/_contact.ts` | Same as above. |

### `.env` vs `.env.example` vs Vercel

- **`.env`** — local dev secrets. **Git-ignored** (`.gitignore` lists `.env`,
  `.env.local`, `.env.*.local`, …). Loaded by the Vite dev server with the empty
  prefix so `LLM_*` / `RESEND_*` stay unprefixed and unreachable from the client.
- **`.env.example`** — the **only** tracked env file. Placeholder / blank values +
  documentation. Copy it to `.env` and fill in. **Never put a real secret here.**
- **Vercel → Project → Settings → Environment Variables** — production values.
  Set all seven for the deployed feature set; set none and the app still works
  deterministically. The 7 are currently configured on the production project.

> **Never expose a server-side API key to the browser.** Do not add a `VITE_`
> prefix to any key. Do not `import.meta.env` a secret. The client talks only to
> `/api/*` and only ever sees the JSON those endpoints return.

---

## 16. Local development

```bash
git clone <repo-url>
cd ayurvedic-remedy-suggestor
npm install
npm run dev            # http://localhost:5173
```

`npm run dev` runs `predev` first, which compiles + validates the knowledge base
into `src/generated/knowledge.json`. If that file is missing (fresh clone,
`src/generated/` is git-ignored), the dev server will not start until
`kb:build` has run — `predev` handles it automatically.

### Node version

Not pinned. There is no `engines` field in `package.json` and no `.nvmrc`.
Development has been on Node 22. Vite 8 + Vitest 3 require Node ≥ 20.19 / 22.12.
Use an active LTS.

### Environment setup (optional)

```bash
cp .env.example .env
# fill in LLM_PROVIDER + LLM_API_KEY to enable the enhancement layer
# fill in RESEND_API_KEY + CONTACT_EMAIL + EMAIL_FROM to enable the contact form
```

Restart the dev server after editing `.env`.

### API behaviour in dev

`vite.config.ts` mounts `/api/recommend` and `/api/contact` via
`configureServer`, loading **the same core handler modules** the deployed edge
functions use (`server.ssrLoadModule("/api/_recommend.ts")`). So local dev runs
the real rate limiting, sanitisation, prompt assembly, and grounding checks. With
no `.env`, both endpoints report the feature as unavailable, exactly like
production with no env vars.

### Knowledge-base build behaviour

`build-knowledge.mjs` runs on `predev`, `prebuild`, and `pretest`. To rebuild
manually after editing `content/`: `npm run kb:build`. The dev server does **not**
watch `content/` — re-run `kb:build` and restart (or just re-run `npm run dev`).

---

## 17. Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | `predev` (build KB) → Vite dev server on `:5173` with the `/api/*` dev middleware. |
| `npm run build` | `prebuild` (build KB) → `tsc -b` (typecheck all three tsconfig projects) → `vite build` → `dist/`. |
| `npm run preview` | Serve the built `dist/` locally (production-equivalent static serve; **no** `/api/*` — those need Vercel or `vercel dev`). |
| `npm run lint` | `oxlint` over the repo (`react`, `typescript`, `oxc` plugins; `dist` / `src/generated` / `node_modules` ignored). |
| `npm test` | `pretest` (build KB) → `vitest run` — all engine, lib, API, and component tests once. |
| `npm run test:watch` | `vitest` in watch mode (does **not** re-run `pretest`). |
| `npm run kb:build` | Compile + validate `content/*.json` → `src/generated/knowledge.json`. Exit 1 on any validation error. |
| `npm run kb:ingest` | Regenerate `content/PROVENANCE.md` and seed skeletons from `data/drug-prescription.csv` (`scripts/ingest-csv.mjs`). Migration tooling — rarely needed. |

---

## 18. Testing

**Vitest 3.** Config in `vitest.config.ts`. `include`:
`src/**/*.test.{ts,tsx}` + `api/**/*.test.ts`. Default environment `node`;
component/DOM tests opt in with a `// @vitest-environment jsdom` docblock.
`testTimeout: 15000` (the App-flow tests drive a full Framer + lazy/Suspense
tree). Shared setup: `src/test/setup.ts` (`@testing-library/jest-dom`,
`matchMedia` mock that reports **reduced motion**, `scrollTo` / `scrollIntoView`
/ `IntersectionObserver` stubs, `asyncUtilTimeout: 5000`).

### Test organisation

| Area | Files | What they cover |
|---|---|---|
| Engine | `src/engine/*.test.ts` (`normalize`, `retrieve`, `safety`, `confidence`, `assemble`, `validate`) | Pure-function behaviour against the **fixture** KB (`src/engine/__fixtures__/kb.ts`). |
| Compiled KB | `src/engine/compiled-kb.test.ts` | Runs the engine against the **real** `src/generated/knowledge.json` — catches content regressions (dangling refs, a condition that can never match, etc.). |
| Grounding | `src/lib/grounding.test.ts` | `buildPhrasePayload` / `applyPhrasing` only touch the allowed narrative fields. |
| API core | `api/_recommend.test.ts`, `api/_contact.test.ts`, `api/_llm/validate.test.ts`, `api/_llm/providers/{anthropic,nvidia,index}.test.ts` | Validation, rate limiting, grounding enforcement, provider wire format (fetch stubbed), fallback on every failure mode, no-key-in-body. |
| Product flow | `src/App.test.tsx`, `src/App.llm.test.tsx` | Full `compose → processing → result` for each `kind`; LLM enhancement path with `/api/recommend` stubbed. |
| Contact UI | `src/components/Contact/ContactForm.test.tsx` | Empty submit, invalid email, successful send, failed send retry. |

### What to test when you change…

- **Engine logic** → add/adjust the matching `src/engine/*.test.ts` case, and
  check `compiled-kb.test.ts` still passes.
- **Knowledge content** → `npm run kb:build` (validation), then `npm test`
  (`compiled-kb.test.ts` runs the engine over the real KB).
- **A threshold in `safety.json`** → re-run engine tests; several assertions are
  calibrated to `0.22` / `0.5` / `2`.
- **UI** → the App-flow tests should still reach the right screen; add a case if
  you added an outcome branch.
- **API / LLM** → add a provider or validator case; keep the "every failure →
  fallback" and "key never on the wire" invariants covered.

Standard pre-push validation: `npm run kb:build && npm test && npm run lint &&
npm run build`.

---

## 19. Deployment

```text
Developer
   │  git commit
   ▼
GitHub  main
   │  push
   ▼
Vercel  (project: mukul-negis-projects/ayurvedic-remedy-suggestor)
   │  auto-detected: Vite SPA + api/ directory
   │  build: prebuild (kb:build) → tsc -b → vite build → dist/
   │  api/*.ts → edge functions
   ▼
Production  https://ayurvedic-remedy-suggestor.vercel.app
```

- **Trigger:** every push to `main` auto-deploys. There is no `vercel.json` /
  `vercel.ts` — Vercel's zero-config detection handles the Vite build and the
  `api/` directory.
- **Build command:** `npm run build` (Vercel default for a detected Vite app);
  `prebuild` compiles the knowledge base inside the Vercel build container.
- **Future deploys:** commit → push `main`. That's it. Roll back from the Vercel
  dashboard (Deployments → ⋯ → Promote to Production).

### Production environment variables

Set in **Vercel → Settings → Environment Variables** (all seven currently
configured): `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS`,
`RESEND_API_KEY`, `CONTACT_EMAIL`, `EMAIL_FROM`. The site deploys and runs
without any of them — they only light up the optional LLM layer and the contact
form. Changing an env var requires a redeploy to take effect.

### Vercel-specific gotcha discovered during deployment

**The Vercel function compiler rejects `.ts` import extensions.** The first
deploy errored:

```
error TS5097: An import path can only end with a '.ts' extension when
              'allowImportingTsExtensions' is enabled.
error TS2591: Cannot find name 'process'.
The Edge Function "api/contact" is referencing unsupported modules: ./_contact.ts
```

The local `tsconfig.app.json` sets `allowImportingTsExtensions: true`, so
`.ts`-suffixed imports typecheck locally — but Vercel's function build does not
honour that. The fix (commit `a7ef008`):

1. **All `api/**/*.ts` relative imports are extensionless** — `./_recommend`, not
   `./_recommend.ts`. (The Vite dev-server mount in `vite.config.ts` uses the
   full `/api/_recommend.ts` path — that's a Vite virtual path, unaffected.)
2. **`tsconfig.node.json`** (which covers `api/` + `vite.config.ts`):
   `module: "nodenext"` → `"esnext"`, added `moduleResolution: "bundler"`,
   removed `allowImportingTsExtensions`, added `resolveJsonModule: true`.

If you add a file under `api/`, import it **without** the `.ts` extension.

---

## 20. Design system

Full detail is not the point here — the tokens are the API.

- **Colour** — defined once in `src/index.css` as CSS custom properties on
  `:root` / `:root[data-theme="dark"]`, fed to Tailwind via `@theme inline`.
  **Change the palette there, never in components.** Identity: paper-sand ground
  (`--bg`), eucalyptus/sage accent (`--accent`), clay secondary (`--clay`), warm
  semantic caution/danger. Deliberately **not** the portfolio's indigo/terminal
  palette — only the token _structure_ is shared.
- **Typography** — Fraunces (`--font-display`, headings) + Inter (`--font-sans`,
  body), loaded from Google Fonts with `display=swap`. A no-flash inline script
  in `index.html` sets `data-theme` and the ground colour before first paint.
- **Themes** — light / dark, resolved: stored `localStorage.theme` →
  `prefers-color-scheme` → light. The toggle animates a leaf-shaped reveal using
  the **View Transitions API** + WAAPI, drag-scrubbable
  (`useThemeToggleController`, `src/utils/themeReveal.ts`, `src/utils/leaf.ts`).
- **Motion** — Framer Motion via `LazyMotion` + `m` + `domAnimation` (see §21).
  Shared duration / easing / spring tokens in `src/utils/motion.ts`. Reusable
  interaction primitives (`Magnetic`, `LiquidIndicator`, `Reveal`) and the
  liquid-nav / mobile-menu spring physics are **ported from the author's
  portfolio**; the recommendation UI, the leaf theme reveal, and the opening
  overlay are Sattva's own.
- **Responsive** — mobile-first, `min-h-[100svh]`, `container-px` utility,
  content max-widths. The page body must never scroll horizontally.
- **Accessibility** — keyboard skip link; `inert` on the whole app while the
  opening reveal plays; `aria-live` on `Processing` and result announcements;
  `prefers-reduced-motion` honoured everywhere (checked via `useReducedMotion`
  and a global CSS block) — under reduced motion the `processing` stage is
  skipped entirely and animations reduce to opacity fades.

---

## 21. Performance

Phase E (performance pass) is **partly done**. What's in the code now:

- **`LazyMotion` + `m` + `domAnimation`** (`App.tsx` wraps the tree in
  `<LazyMotion features={domAnimation} strict>`; every `motion.*` is `m.*`). Ships
  the ~17 kB `domAnimation` feature bundle instead of the full ~34 kB `motion`
  factory. `strict` makes a missed `motion.` throw in dev.
- **Code-split Result view** — `const Result = lazy(() => import("@/views/Result"))`,
  prefetched on `submit` and again when `stage === "processing"`, so the Suspense
  fallback should never actually render. Pulls the ~12 result components +
  `lib/sources` out of the entry chunk.
- **`vendor-react` manual chunk** (`vite.config.ts`) — `react` / `react-dom` /
  `scheduler` in their own long-cache chunk so an app-code deploy doesn't bust
  it. framer-motion is **deliberately not** force-chunked — that would defeat the
  `LazyMotion` tree-shaking.
- **`scrollbar-gutter: stable`** on `html` (`src/index.css`) — fixed a CLS
  regression where the faster paint let the page render before full height, so
  the desktop scrollbar appearing reflowed the layout ~15 px.

### Measurements

Taken **during Phase E with Playwright + Chrome DevTools Protocol** under
synthetic throttling (4× CPU, ~1.6 Mbps / 150 ms, 390 px viewport,
`vite preview`), before → after:

| Metric | Before | After |
|---|---|---|
| FCP | ~3040 ms | ~2096 ms |
| LCP | ~4504 ms | ~3028 ms |
| TBT | ~2900 ms | ~876 ms |
| Entry JS (gzip) | ~147 kB (one chunk) | entry ~74 kB + `vendor-react` ~60 kB; `Result` ~6 kB split out and prefetched |

**No formal Lighthouse report and no production-network measurement have been
run.** These are throttled synthetic numbers from a local `preview`, not Core Web
Vitals from the field. Treat them as directional.

### Known / deferred

- **`knowledge.json` (~95 kB) is still in the entry chunk** (Phase E §3 —
  deliberately deferred; splitting it touches `useAssessment`'s signature).
- **Font `<link rel="preload">`** for the two first-screen faces (Phase E §5) is
  **not** implemented — fonts still load via one render-non-blocking stylesheet.
- `HeroBackground`'s `blur-3xl` + `breathe` keyframe is compositor-only
  (transform/opacity) and was left as-is.

---

## 22. Common development tasks

### I want to add a symptom
`content/symptoms.json` → add to `symptoms[]`; link it from a condition in
`content/conditions.json`; `npm run kb:build`. Add a `normalize.test.ts` case for
tricky phrasing. (§9)

### I want to add a remedy
`content/remedies.json` → add an `unverified` record; link from a condition's
`remedies[]` in `conditions.json`; `npm run kb:build && npm test`. (§9)

### I want to add a condition
`content/conditions.json` (all required fields — `severityGuidance` ×3,
`whenToSeeProfessional`, …); `src/data/site.ts` → `conditionsInScope`;
`src/engine/templates.ts` "in scope" copy; `npm run kb:build && npm test`. (§9)

### I want to modify recommendation scoring
`src/engine/retrieve.ts` (condition/remedy scoring) or `confidence.ts`
(confidence). Update `src/engine/retrieve.test.ts` / `confidence.test.ts` and
check `compiled-kb.test.ts`. Never edit scoring in a component.

### I want to modify safety rules
`src/engine/safety.ts` for logic; `content/red-flags.json` / `safety.json` /
remedy `avoidIf` for data. Update `src/engine/safety.test.ts`. Re-run engine
tests if you touched a threshold.

### I want to change the UI
`src/views/` for a whole stage; `src/components/result/*` for the result screens;
`src/components/SymptomInput/*` for the input. Copy lives in `src/data/site.ts`.

### I want to change theme / colours
`src/index.css` — the `:root` / `:root[data-theme="dark"]` custom properties.
Nothing else.

### I want to change the LLM provider
Set `LLM_PROVIDER` (+ `LLM_API_KEY`, optional `LLM_MODEL`) in `.env` locally /
Vercel env in prod. To add a _new_ provider: `api/_llm/providers/<name>.ts`
exporting `create<Name>Provider(env)`, + one `case` in
`api/_llm/providers/index.ts`, + a `<name>.test.ts`. (§13)

### I want to deploy
`npm run kb:build && npm test && npm run lint && npm run build`, then
`git commit` + `git push` to `main`. Vercel auto-deploys. (§19)

---

## 23. Architectural rules / guardrails

1. **Recommendation logic stays in `src/engine/`.** No scoring, threshold, or
   safety decision inside a React component. Components render a finished
   `Recommendation`.
2. **The engine stays pure.** No `import` of React, `fetch`, `window`, or
   `import.meta.env` under `src/engine/`. It must remain testable in plain Node.
3. **Never edit `src/generated/knowledge.json`.** It is git-ignored build output.
   Edit `content/*.json` and run `npm run kb:build`.
4. **The legacy CSV is not a runtime input.** `data/drug-prescription.csv` is
   frozen provenance. Nothing in `src/` or `api/` reads it.
5. **Safety is never bypassed.** Red-flag detection runs before retrieval; the
   safety filter runs after ranking. Don't add a path that returns a remedy
   without going through `assemble.recommend`.
6. **The LLM never has authority.** It cannot pick a remedy, name a condition,
   set a confidence, or write safety prose. Its output is always re-validated and
   either fed back through the deterministic engine or dropped.
7. **API keys are server-only.** No `VITE_` prefix on a secret. The client talks
   only to `/api/*`.
8. **Every clinical value carries provenance + verification.** A new field on a
   remedy/condition without a `provenance` will fail `kb:build` where the
   validator checks it.
9. **Copy lives in `src/data/site.ts`**, not in JSX.
10. **Add tests when you change engine behaviour.** The engine is the product;
    its tests are the spec.
11. **Preserve reduced-motion behaviour.** Guard new animation with
    `useReducedMotion()` / the CSS block; the reduced path must still complete
    every flow.
12. **Don't add dependencies casually.** No DB, no vector store, no validation
    library, no state library — the dataset is small and the hand-rolled tools
    are deliberate. New runtime deps need a real justification.
13. **`api/` relative imports are extensionless.** (§19)

---

## 24. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm run dev` fails: cannot find `@/generated/knowledge.json` | KB not built. Run `npm run kb:build` (or just re-run `npm run dev` — `predev` builds it). |
| `kb:build` exits 1 with `references unknown symptom/remedy/source` | A cross-reference in `content/` is dangling — fix the id or add the missing record. (§10) |
| `kb:build` exits 1 with `"sourced" field has no sources` | A `provenance: "sourced"` value with an empty `sources[]`. Add the citation or downgrade the provenance. |
| `npm run build` fails in `tsc -b` on an `api/` file | Likely a `.ts` import extension — make it extensionless. Check `tsconfig.node.json` still has `moduleResolution: "bundler"`. |
| Vercel deploy: `TS5097` / `TS2591` / `unsupported modules: ./x.ts` | The `.ts`-import-extension issue. §19. |
| Contact form always says "Unable to send right now." | `RESEND_API_KEY` / `CONTACT_EMAIL` / `EMAIL_FROM` not set (in `.env` locally, Vercel env in prod). |
| LLM enhancement never appears | Expected if `LLM_PROVIDER` unset. If set: check `GET /api/recommend` returns `{ llm: true }`; check the function logs (provider errors are logged, not surfaced); NVIDIA free tier times out ~20–40% of calls — that's a fallback, not a failure. |
| App-flow tests time out | Usually flake under parallel-worker load. `vitest.config.ts` `testTimeout` is 15000 and `setup.ts` `asyncUtilTimeout` is 5000; re-run. If consistent, a real regression in the `compose → processing → result` transition. |
| `npm run preview` — `/api/*` returns the index HTML | `preview` is a static server with no functions. Use the dev server (`npm run dev`) or `vercel dev`. |
| Theme flashes on load | The inline script in `index.html <head>` must run before the CSS. Don't move it or make it `async`/`defer`. |

---

## 25. Future roadmap

Nothing below is committed — these are identified, not scheduled.

- **Phase D — AI enhancement.** _Implemented and live._ Provider abstraction,
  Anthropic + NVIDIA providers, `parse-intent` + `phrase`, grounding
  enforcement, deterministic fallback. Remaining: tune model choice / timeout as
  the NVIDIA free-tier latency allows; the Anthropic provider is ready if a
  budget exists.
- **Phase E — performance & polish.** _Partly done_ (see §21). Outstanding:
  font-face `<link rel="preload">`; `knowledge.json` async chunk split;
  re-measure and decide whether further splitting is worth the churn.
- **Content.** Qualified Ayurvedic-practitioner review of the editorial
  symptom/condition text; per-remedy sourcing for the 50 `unverified` records
  (`content/REVIEW-QUEUE.md`); more conditions once the sourcing model is proven
  on the first four.

---

## 26. Contributing / developer checklist

Before pushing:

```text
□ npm run kb:build      # content compiles + validates (also runs in prebuild/pretest)
□ npm test              # engine, lib, api, and flow tests green
□ npm run lint          # oxlint clean
□ npm run build         # tsc -b + vite build succeed
□ Checked mobile layout (no horizontal scroll, ~390px)
□ Checked light AND dark theme
□ Checked keyboard nav + reduced-motion path (both complete every flow)
□ No new console errors/warnings
□ If engine/safety/scoring changed: added/updated the matching *.test.ts
□ If content changed: compiled-kb.test.ts still passes
□ No secret in a tracked file; no VITE_ prefix on a key
□ api/ imports are extensionless
```

Commit → push `main` → Vercel auto-deploys → verify at the production URL.
