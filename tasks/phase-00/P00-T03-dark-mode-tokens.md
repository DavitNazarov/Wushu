# P00.T03 — Dark mode default + tokens

## Goal
Define design tokens and apply a professional dark UI baseline.

## Steps
1. Create folders: `src/theme` and `src/components/layout`
2. Create `src/theme/tokens.ts` (bg/surface/text/muted/primary/border as constants)
3. Create `src/components/layout/AppShell.tsx` (header + content container) using Tailwind + tokens
4. Apply dark defaults in `src/app/[locale]/layout.tsx` (body classes)
5. Use tokens consistently (no random colors)

## Acceptance
- [ ] App opens in dark theme by default
- [ ] Layout looks consistent and readable
- [ ] Tokens used across layout

