# P06.T02 — Deadline processor

## Goal
Process expired ONE_HOUR records: move up or DQ.

## Steps
1. Create pure rules: `domain/weighInRules.ts`
2. Create service: `services/weighInProcessor.ts` to apply expired outcomes
3. Add button 'Run checks' on admin weigh-in page
4. Run checks automatically when page opens (MVP)

## Acceptance
- [ ] Expired cases processed
- [ ] Move-up only if next exists
- [ ] DQ otherwise
- [ ] All actions audited

