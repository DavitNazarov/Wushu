'use client';

import { Card } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';

type Props = {
  rows?: number;
};

export function EventTabPanelFallback({ rows = 3 }: Props) {
  return (
    <Card>
      <SkeletonRows rows={rows} cols={1} />
    </Card>
  );
}
