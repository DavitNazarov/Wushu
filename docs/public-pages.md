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
| `/{locale}/events/:id` | No | Event details |
| `/{locale}/events/:id/brackets` | No | Brackets (published only) |
| `/{locale}/events/:id/schedule` | No | Schedule (published only) |
| `/{locale}/events/:id/results` | No | Results (published only) |
| `/{locale}/login` | No | Single login form (admin/coach/athlete) |

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

- Event lifecycle (7 steps): Registration open → Weigh-in → Locked → Draw → Published → Live → Completed
- Publishing concept: public sees only published content

### Events list (`/{locale}/events`)

- List of events (upcoming and past)
- Empty state when no events

### Event detail (`/{locale}/events/:id`)

- Event details
- Links to brackets, schedule, results

### Brackets / Schedule / Results (`/{locale}/events/:id/brackets|schedule|results`)

- "Not published yet" when content is not published
- Actual content when published (to be implemented)

### Login (`/{locale}/login`)

- Single form for admin, coach, and athlete
- Role-based redirect after sign-in
