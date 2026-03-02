# Project Rules (Cursor + AI) — Non‑Negotiable

## Core principles
- Truth > comfort. Call out wrong ideas and risks.
- Business-first: every feature must reduce chaos / reduce mistakes / save time / enable revenue.
- Ship bias: smallest working tournament system first.
- Assumptions stated: rulesets are templates; organisers can override.
- Manual override exists for every automation.

## Engineering rules
- Max 250–300 lines per file. Split by component/hook/service/domain.
- UI is dumb. Business logic lives in `/domain` + `/services`.
- Single source of truth in DB for fight status, timer state, bracket + scheduling state.
- Strong typing everywhere.
- Audit log for critical actions: weigh-in, draw, schedule overrides, fight results.
- Realtime must survive refresh, reconnection, and multiple devices.

## Product rules
- Event lifecycle:
  Registration open → Weigh-in → Registration locked → Draw executed → Brackets published → Competition live → Completed
- Bracket ≠ schedule:
  - bracket: who meets who
  - schedule: when they fight (rest constraints)
- i18n required: English + Georgian from day one. No hardcoded visible strings.
- Dark mode default with design tokens.

## MVP stop signs
Do NOT build in MVP:
- payments
- rankings/advanced analytics
- double elimination
- media uploads
- “perfect Smoothcomp clone”
