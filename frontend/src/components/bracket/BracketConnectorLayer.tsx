'use client';

type Props = {
  showRight: boolean;
  showLeft: boolean;
};

export function BracketConnectorLayer({ showRight, showLeft }: Props) {
  return (
    <>
      {showRight && (
        <span className="pointer-events-none absolute -right-4 top-1/2 h-px w-4 -translate-y-1/2 bg-[var(--color-border)]/80" />
      )}
      {showLeft && (
        <span className="pointer-events-none absolute -left-4 top-1/2 h-px w-4 -translate-y-1/2 bg-[var(--color-border)]/80" />
      )}
    </>
  );
}
