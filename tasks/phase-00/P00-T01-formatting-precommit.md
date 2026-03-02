# P00.T01 — Add formatting + pre-commit

## Goal
Add Prettier, lint-staged, and Husky so formatting is automatic.

## Steps
1. Install: `npm i -D prettier eslint-config-prettier prettier-plugin-tailwindcss lint-staged husky`
2. Create `.prettierrc` and `.prettierignore`
3. Add scripts to `package.json`: `format`, keep `lint`
4. Add `lint-staged` section to `package.json` for `*.{ts,tsx,js,jsx,json,md}`
5. Enable Husky: `npx husky init`
6. Edit `.husky/pre-commit` to run: `npx lint-staged`
7. Run: `npm run format`

## Acceptance
- [ ] `npm run format` works
- [ ] Pre-commit runs lint-staged
- [ ] No formatting noise in commits

## Notes
Recommended `.prettierrc`: semi=true, singleQuote=true, printWidth=100, trailingComma=all, plugin=prettier-plugin-tailwindcss.

