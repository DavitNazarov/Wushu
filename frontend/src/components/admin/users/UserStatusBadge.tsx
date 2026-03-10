'use client';

import { Badge } from '@/components/ui/Badge';

type Props = {
  status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE';
  label: string;
};

export function UserStatusBadge({ status, label }: Props) {
  const variant =
    status === 'ACTIVE'
      ? 'success'
      : status === 'DQ'
        ? 'warning'
        : status === 'ARCHIVED'
          ? 'danger'
          : 'default';

  return <Badge variant={variant}>{label}</Badge>;
}
