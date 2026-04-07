import {
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  GitBranch,
  Inbox,
  LayoutDashboard,
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
  | 'results'
  | 'clubs'
  | 'athletes'
  | 'users'
  | 'categoryTemplates'
  | 'news'
  | 'inbox'
  | 'settings';

export type NavItem = {
  key: AdminNavItemKey;
  href: string;
  icon: typeof LayoutDashboard;
};

export type NavSection = {
  labelKey: string;
  items: NavItem[];
};

export const adminEventOpsShortcutKeys: Array<
  'registrations' | 'weighin' | 'integrity' | 'draw' | 'schedule' | 'live'
> = ['registrations', 'weighin', 'integrity', 'draw', 'schedule', 'live'];

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
      { key: 'draw', href: '/admin/draw', icon: Shuffle },
      { key: 'brackets', href: '/admin/brackets', icon: GitBranch },
      { key: 'schedule', href: '/admin/schedule', icon: Clock },
      { key: 'live', href: '/admin/live', icon: Radio },
      { key: 'results', href: '/admin/results', icon: Trophy },
    ],
  },
  {
    labelKey: 'people',
    items: [
      { key: 'clubs', href: '/admin/clubs', icon: Building2 },
      { key: 'athletes', href: '/admin/athletes', icon: UserCircle2 },
    ],
  },
  {
    labelKey: 'admin',
    items: [
      { key: 'users', href: '/admin/users', icon: Users },
      { key: 'categoryTemplates', href: '/admin/category-templates', icon: FileText },
      { key: 'news', href: '/admin/news', icon: Newspaper },
      { key: 'inbox', href: '/admin/inbox', icon: Inbox },
      { key: 'settings', href: '/admin/settings', icon: Settings },
    ],
  },
];
