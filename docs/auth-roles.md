# Auth & Roles — Geo Wushu Competition System

## Overview

Single login page for all roles. Role is determined by the backend (user record). After login, users are routed to their role-specific dashboard. Permissions are **capability-based**, not role-based — see Capabilities below.

---

## Login

- **Route**: `/[locale]/login` (public)
- **Form**: Email, Password, Sign in button, Forgot password (stubbed)
- **No role selector** — role comes from user record in DB
- **Error states**:
  - Invalid credentials
  - User disabled (`USER_DISABLED`)
  - No role assigned (`NO_ROLE`)

---

## Roles

**Three roles** (`UserRole` enum + `backend/src/auth/capabilities.ts`):

| Role | Dashboard | Capabilities (default) |
|------|-----------|------------------------|
| `admin` | `/admin` | All 10 |
| `coach` | `/coach` | `ATHLETES_MANAGE` |
| `athlete` | `/athlete` | none |

> **Operational reality (important):** the `UserRole` enum also contains leftover `judge` and `timekeeper` values, but they are **not used** — they are not real roles. In a real competition the **main judge / admin operates everything from the admin pages** — both the weigh-in screen and the live scoring page. One operator drives one screen. Don't design features that assume separate judge/timekeeper logins.

---

## Capabilities

Codes are `SCREAMING_SNAKE` (`backend/src/auth/capabilities.ts`):

| Code | Default holders | Grants |
|------|-----------------|--------|
| `EVENTS_MANAGE` | admin | Events, users, clubs (write), news, inbox |
| `RULESETS_MANAGE` | admin | Category templates / options |
| `ATHLETES_MANAGE` | admin, coach | Athletes + registrations |
| `WEIGHIN_RUN` | admin | Weigh-in screen |
| `DRAW_RUN` | admin | Draw + brackets |
| `SCHEDULE_MANAGE` | admin | Mats, sessions, fight order |
| `LIVE_RUN` | admin | Live scoring + timer |
| `RESULTS_MANAGE` | admin | Results page |
| `EXPORTS_MANAGE` | admin | PDF exports |
| `CONTENT_MANAGE` | admin | Defined but currently unused |

**Admin** gets all 10. Effective capabilities = role defaults ∪ any `UserCapability` DB rows (note: no admin API currently writes `UserCapability` rows, so role defaults are effectively the whole story today). Endpoints are guarded by `@UseGuards(AuthGuard, CapabilityGuard)` + `@RequireCapability('CODE')`.

---

## Route Guards

| Route | Required |
|-------|----------|
| `/admin/*` | `events:manage` or role `admin` |
| `/coach/*` | role `admin` or `coach` |
| `/athlete/*` | role `admin`, `coach`, or `athlete` |

If user is logged in but lacks permission → redirect to `/[locale]/no-access` (no redirect loop).

---

## Post-Login Redirect

1. API returns `{ ok: true, role }`
2. Client redirects: `admin` → `/admin`, `coach` → `/coach`, `athlete` → `/athlete`
3. If user visits `/login` while signed in → middleware redirects to `/dashboard`
4. `/dashboard` reads role from session and redirects to correct dashboard

---

## Data Model

- **User.role**: `admin` | `coach` | `judge` | `timekeeper` | `athlete` (required, default `athlete`)
- **User.capabilities**: via `UserCapability` join (optional additive overrides)
- **JWT payload**: `sub`, `organisationId`, `role`, `capabilities[]`, `clubId`
- **Session**: httpOnly cookies — `gw_auth` (access, 15 min) + `gw_refresh` (refresh, 7 days). Refresh tokens are DB-backed (SHA-256 hashed) with rotation + reuse/theft detection. `AuthGuard` re-validates the user against the DB on every request (rejects archived/disabled/DQ-suspended users).
