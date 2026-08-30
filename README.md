# Sattva — Ayurvedic Remedy Guidance

Describe how you're feeling and receive calm, **structured** Ayurvedic remedy
guidance drawn from a **curated knowledge base** — with clear precautions and
advice on when to seek professional care.

> **Not medical advice.** Sattva offers general information from traditional
> Ayurvedic sources. It is not a diagnosis or treatment plan. Always consult a
> qualified healthcare professional before starting any remedy.

## Architecture

```
user input
  → normalization            (src/engine/normalize.ts)
  → deterministic retrieval   (src/engine/retrieve.ts)   ← content/ knowledge base = source of truth
  → deterministic safety filter (src/engine/safety.ts)
  → structured recommendation (src/engine/assemble.ts)
  → optional LLM phrasing      (api/, added in Phase D — never the source of facts)
```

The recommendation engine (`src/engine/`) is a **pure TypeScript module with no
React dependency**, unit-tested with Vitest. The LLM layer is optional and
isolated: if it is unavailable, deterministic templated prose is always used.

No database, no vector store, no embeddings — the curated dataset is small and
does not need them.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind v4 (CSS-first tokens) · Framer Motion ·
Vitest · oxlint. Design system and interaction patterns adapted from the
author's portfolio; visual identity is its own (warm sage / clay / sand).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (rebuilds the knowledge base first) |
| `npm run build` | Typecheck + production build |
| `npm test` | Run the engine unit tests |
| `npm run kb:build` | Compile + validate `content/` → `src/generated/knowledge.json` |
| `npm run kb:ingest` | Regenerate seed skeletons from `data/drug-prescription.csv` |
| `npm run lint` | oxlint |

## Knowledge base

Curated content lives in `content/` (conditions, remedies, safety config) and
compiles to `src/generated/knowledge.json`. **Adding conditions or remedies
means editing content, not code.** Every record traces back to the original
CSV entry it was derived from (`data/drug-prescription.csv`, kept as
provenance).

Fields that require authoritative sourcing/review (dosages, contraindications,
red-flag lists) are explicitly flagged in each record until reviewed — see
`content/README.md`.
