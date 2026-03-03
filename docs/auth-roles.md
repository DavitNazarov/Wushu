# Auth & Roles — Geo Wushu Competition System

## Overview

Single login page for Admin, Coach, and Athlete. Role is determined by the backend (user record). After login, users are routed to their role-specific dashboard.

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

| Role | Dashboard | Capabilities (default) |
|------|-----------|------------------------|
| `admin` | `/admin` | All |
| `coach` | `/coach` | events:view_public, athletes:manage |
| `athlete` | `/athlete` | events:view_public |

---

## Capabilities

| Code | Description |
|------|-------------|
| `events:view_public` | View public events, brackets, schedule, results |
| `events:manage` | Create/edit events, lifecycle |
| `athletes:manage` | Manage athletes (coach) |
| `weighin:record` | Record weigh-in |
| `brackets:publish` | Publish brackets |
| `scoring:operate` | Operate scoring |
| `CAN_MANAGE_RULESETS` | Manage rulesets |

**Admin** has all capabilities. **Coach** and **Athlete** get role-based defaults; DB-assigned capabilities are merged.

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

- **User.role**: `admin` | `coach` | `athlete` (required, default `athlete`)
- **User.capabilities**: via `UserCapability` join (optional overrides)
- **JWT payload**: `sub`, `organisationId`, `role`, `capabilities[]`
- **Session**: httpOnly cookie `gw_auth`, 8h expiry
