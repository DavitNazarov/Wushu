# P07.T01 — Run draw + generate bracket

## Goal
Random seed registrations into single-elim bracket with byes and pointers.

## Steps
1. Create pure generator `domain/bracket/singleElim.ts`
2. Admin action 'Run draw' per category
3. Store matches with next pointers for winner propagation
4. Audit log

## Acceptance
- [ ] Works for 2..N athletes
- [ ] Byes correct
- [ ] Pointers exist
- [ ] Audited

