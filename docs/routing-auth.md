# Routing & Auth — Geo Wushu Competition System

## Overview

Login is **not** the first page. Public users (no account) can view events, brackets, schedule, and results. Auth is required only for admin/staff actions.

---

## Route Structure

### Public routes (no auth)

| Route | Purpose |
|-------|---------|
| `/` | Public home (landing) |
| `/[locale]/events` | Events list |
| `/[locale]/events/[id]` | Event details |
| `/[locale]/events/[id]/brackets` | Brackets (published only) |
| `/[locale]/events/[id]/schedule` | Schedule (published only) |
| `/[locale]/events/[id]/results` | Results (published only) |

### Auth

| Route | Purpose |
|-------|---------|
| `/[locale]/login` | Login page (single form for Admin/Coach/Athlete) |
| `/[locale]/dashboard` | Role-based redirect to /admin, /coach, or /athlete |

### Admin routes (auth required)

| Route | Purpose |
|-------|---------|
| `/[locale]/admin` | Admin dashboard |
| `/[locale]/admin/events` | Admin events list |
| `/[locale]/admin/events/[id]/...` | Admin event management |
| `/[locale]/admin/rulesets` | Rulesets |
| `/[locale]/admin/users` | Users |
| `/[locale]/admin/settings` | Settings |

---

## Access Control (MVP)

1. **Protected routes**: `/admin`, `/coach`, `/athlete`, `/dashboard` require auth. If not signed in → redirect to `/[locale]/login?next=...`
2. **Login redirect**: If user hits `/login` while signed in → redirect to `/[locale]/dashboard` (which redirects by role)
3. **Role guards**: Admin layout requires `events:manage` or admin role; Coach requires coach/admin; Athlete requires any role. Wrong role → `/[locale]/no-access`
3. **Unpublished content**: If event content (brackets, schedule, results) is not published and a public user opens it → show "Not published yet" page (no data leakage)
4. **Layouts**:
   - Public shell: simple topbar (logo, View events, Admin sign in, language + theme toggles)
   - Admin shell: sidebar + topbar (only inside `/admin/*`, not on login page)

---

## Public Home

- **Primary CTA**: "View events" → `/[locale]/events`
- **Secondary link**: "Admin sign in" (top right) → `/[locale]/login`

---

## Theme & Language

- **Single provider/store**: Theme and language persist globally via `ThemeProvider` and `LocaleContext` (localStorage: `gw_theme`, `gw_locale`)
- **Toggles on both shells**: Public topbar and admin topbar both show EN|KA and sun/moon theme toggle
- **Shared component**: `TopbarToggles` used in `PublicLayout` and `AppShell`
