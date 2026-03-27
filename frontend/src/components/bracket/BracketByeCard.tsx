'use client';

type Props = {
  label: string;
};

export function BracketByeCard({ label }: Props) {
  return (
    <div className="inline-flex rounded-[var(--radius-pill)] border border-slate-400/30 bg-slate-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-300">
      {label}
    </div>
  );
}
