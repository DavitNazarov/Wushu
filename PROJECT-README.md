# Geo Wushu Competition System — Task Packs for Cursor

Generated: 2026-03-02

## How to use

- Copy the entire `tasks/` folder into your repo (e.g. `tests/tasks/` or `ops/tasks/`).
- In Cursor, open the task file you want and tell Cursor: **"Execute Task Pxx.Tyy exactly as written."**
- Each task file contains a checklist. Cursor should tick items by editing the same file.

## Conventions

- Phase folders: `phase-00` ... `phase-12`
- Task file naming: `Pxx-Tyy-slug.md`
- Each task has: Goal → Steps → Acceptance checklist.

## Important

Manual (human) actions are NOT included in tasks. If something must be done by you (e.g., create Supabase project),
you'll see it under **Prerequisites (human)** at the top of that phase's `README.md`.
