# Public Pages

This document lists all public routes and what appears on each page.

## Routes Overview

| Route | Auth | Description |
|-------|------|-------------|
| `/` | No | Home (redirects to `/{locale}`) |
| `/{locale}` | No | Home landing page |
| `/{locale}/about` | No | About page |
| `/{locale}/rules` | No | Rules overview |
| `/{locale}/events` | No | Events list |
| `/{locale}/events/:slug` | No | Event details |
| `/{locale}/events/:slug/brackets` | No | Brackets (published only) |
| `/{locale}/events/:slug/schedule` | No | Schedule (published only) |
| `/{locale}/events/:slug/results` | No | Results (published only) |
| `/{locale}/events/:slug/live` | No | **Live competition** — current bout, on-deck, next, sessions |
| `/{locale}/mat/:eventSlug/:matName` | No | **Venue TV scoreboard** for one mat (full-screen) |
| `/{locale}/login` | No | Single login form (all roles) |

## Page Contents

### Home (`/{locale}`)

- **Hero section**: Title "Geo Wushu Competition System", subtitle, primary CTA "View events", secondary CTA "Admin sign in"
- **3 feature cards**: Live schedule, Brackets & results, Fast event ops
- **How it works**: 4-step row (Register → Weigh-in → Brackets → Competition)
- **Images**: Hero action SVG, tournament desk SVG (from `/public/images/`)

### About (`/{locale}/about`)

- Image header
- Mission section
- What the system does
- Contact placeholder

### Rules (`/{locale}/rules`)

- Event lifecycle (8 stages): Registration open → Locked → Weigh-in → Weigh-in completed → Draw → Published → Live → Completed
- Publishing concept: public sees only published content

### Events list (`/{locale}/events`)

- List of events (upcoming and past)
- Empty state when no events

### Event detail (`/{locale}/events/:id`)

- Event details
- Links to brackets, schedule, results

### Brackets / Schedule / Results (`/{locale}/events/:slug/brackets|schedule|results`)

- "Not published yet" when content is not published
- Actual content when published

### Live (`/{locale}/events/:slug/live`)

The spectator-facing live page — **the flagship public feature**. Read-only, auto-refreshing. Solves the core problem: *nobody has to ask "what fight is on now / when is mine?"*

- **Current fight** card: category + bout #, red vs blue athlete (bilingual), round/phase status (e.g. "Round 2" / "Rest"), round-wins summary (red X – blue Y). No ticking clock — coarse status only.
- **Result banner** when the bout is decided (winner + method: points / KO / DQ / walkover).
- **Latest result** banner (the bout that just finished).
- **On Deck** + **Next** cards — what's coming up.
- **Sessions** list — full running order grouped by session, with "Winner of N" / "TBD" placeholders for undecided slots.

### Mat / TV screen (`/{locale}/mat/:eventSlug/:matName`)

Full-screen dark scoreboard for one physical mat — meant for a TV/projector in the hall. Anonymous (no login), updates live:

- Big **"NOW"** row: red athlete name | large running timer | blue athlete name, with category + bout #.
- **On Deck** and **Next** lists below.
- "No active fight" state still shows On Deck + Next.
- "Reconnecting…" overlay if the connection drops (keeps the last data on screen).

### Login (`/{locale}/login`)

- Single form for admin, coach, and athlete
- Role-based redirect after sign-in
