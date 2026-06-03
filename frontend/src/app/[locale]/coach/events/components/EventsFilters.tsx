'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { ALL_LIFECYCLE } from '../events.utils';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  lifecycleFilter: string;
  onLifecycleChange: (v: string) => void;
  lifecycleOptions: string[];
};

export function EventsFilters({ search, onSearchChange, lifecycleFilter, onLifecycleChange, lifecycleOptions }: Props) {
  const t = useTranslations('coach.events');
  const tEvents = useTranslations('admin.events');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <Input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-52 pl-9 bg-[var(--color-surface)]"
        />
      </div>
      <div className="relative flex items-center gap-1.5">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        <Select value={lifecycleFilter} onValueChange={onLifecycleChange}>
          <SelectTrigger className="h-10 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LIFECYCLE}>{t('filterAll')}</SelectItem>
            {lifecycleOptions.map((lc) => (
              <SelectItem key={lc} value={lc}>
                {tEvents(`lifecycle.${lc}` as Parameters<typeof tEvents>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
