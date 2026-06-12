import {
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  Dumbbell,
  FileSignature,
  FileText,
  GitBranch,
  Globe,
  Inbox,
  LayoutDashboard,
  Monitor,
  Newspaper,
  Radio,
  Scale,
  Settings,
  ShieldCheck,
  Shuffle,
  Trophy,
  UserCircle2,
  Users,
} from 'lucide-react';

export type AdminNavItemKey =
  | 'dashboard'
  | 'events'
  | 'registrations'
  | 'weighin'
  | 'integrity'
  | 'draw'
  | 'brackets'
  | 'schedule'
  | 'live'
  | 'display'
  | 'results'
  | 'countries'
  | 'clubs'
  | 'athletes'
  | 'users'
  | 'categoryOptions'
  | 'categoryTemplates'
  | 'signatures'
  | 'news'
  | 'inbox'
  | 'settings';

type NavItem = {
  key: AdminNavItemKey;
  href: string;
  icon: typeof LayoutDashboard;
};

export type NavSection = {
  labelKey: string;
  items: NavItem[];
};

export const adminNavSections: NavSection[] = [
  {
    labelKey: 'overview',
    items: [
      { key: 'dashboard', href: '/admin', icon: LayoutDashboard },
      { key: 'events', href: '/admin/events', icon: Calendar },
    ],
  },
  {
    labelKey: 'tournament',
    items: [
      { key: 'registrations', href: '/admin/registrations', icon: ClipboardList },
      { key: 'weighin', href: '/admin/weighin', icon: Scale },
      { key: 'integrity', href: '/admin/integrity', icon: ShieldCheck },
      { key: 'draw', href: '/admin/weighin-results', icon: Shuffle },
      { key: 'brackets', href: '/admin/brackets', icon: GitBranch },
      { key: 'schedule', href: '/admin/schedule', icon: Clock },
      { key: 'live', href: '/admin/live', icon: Radio },
      { key: 'display', href: '/display', icon: Monitor },
      { key: 'results', href: '/admin/results', icon: Trophy },
    ],
  },
  {
    labelKey: 'people',
    items: [
      { key: 'countries', href: '/admin/countries', icon: Globe },
      { key: 'clubs', href: '/admin/clubs', icon: Building2 },
      { key: 'athletes', href: '/admin/athletes', icon: UserCircle2 },
      { key: 'users', href: '/admin/users', icon: Users },
    ],
  },
  {
    labelKey: 'setup',
    items: [
      { key: 'categoryOptions', href: '/admin/category-options', icon: Dumbbell },
      { key: 'categoryTemplates', href: '/admin/category-templates', icon: FileText },
      { key: 'signatures', href: '/admin/signatures', icon: FileSignature },
      { key: 'settings', href: '/admin/settings', icon: Settings },
    ],
  },
  {
    labelKey: 'content',
    items: [
      { key: 'news', href: '/admin/news', icon: Newspaper },
      { key: 'inbox', href: '/admin/inbox', icon: Inbox },
    ],
  },
];
