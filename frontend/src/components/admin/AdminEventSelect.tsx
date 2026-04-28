'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';
import {
  AdminFilterSelect,
  type AdminFilterOption,
} from '@/components/admin/AdminFilterSelect';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseEventDate(value: string) {
  if (ISO_DATE_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

type Props = {
  label: string;
  value: string;
  placeholder: string;
  events: EventRow[] | undefined;
  onValueChange: (value: string) => void;
  className?: string;
};

export function AdminEventSelect({
  label,
  value,
  placeholder,
  events,
  onValueChange,
  className,
}: Props) {
  const locale = useLocale();

  const options = useMemo<AdminFilterOption[]>(
    () =>
      (events ?? []).map((event) => {
        const displayName = localizedName(event.name, event.nameKa, locale);
        if (!event.competitionStartDate) {
          return { value: event.id, label: displayName };
        }

        const parsed = parseEventDate(event.competitionStartDate);
        return {
          value: event.id,
          label: Number.isNaN(parsed.getTime())
            ? displayName
            : `${displayName} (${new Intl.DateTimeFormat(locale).format(parsed)})`,
        };
      }),
    [events, locale],
  );

  return (
    <AdminFilterSelect
      label={label}
      value={value}
      emptyLabel={placeholder}
      options={options}
      onValueChange={onValueChange}
      className={className}
    />
  );
}
