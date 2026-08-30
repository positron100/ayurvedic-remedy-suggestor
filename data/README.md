# `data/` — frozen legacy input

`drug-prescription.csv` is the **original application's** dataset
(`condition, age, gender, severity, drug` — no header row). It is kept only for
provenance.

- It is **not** read at runtime.
- The recommendation engine does **not** depend on it.
- The curated knowledge base in `content/` is the single source of truth.

The condition↔remedy relationships were extracted from it during migration;
`content/PROVENANCE.md` (run `npm run kb:ingest`) records exactly how every row
maps onto a canonical remedy. The `age` and `gender` columns were dropped —
inspection showed the remedy never varied with gender, and the age grid was
arbitrary rather than clinically meaningful.

This file can be deleted once the provenance record is considered sufficient.
