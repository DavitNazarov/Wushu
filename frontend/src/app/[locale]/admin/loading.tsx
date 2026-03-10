import { SkeletonRows } from '@/components/ui/Skeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-56 animate-pulse rounded bg-[var(--color-surface-alt)]" />
      <SkeletonRows rows={4} cols={3} />
      <SkeletonRows rows={4} cols={2} />
    </div>
  );
}
