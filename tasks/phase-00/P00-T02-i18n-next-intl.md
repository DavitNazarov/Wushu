# P00.T02 — Setup i18n (EN/KA) with next-intl

## Goal
Add localisation with next-intl. No hardcoded visible strings.

## Steps
1. Install: `npm i next-intl`
2. Create folders: `src/i18n` and `src/messages`
3. Create `src/messages/en.json` and `src/messages/ka.json` with at least app.title + nav.home keys
4. Create `src/i18n/request.ts` that loads messages by locale and falls back to `en` safely
5. Add `src/middleware.ts` for locale routing using next-intl recommended approach
6. Create `src/app/[locale]/layout.tsx` with NextIntlClientProvider
7. Create/update `src/app/[locale]/page.tsx` to render `t('app.title')` and `t('nav.home')`

## Acceptance
- [ ] Routes `/en` and `/ka` render
- [ ] Invalid locale falls back to `/en`
- [ ] No visible hardcoded strings in UI

