'use client';

import { useState, type ElementType, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  Building,
  UserCircle,
  ShieldCheck,
  ArrowRight,
  Check,
  Copy,
  Users,
  FileText,
  Calendar,
  Scale,
  Shuffle,
  CalendarClock,
  Radio,
  Trophy,
  Download,
  Newspaper,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/api/client';
import { adminVariants } from '@/lib/animations/variants';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

interface MeResponse {
  userId: string;
  organisationId: string;
  organisationName: string | null;
  role: string;
  displayName: string | null;
  capabilities: string[];
  clubId: string | null;
  clubName: string | null;
}

/** Accent token per role — drives the identity badge + role chip colour. */
const ROLE_ACCENT: Record<string, string> = {
  admin: 'var(--color-primary)',
  coach: 'var(--color-accent-cyan)',
  judge: 'var(--color-warning)',
  timekeeper: 'var(--color-accent-pink)',
  athlete: 'var(--color-text-muted)',
};

/** Icon + accent token per capability code. Falls back gracefully for unknown codes. */
const CAP_META: Record<string, { icon: ElementType; accent: string }> = {
  EVENTS_MANAGE: { icon: Calendar, accent: 'var(--color-primary)' },
  RULESETS_MANAGE: { icon: FileText, accent: 'var(--color-accent-cyan)' },
  ATHLETES_MANAGE: { icon: Users, accent: 'var(--color-accent-pink)' },
  WEIGHIN_RUN: { icon: Scale, accent: 'var(--color-warning)' },
  DRAW_RUN: { icon: Shuffle, accent: 'var(--color-accent-violet)' },
  SCHEDULE_MANAGE: { icon: CalendarClock, accent: 'var(--color-info)' },
  LIVE_RUN: { icon: Radio, accent: 'var(--color-success)' },
  RESULTS_MANAGE: { icon: Trophy, accent: 'var(--color-accent-violet)' },
  EXPORTS_MANAGE: { icon: Download, accent: 'var(--color-accent-cyan)' },
  CONTENT_MANAGE: { icon: Newspaper, accent: 'var(--color-primary)' },
};

function tint(accent: string, pct = 14) {
  return `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
}

function humanize(code: string) {
  return code
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function initialsFrom(name: string | null | undefined) {
  return (
    (name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/* ---------------------------------------------------------------- primitives */

function IconChip({ icon: Icon, accent, size = 'md' }: { icon: ElementType; accent: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl';
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-4.5 w-4.5';
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${box}`}
      style={{ background: tint(accent), color: accent }}
    >
      <Icon className={glyph} strokeWidth={2} aria-hidden />
    </span>
  );
}

function RoleBadge({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: tint(accent), color: accent }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden />
      {label}
    </span>
  );
}

function SectionCard({
  icon,
  accent,
  title,
  trailing,
  children,
}: {
  icon: ElementType;
  accent: string;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-5 py-3.5">
        <IconChip icon={icon} accent={accent} size="sm" />
        <h2 className="text-[14px] font-semibold text-[var(--color-text)]">{title}</h2>
        {trailing && <span className="ml-auto">{trailing}</span>}
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string | null; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] py-3 last:border-0">
      <span className="shrink-0 text-[13px] text-[var(--color-text-muted)]">{label}</span>
      {children ?? (
        <span className="truncate text-right text-[13px] font-medium text-[var(--color-text)]">{value || '—'}</span>
      )}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value?: string | null }) {
  const t = useTranslations('admin.settings');
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--color-border)] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="shrink-0 text-[13px] text-[var(--color-text-muted)]">{label}</span>
      {value ? (
        <span className="inline-flex min-w-0 items-center gap-2">
          <code className="truncate rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-2 py-1 font-mono text-[11px] text-[var(--color-text)]">
            {value}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? t('actionCopied') : t('actionCopy')}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--color-success)]" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </span>
      ) : (
        <span className="text-[13px] font-medium text-[var(--color-text)]">—</span>
      )}
    </div>
  );
}

function CapabilityPill({ code, label }: { code: string; label: string }) {
  const meta = CAP_META[code];
  const Icon = meta?.icon ?? ShieldCheck;
  const accent = meta?.accent ?? 'var(--color-text-muted)';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text)]">
      <Icon className="h-3.5 w-3.5" strokeWidth={2} style={{ color: accent }} aria-hidden />
      {label}
    </span>
  );
}

function LinkTile({
  href,
  icon,
  label,
  desc,
  accent,
}: {
  href: string;
  icon: ElementType;
  label: string;
  desc: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3.5 py-3 transition-all hover:bg-[var(--color-surface)] hover:shadow-[var(--shadow-card)] hover:ring-1 hover:ring-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <span className="transition-transform duration-200 group-hover:scale-110">
        <IconChip icon={icon} accent={accent} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--color-text)]">{label}</p>
        <p className="truncate text-[11px] text-[var(--color-text-muted)]">{desc}</p>
      </div>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-4">
          <Skeleton width="56px" height="56px" className="!rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton width="180px" height="18px" />
            <Skeleton width="130px" height="14px" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <Skeleton width="40%" height="14px" />
            <Skeleton width="100%" height="14px" />
            <Skeleton width="75%" height="14px" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <Skeleton width="30%" height="14px" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} width="110px" height="28px" className="!rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- page */

export default function SettingsPage() {
  const t = useTranslations('admin.settings');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const {
    data: me,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<MeResponse>('/api/auth/me'),
  });

  const role = me?.role ?? '';
  const roleAccent = ROLE_ACCENT[role] ?? 'var(--color-text-muted)';
  const roleLabel = role in ROLE_ACCENT ? t(`roles.${role}` as Parameters<typeof t>[0]) : role || '—';
  const capLabel = (code: string) =>
    code in CAP_META ? t(`capabilityLabels.${code}` as Parameters<typeof t>[0]) : humanize(code);
  const capabilities = me?.capabilities ?? [];

  const links: { href: string; icon: ElementType; label: string; desc: string; accent: string }[] = [
    {
      href: `/${locale}/admin/users`,
      icon: Users,
      label: t('linkUsers'),
      desc: t('linkUsersDesc'),
      accent: 'var(--color-primary)',
    },
    {
      href: `/${locale}/admin/category-templates`,
      icon: FileText,
      label: t('linkRulesets'),
      desc: t('linkRulesetsDesc'),
      accent: 'var(--color-accent-cyan)',
    },
    {
      href: `/${locale}/admin/clubs`,
      icon: Building,
      label: t('linkClubs'),
      desc: t('linkClubsDesc'),
      accent: 'var(--color-accent-pink)',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <SettingsSkeleton />
      ) : me ? (
        <motion.div
          className="space-y-6"
          variants={adminVariants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Identity */}
          <motion.div variants={adminVariants.staggerChild}>
            <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{ background: `radial-gradient(420px circle at 0% 0%, ${roleAccent}, transparent 70%)` }}
                aria-hidden
              />
              <div className="relative flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[18px] font-bold uppercase"
                  style={{ background: tint(roleAccent, 16), color: roleAccent }}
                >
                  {initialsFrom(me.displayName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-bold text-[var(--color-text)]">{me.displayName || '—'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <RoleBadge label={roleLabel} accent={roleAccent} />
                    {me.organisationName && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
                        <Building2 className="h-3 w-3" aria-hidden />
                        {me.organisationName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Organisation + Profile */}
          <motion.div className="grid gap-6 lg:grid-cols-2" variants={adminVariants.staggerChild}>
            <SectionCard icon={Building2} accent="var(--color-primary)" title={t('sectionOrganisation')}>
              <InfoRow label={t('fieldOrgName')} value={me.organisationName} />
              <CopyRow label={t('fieldOrgId')} value={me.organisationId} />
            </SectionCard>

            <SectionCard icon={UserCircle} accent="var(--color-accent-violet)" title={t('sectionProfile')}>
              <InfoRow label={t('fieldDisplayName')} value={me.displayName} />
              <InfoRow label={t('fieldRole')}>
                <RoleBadge label={roleLabel} accent={roleAccent} />
              </InfoRow>
              {me.clubName && <InfoRow label={t('fieldClub')} value={me.clubName} />}
            </SectionCard>
          </motion.div>

          {/* Capabilities */}
          <motion.div variants={adminVariants.staggerChild}>
            <SectionCard
              icon={ShieldCheck}
              accent="var(--color-success)"
              title={t('sectionCapabilities')}
              trailing={
                <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                  {capabilities.length}
                </span>
              }
            >
              {capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-2 py-4">
                  {capabilities.map((cap) => (
                    <CapabilityPill key={cap} code={cap} label={capLabel(cap)} />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-[13px] text-[var(--color-text-muted)]">{t('capabilitiesEmpty')}</p>
              )}
            </SectionCard>
          </motion.div>

          {/* Quick links */}
          <motion.div variants={adminVariants.staggerChild}>
            <SectionCard icon={ArrowRight} accent="var(--color-info)" title={t('sectionQuickLinks')}>
              <div className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-3">
                {links.map((link) => (
                  <LinkTile key={link.href} {...link} />
                ))}
              </div>
            </SectionCard>
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
