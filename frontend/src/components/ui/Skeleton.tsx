type SkeletonProps = {
  className?: string;
  width?: string;
  height?: string;
};

export function Skeleton({ className = '', width, height = '16px' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: width ?? '100%', height }}
      aria-hidden
    />
  );
}

const ROW_WIDTHS = ['65%', '80%', '55%', '72%', '90%', '60%', '78%', '50%', '85%', '68%'];

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0 divide-y divide-[var(--color-border)] rounded-[var(--radius-card)] border border-[var(--color-border)] overflow-hidden">
      <div className="flex gap-4 bg-[var(--color-surface-alt)] px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={ROW_WIDTHS[i % ROW_WIDTHS.length]} height="14px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 bg-[var(--color-surface)] px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={ROW_WIDTHS[(r + c) % ROW_WIDTHS.length]} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpiRow({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <Skeleton width="60%" height="12px" />
          <div className="mt-2">
            <Skeleton width="40%" height="28px" />
          </div>
        </div>
      ))}
    </div>
  );
}
