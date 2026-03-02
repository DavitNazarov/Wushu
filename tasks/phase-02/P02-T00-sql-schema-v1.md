# P02.T00 — SQL schema v1

## Goal
Add core tables with FKs and indexes.

## Steps
1. Create `supabase/schema/001_init.sql` (tracked in repo)
2. Define tables: users_profile, athletes, events, age_groups, weight_templates, event_categories, registrations, weigh_ins, brackets, matches, fights, platforms, audit_log
3. Apply SQL in Supabase

## Acceptance
- [ ] Tables exist
- [ ] FKs and indexes exist
- [ ] Schema file tracked in repo

## Notes
Keep schema evolvable. Avoid over-constraining rules that block organiser overrides.

