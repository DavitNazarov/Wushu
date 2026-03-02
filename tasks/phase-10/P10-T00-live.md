# P10.T00 — Public live page

## Goal
Show current fight big, next 5, finished list; realtime updates.

## Steps
1. Route `/[locale]/live/[eventId]`
2. Subscribe realtime to fights
3. Render current (big), next 5, finished
4. Add fallback polling if realtime disconnected

## Acceptance
- [ ] Spectators see correct current fight
- [ ] Updates fast
- [ ] Works after refresh

