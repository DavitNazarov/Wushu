# P09.T02 — Judge panel UI

## Goal
Big-button operator UI controlling fight flow and realtime updates.

## Steps
1. Route `/[locale]/judge` (protected)
2. Select event + platform (if exists)
3. Show current and next fight
4. Buttons call services to update fight state/timer
5. Realtime subscriptions refresh UI

## Acceptance
- [ ] Judge can run fight
- [ ] Realtime works
- [ ] Usable on tablet

