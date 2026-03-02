# P01.T02 — Roles + capabilities

## Goal
Implement capability-based permissions.

## Steps
1. Define roles: admin, coach, athlete
2. Create `src/lib/permissions.ts` mapping capabilities
3. Create `requireCapability()` helper and use in routing/components

## Acceptance
- [ ] Admin-only pages blocked for coach
- [ ] Coach-only pages blocked for athlete
- [ ] Capability map is single source of truth

