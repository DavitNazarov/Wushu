# P08.T00 — Scheduler core

## Goal
Order ready fights with rest constraints; return conflicts if impossible.

## Steps
1. Create `domain/schedule/scheduler.ts` pure function
2. Inputs: ready matches, minRestFights, platforms (optional)
3. Outputs: ordered fights + conflicts list
4. Add unit tests

## Acceptance
- [ ] Avoids rest violations when possible
- [ ] Returns conflicts when not
- [ ] Tests pass

