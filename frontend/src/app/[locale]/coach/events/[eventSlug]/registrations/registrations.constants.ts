import { GitBranch, Clock, Radio } from 'lucide-react';

export const SUB_NAV = [
  { key: 'brackets', href: (slug: string, locale: string) => `/${locale}/coach/events/${slug}/brackets`, icon: GitBranch },
  { key: 'schedule', href: (slug: string, locale: string) => `/${locale}/coach/events/${slug}/schedule`, icon: Clock },
  { key: 'live', href: (slug: string, locale: string) => `/${locale}/coach/events/${slug}/live`, icon: Radio },
];
