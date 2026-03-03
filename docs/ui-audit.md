# UI Audit — Geo Wushu Competition System

**Date:** 2026-03-03

## 1. Current Routes & Pages

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Redirect (via middleware) | — |
| `/[locale]` (e.g. `/en`) | Dashboard (home) | Protected (admin) |
| `/[locale]/login` | Login form | Public |
| `/[locale]/admin/rulesets` | Rulesets list (static shell) | Protected |
| `/[locale]/admin/events` | **404** — page missing | — |
| `/[locale]/admin/users` | **404** — page missing | — |
| `/[locale]/admin/settings` | **404** — page missing | — |

**Note:** Dashboard lives at `/[locale]` (root), not `/[locale]/admin`. Sidebar "Dashboard" links to `/admin` which may 404 or redirect. Events, Users, Settings pages do not exist.

## 2. Component Structure

- **Layout:** `app/layout.tsx` (root html/body) → `app/[locale]/layout.tsx` (NextIntlClientProvider only)
- **AppShell:** `src/components/layout/AppShell.tsx` — single file (~130 lines) containing:
  - Sidebar (branding + nav links, no icons)
  - Topbar (title, tagline, event placeholder, status pill, language EN|KA)
  - Main content wrapper (one card with title + children)
- **No shared UI primitives:** Card, Button, Badge, Table, EmptyState are inline or ad-hoc
- **No theme provider:** Tokens are Tailwind class strings; no light/dark switching

## 3. Theming & i18n Status

**Theming:**
- `src/theme/tokens.ts` — hardcoded dark Tailwind classes (`bg-[#0B1220]`, etc.)
- `globals.css` — `:root` vars for light, `prefers-color-scheme: dark` override; body uses Arial
- No CSS variables for radii, shadows, spacing; no light theme implementation
- Design spec tokens (Geo Navy, surfaces, borders) partially used but not as single source of truth

**i18n:**
- `next-intl` with `en` + `ka` locales; messages in `src/messages/{en,ka}.json`
- Locale from URL path (`/en/...`, `/ka/...`); no `locale` persistence in localStorage
- Language switch uses `next/link` with manual `href`; `locale` prop on `Link` is ignored (next/link has no locale)
- Most UI strings use `useTranslations`; login page and dashboard are fully translated

## 4. Gaps vs Phase-1 MVP

- **Missing pages:** Events list, Users, Settings (admin shells)
- **Missing UI:** Sidebar icons, dark mode toggle, proper empty states, KPI cards
- **Language switch broken:** `Link` from `next/link` + `locale` prop does nothing; must use path-based navigation or `next-intl/link`
- **Theme toggle missing:** No sun/moon control; dark-only
- **Dashboard:** No KPIs, no recent events table; only 2 quick-access cards
- **Inconsistent routing:** Dashboard at `/` vs sidebar link to `/admin`; `/admin` may not resolve

## 5. UI/UX Problems

| Area | Issue |
|------|-------|
| **Spacing** | Inconsistent; topbar cramped; card padding varies; no 8px grid |
| **Hierarchy** | Page title too small (11px uppercase); section titles similar to body; weak contrast |
| **Typography** | No Inter; body 14px not enforced; helper text 13px ad-hoc |
| **Alignment** | Content stretches in places; max-width 1100px applied but inner card feels wide |
| **Empty states** | Rulesets table has one sample row; no EmptyState component; no primary CTA for empty lists |
| **Sidebar** | No icons; active state subtle; no collapsed mode |
| **Topbar** | Event selector + status + language in one row; no theme toggle; repetitive title/tagline |

## 6. Code Smells

- **Duplication:** Card-like styles repeated in Dashboard quick links, Rulesets table, AppShell main card
- **Hardcoded colours:** `#020617`, `#1f2937`, `#334155`, etc. scattered; tokens.ts underused
- **Mixed concerns:** AppShell has layout + inline styles; pages have layout logic (flex, grid)
- **No shared components:** No `Card`, `PrimaryButton`, `EmptyState`; each page builds its own
- **File sizes:** All files &lt; 250 lines — OK
- **Logic in UI:** Minimal; services used for API; no heavy logic in components

## 7. Summary

The app has a functional dark shell with i18n and auth, but the UI feels utilitarian. Missing: Events/Users/Settings pages, sidebar icons, theme toggle, working language switch, design tokens as single source of truth, and premium visual polish.

**Post-audit updates (2026-03-03):** Tokens, ThemeProvider, LocaleContext, new UI components (Card, SectionHeader, PrimaryButton, SecondaryButton, Badge, Table, EmptyState), redesigned AppShell with icons and theme toggle, Events/Users/Settings shells, Dashboard KPIs + quick actions + recent events, language switch + theme toggle with localStorage persistence, docs/ui-styleguide.md.
