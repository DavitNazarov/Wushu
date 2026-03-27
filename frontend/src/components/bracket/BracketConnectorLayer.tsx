'use client';

type Props = {
  showRight: boolean;
  showLeft: boolean;
};

export function BracketConnectorLayer({ showRight, showLeft }: Props) {
  return (
    <>
      {showRight && (
        <span className="bracket-connector-fallback pointer-events-none absolute -right-5 top-1/2 h-px w-5 -translate-y-1/2 bg-[var(--color-border)]/80" />
      )}
      {showLeft && (
        <span className="bracket-connector-fallback pointer-events-none absolute -left-5 top-1/2 h-px w-5 -translate-y-1/2 bg-[var(--color-border)]/80" />
      )}
    </>
  );
}
