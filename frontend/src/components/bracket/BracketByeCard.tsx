'use client';

type Props = {
  label: string;
};

export function BracketByeCard({ label }: Props) {
  return (
    <div className="inline-flex rounded-[var(--radius-pill)] border border-slate-400/30 bg-slate-400/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-slate-300">
      {label}
    </div>
  );
}
