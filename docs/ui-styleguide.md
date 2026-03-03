# UI Styleguide — Geo Wushu Competition System

## Design Tokens

### Radii
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-card` | 12px | Cards, panels, modals |
| `--radius-input` | 10px | Inputs, buttons |
| `--radius-pill` | 999px | Badges, pills, language/theme toggles |

### Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-page` | 24px | Page horizontal padding |
| `--spacing-card` | 24px | Card internal padding |
| Grid | 8px | Base unit; use 8, 16, 24, 32 |

### Typography
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Page title | 24px (text-2xl) | semibold | Main page heading |
| Section title | 14px (text-sm) | semibold | Section headers |
| Body | 15px | normal | Main content |
| Helper | 13px | normal | Muted descriptions |

### Colours (CSS variables)
| Variable | Dark | Light |
|----------|------|-------|
| `--color-bg` | #0B1220 | #F8FAFC |
| `--color-surface` | #111827 | #FFFFFF |
| `--color-surface-alt` | #1F2937 | #F1F5F9 |
| `--color-border` | #334155 | #CBD5E1 |
| `--color-text` | #E5E7EB | #0F172A |
| `--color-text-muted` | #9CA3AF | #64748B |
| `--color-primary` | #123B6B | #123B6B |
| `--color-primary-hover` | #0f3159 | #0f3159 |

### Shadows
- `--shadow-soft`: Low-contrast, subtle elevation for cards.

---

## Components

### AppShell
- **Sidebar**: Icons + labels, active state (primary bg), hover state.
- **Topbar**: Title, tagline, event selector, status pill, language EN|KA, theme toggle (sun/moon).
- **Content**: Max width 1200px, page padding 24–32px.

### Card
- Rounded corners (`--radius-card`), border, surface bg, soft shadow.
- Padding 24px by default; override with `className="p-5"` etc.

### SectionHeader
- `title`: Section title (14px semibold).
- `action`: Optional right-aligned button or link.

### PrimaryButton
- Height 44px, Geo Navy bg, white text.
- Use for main CTAs (New Ruleset, Add User, etc.).

### SecondaryButton
- Outlined, transparent bg, border.
- Use for secondary actions.

### Badge
- Variants: `default`, `success`, `warning`, `danger`.
- Pill shape, 11px font.

### Table
- Use `Table`, `TableHead`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`.
- Header: muted text; cells: `muted` prop for secondary data.

### EmptyState
- Dashed border, centered content.
- `title`, optional `description`, optional `action` (CTA button).

---

## Layout Rules

1. **Max content width**: 1100–1200px for admin.
2. **Page padding**: 24px horizontal, 32px vertical.
3. **Card padding**: 20–24px.
4. **No hardcoded colours**: Use `var(--color-*)` or design tokens.
5. **i18n**: All visible text via `useTranslations`; no hardcoded strings.

---

## Theme Switching

- Theme stored in `localStorage` key `gw_theme` (`light` | `dark`).
- `data-theme` on `<html>` drives CSS variables.
- Inline script in `<head>` prevents flash before hydration.

---

## Language Switching

- Locale in URL path (`/en/...`, `/ka/...`).
- Persisted in `localStorage` key `gw_locale`.
- Switch via buttons that navigate to same path with new locale prefix.
