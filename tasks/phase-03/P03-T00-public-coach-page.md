# P03.T00 — Public coach profile page

## Goal
Public coach page shows athletes and computed experience.

## Steps
1. Create route `/[locale]/coaches/[coachId]`
2. Add `coachService.getCoachPublic()` and `athleteService.listByCoach()`
3. Compute experienceYears = currentYear - coach_start_year in UI or service
4. Render athlete list

## Acceptance
- [ ] Coach page works EN/KA
- [ ] Experience auto updates by year
- [ ] Athlete list visible

