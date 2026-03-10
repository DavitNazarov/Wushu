import type { EventLifecycle, RegistrationStatus, FightStatus, SubmissionStatus, RulesetStatus } from '@/types/api';

type ChipVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const lifecycleVariants: Record<EventLifecycle, ChipVariant> = {
  REG_OPEN: 'info',
  LOCKED: 'warning',
  WEIGHIN: 'warning',
  WEIGH_IN_COMPLETED: 'info',
  DRAWN: 'default',
  PUBLISHED: 'info',
  LIVE: 'success',
  COMPLETED: 'default',
};

const registrationVariants: Record<RegistrationStatus, ChipVariant> = {
  PENDING: 'warning',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'default',
};

const fightVariants: Record<FightStatus, ChipVariant> = {
  QUEUED: 'default',
  ON_DECK: 'warning',
  IN_PROGRESS: 'info',
  PAUSED: 'warning',
  COMPLETE: 'success',
  CONFIRMED: 'success',
};

const submissionVariants: Record<SubmissionStatus, ChipVariant> = {
  NEW: 'info',
  HANDLED: 'default',
};

const rulesetVariants: Record<RulesetStatus, ChipVariant> = {
  DRAFT: 'default',
  ACTIVE: 'success',
};

const variantStyles: Record<ChipVariant, string> = {
  default: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]',
  success: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-subtle)] text-[var(--color-info)]',
};

type StatusChipProps = {
  status: string;
  label: string;
  domain?: 'lifecycle' | 'registration' | 'fight' | 'submission' | 'ruleset';
};

export function StatusChip({ status, label, domain }: StatusChipProps) {
  let variant: ChipVariant = 'default';
  if (domain === 'lifecycle') variant = lifecycleVariants[status as EventLifecycle] ?? 'default';
  else if (domain === 'registration') variant = registrationVariants[status as RegistrationStatus] ?? 'default';
  else if (domain === 'fight') variant = fightVariants[status as FightStatus] ?? 'default';
  else if (domain === 'submission') variant = submissionVariants[status as SubmissionStatus] ?? 'default';
  else if (domain === 'ruleset') variant = rulesetVariants[status as RulesetStatus] ?? 'default';

  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
