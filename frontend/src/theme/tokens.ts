/**
 * Design tokens — single source of truth.
 * Use CSS variables for theme switching; Tailwind extends these.
 */
export const radii = {
  card: '12px',
  input: '10px',
  pill: '999px',
} as const;

export const spacing = {
  grid: 8,
  pageX: 24,
  pageY: 32,
  card: 24,
  section: 16,
} as const;

export const typography = {
  pageTitle: 'text-2xl font-semibold',
  sectionTitle: 'text-sm font-semibold',
  body: 'text-[15px] font-normal',
  helper: 'text-[13px]',
} as const;

/** Semantic colour tokens — applied via data-theme */
export const colours = {
  dark: {
    background: '#0B1220',
    surface: '#111827',
    surfaceAlt: '#1F2937',
    border: '#334155',
    text: '#E5E7EB',
    textMuted: '#9CA3AF',
    primary: '#123B6B',
    primaryHover: '#0f3159',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
  },
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    border: '#CBD5E1',
    text: '#0F172A',
    textMuted: '#64748B',
    primary: '#123B6B',
    primaryHover: '#0f3159',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
  },
} as const;
