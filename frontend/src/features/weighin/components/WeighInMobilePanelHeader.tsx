'use client';

import { Button } from '@/components/ui/primitives/button';
import { Card } from '@/components/ui/primitives/card';

type Props = {
  backLabel: string;
  queueLabel: string;
  selectedAthleteName: string;
  onBack: () => void;
};

export function WeighInMobilePanelHeader({
  backLabel,
  queueLabel,
  selectedAthleteName,
  onBack,
}: Props) {
  return (
    <div className="sticky top-[var(--topbar-height)] z-30 -mx-4 bg-[var(--color-bg)] px-4 py-3 md:hidden">
      <Card className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2 shadow-sm">
        <Button variant="secondary" className="min-h-[44px] shrink-0 px-3" onClick={onBack}>
          {`\u2190 ${backLabel} ${queueLabel}`}
        </Button>
        <p className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-[var(--color-text)]">
          {selectedAthleteName}
        </p>
      </Card>
    </div>
  );
}
