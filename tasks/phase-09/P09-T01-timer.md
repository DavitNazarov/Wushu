# P09.T01 — Timer stored in DB

## Goal
Store timestamps: start_time, pause_started_at, paused_total_ms; compute remaining time.

## Steps
1. Add/confirm DB fields on fights
2. Create `domain/timer.ts` computeRemainingTime()
3. Create `services/fightTimerService.ts` start/pause/resume
4. Ensure refresh-safe behaviour

## Acceptance
- [ ] Refresh keeps correct time
- [ ] Viewers see consistent countdown
- [ ] DB is source of truth

