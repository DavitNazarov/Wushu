'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Crown,
  Medal,
  Sparkles,
  Flame,
  TrendingUp,
  MapPin,
  Newspaper,
  Users,
} from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { localizedFullName, localizedName } from '@/lib/bilingual';

/* ─── types ──────────────────────────────────────────────────────────────── */

type TopAthlete = {
  rank: number;
  id: string;
  firstName: string;
  firstNameKa: string | null;
  lastName: string;
  lastNameKa: string | null;
  sex: 'MALE' | 'FEMALE' | null;
  club: { id: string; name: string; nameKa: string | null; country: string | null } | null;
  wins: number;
  losses: number;
};

type TopClub = {
  rank: number;
  id: string;
  name: string;
  nameKa: string | null;
  city: string | null;
  country: string | null;
  athletes: number;
  gold: number;
  silver: number;
  bronze: number;
  medals: number;
};

type PublicNewsRow = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  createdAt: string;
  eventId: string | null;
  event: { id: string; name: string; slug: string; location: string | null } | null;
};

/* ─── rank palette ───────────────────────────────────────────────────────── */

const RANK_PALETTE: Record<number, { accent: string; icon: React.ElementType; label: string }> = {
  1: { accent: '#f5b301', icon: Crown,     label: 'Champion' },
  2: { accent: '#9aa6b2', icon: Medal,     label: '2nd' },
  3: { accent: '#cd7f32', icon: Medal,     label: '3rd' },
  4: { accent: 'var(--color-primary)' as unknown as string, icon: TrendingUp, label: '4th' },
  5: { accent: 'var(--color-primary)' as unknown as string, icon: TrendingUp, label: '5th' },
};

/* ─── medal palette ──────────────────────────────────────────────────────── */

const MEDAL_COLORS = { gold: '#f5b301', silver: '#9aa6b2', bronze: '#cd7f32' } as const;

/** Single colored medal count (icon + number), used in the top-clubs ranking. */
function MedalCount({ color, value }: { color: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Medal className="h-4 w-4 shrink-0" style={{ color }} />
      <span className="text-[14px] font-bold tabular-nums leading-none text-[var(--color-text)]">
        {value}
      </span>
    </span>
  );
}

/* ─── section header ──────────────────────────────────────────────────────── */

function SectionHeader({
  eyebrow,
  icon: Icon,
  title,
  subtitle,
}: {
  eyebrow: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10 flex flex-col items-center text-center"
    >
      <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-3.5 py-1.5">
        <Icon className="h-3 w-3 text-[var(--color-primary)]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
          {eyebrow}
        </span>
      </span>
      <h2 className="text-[clamp(1.7rem,3.6vw,2.6rem)] font-black tracking-tight text-[var(--color-text)]">
        {title}
      </h2>
      <p className="mt-3 max-w-[460px] text-[14px] leading-relaxed text-[var(--color-text-muted)]">
        {subtitle}
      </p>
    </motion.div>
  );
}

/* ─── top athlete row ─────────────────────────────────────────────────────── */

function TopAthleteRow({ a, idx, locale }: { a: TopAthlete; idx: number; locale: string }) {
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const palette = RANK_PALETTE[a.rank] ?? RANK_PALETTE[5];
  const fullName = localizedFullName(a.firstName, a.lastName, a.firstNameKa, a.lastNameKa, locale);
  const initials = `${a.firstName[0] ?? ''}${a.lastName[0] ?? ''}`.toUpperCase();
  const clubName = a.club ? localizedName(a.club.name, a.club.nameKa, locale) : null;
  const tPublic = useTranslations('public');

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: idx * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/${locale}/athletes/${a.id}`} className="block">
        <motion.div
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setSpot(null)}
          whileHover={{ y: -4 }}
          className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-primary)]/40"
          style={{ borderLeftColor: palette.accent, borderLeftWidth: '3px' }}
        >
          {spot && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(260px circle at ${spot.x}px ${spot.y}px, ${palette.accent}22, transparent 70%)`,
              }}
            />
          )}

          <div className="relative flex items-center gap-5">
            {/* Avatar + rank badge */}
            <div className="relative shrink-0">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-[16px] font-bold text-white shadow-md transition-transform duration-500 group-hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${palette.accent}, var(--color-primary))` }}
              >
                {initials || '?'}
              </div>
              <div
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-surface)] text-[10px] font-black text-white shadow"
                style={{ background: palette.accent }}
              >
                {a.rank}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                {fullName}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                {clubName ?? tPublic('topAthletesUnattached')}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-5 sm:flex">
              <div className="text-center">
                <p className="text-[20px] font-bold tabular-nums leading-none text-[var(--color-text)]">{a.wins}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('topAthletesWins')}
                </p>
              </div>
              <div className="h-8 w-px bg-[var(--color-border)]" />
              <div className="text-center">
                <p className="text-[20px] font-bold tabular-nums leading-none text-[var(--color-text-muted)]">{a.losses}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('topAthletesLosses')}
                </p>
              </div>
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-primary)]" />
          </div>

          {/* Mobile wins/losses */}
          <div className="relative mt-3.5 flex items-center gap-3 sm:hidden">
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface-alt)] px-3 py-1">
              <Flame className="h-3 w-3" style={{ color: palette.accent }} />
              <span className="text-[11px] font-semibold tabular-nums text-[var(--color-text)]">
                {a.wins} {tPublic('topAthletesWins')}
              </span>
            </div>
            <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
              {a.losses} {tPublic('topAthletesLosses')}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

/* ─── top club row ────────────────────────────────────────────────────────── */

function TopClubRow({ c, idx, locale }: { c: TopClub; idx: number; locale: string }) {
  const tPublic = useTranslations('public');
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const palette = RANK_PALETTE[c.rank] ?? RANK_PALETTE[5];
  const name = localizedName(c.name, c.nameKa, locale);
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: idx * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/${locale}/clubs/${c.id}`} className="block">
        <motion.div
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setSpot(null)}
          whileHover={{ y: -4 }}
          className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-primary)]/40"
          style={{ borderLeftColor: palette.accent, borderLeftWidth: '3px' }}
        >
          {spot && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(260px circle at ${spot.x}px ${spot.y}px, ${palette.accent}22, transparent 70%)`,
              }}
            />
          )}

          <div className="relative flex items-center gap-5">
            {/* Avatar + rank badge */}
            <div className="relative shrink-0">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-[15px] font-bold text-white shadow-md transition-transform duration-500 group-hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${palette.accent}, var(--color-primary))` }}
              >
                {initials || '?'}
              </div>
              <div
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-surface)] text-[10px] font-black text-white shadow"
                style={{ background: palette.accent }}
              >
                {c.rank}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                {name}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--color-text-muted)]">
                {c.city && <MapPin className="h-3 w-3 shrink-0" />}
                {[c.city, c.country].filter(Boolean).join(', ') || '—'}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-5 sm:flex">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2.5">
                  <MedalCount color={MEDAL_COLORS.gold} value={c.gold} />
                  <MedalCount color={MEDAL_COLORS.silver} value={c.silver} />
                  <MedalCount color={MEDAL_COLORS.bronze} value={c.bronze} />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('clubsHomeMedals')}
                </p>
              </div>
              <div className="h-8 w-px bg-[var(--color-border)]" />
              <div className="text-center">
                <p className="text-[20px] font-bold tabular-nums leading-none text-[var(--color-text-muted)]">{c.athletes}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('clubsHomeAthletes')}
                </p>
              </div>
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-primary)]" />
          </div>

          {/* Mobile */}
          <div className="relative mt-3.5 flex items-center gap-3 sm:hidden">
            <div className="flex items-center gap-2.5 rounded-full bg-[var(--color-surface-alt)] px-3 py-1">
              <MedalCount color={MEDAL_COLORS.gold} value={c.gold} />
              <MedalCount color={MEDAL_COLORS.silver} value={c.silver} />
              <MedalCount color={MEDAL_COLORS.bronze} value={c.bronze} />
            </div>
            <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
              {c.athletes} {tPublic('clubsHomeAthletes')}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

/* ─── news carousel ───────────────────────────────────────────────────────── */

function NewsCarousel({ rows, locale }: { rows: PublicNewsRow[]; locale: string }) {
  const tPublic = useTranslations('public');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-news-card]');
    const step = card ? card.offsetWidth + 16 : 320;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0"
      >
        {rows.map((n, idx) => {
          const dateStr = (n.publishedAt ?? n.createdAt).slice(0, 10);
          return (
            <motion.div
              key={n.id}
              data-news-card
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: idx * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-[300px] shrink-0 snap-start sm:w-[340px]"
            >
              <Link href={`/${locale}/news/${n.slug}`} className="block h-full">
                <motion.div
                  whileHover={{ y: -6 }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-primary)]/40"
                  style={{ borderTopColor: 'var(--color-primary)', borderTopWidth: '2px' }}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.1]" />

                  <div className="relative mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-transform duration-500 group-hover:rotate-[6deg] group-hover:scale-110">
                      <Newspaper className="h-4 w-4" strokeWidth={1.8} />
                    </div>
                    <span className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-[10px] font-bold tracking-wide text-[var(--color-text-muted)]">
                      {dateStr}
                    </span>
                  </div>

                  <h3 className="relative mb-3 line-clamp-3 text-[16px] font-bold leading-snug tracking-tight text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                    {n.title}
                  </h3>

                  {n.event && (
                    <p className="relative mt-auto truncate text-[12px] text-[var(--color-text-muted)]">
                      {n.event.name}
                    </p>
                  )}

                  <div className="relative mt-4 flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)] opacity-60 transition-all duration-300 group-hover:gap-2 group-hover:opacity-100">
                    <span>{tPublic('readMore')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── below-fold sections ─────────────────────────────────────────────────── */

export default function HomePageSections() {
  const tPublic = useTranslations('public');
  const locale = useLocale();

  const topAthletesQuery = useQuery({
    queryKey: ['public', 'top-athletes'],
    queryFn: () => apiGet<TopAthlete[]>('/api/public/athletes/top'),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const topClubsQuery = useQuery({
    queryKey: ['public', 'top-clubs'],
    queryFn: () => apiGet<TopClub[]>('/api/public/clubs/top'),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const newsQuery = useQuery({
    queryKey: ['public', 'news'],
    queryFn: () => apiGet<PublicNewsRow[]>('/api/public/news'),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const newsRows = newsQuery.data ?? [];

  return (
    <>
      {/* ── TOP 5 ATHLETES ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          eyebrow={tPublic('topAthletesEyebrow')}
          icon={Sparkles}
          title={tPublic('topAthletesTitle')}
          subtitle={tPublic('topAthletesSubtitle')}
        />

        <div className="space-y-3">
          {topAthletesQuery.isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[90px] animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              />
            ))}

          {!topAthletesQuery.isLoading && (topAthletesQuery.data?.length ?? 0) === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-7 text-center"
            >
              <Trophy className="h-6 w-6 shrink-0 text-[var(--color-text-muted)] opacity-50" strokeWidth={1.4} />
              <p className="max-w-[420px] text-[13px] text-[var(--color-text-muted)]">
                {tPublic('topAthletesEmpty')}
              </p>
            </motion.div>
          )}

          {topAthletesQuery.data?.map((a, idx) => (
            <TopAthleteRow key={a.id} a={a} idx={idx} locale={locale} />
          ))}
        </div>
      </section>

      {/* ── TOP 5 CLUBS ─────────────────────────────────────────── */}
      <section>
        <SectionHeader
          eyebrow={tPublic('clubsEyebrow')}
          icon={Users}
          title={tPublic('clubsHomeTitle')}
          subtitle={tPublic('clubsHomeSubtitle')}
        />

        <div className="space-y-3">
          {topClubsQuery.isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[90px] animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              />
            ))}

          {topClubsQuery.data?.map((c, idx) => (
            <TopClubRow key={c.id} c={c} idx={idx} locale={locale} />
          ))}
        </div>

        {(topClubsQuery.data?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 flex justify-center"
          >
            <Link href={`/${locale}/clubs`}>
              <span className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:gap-2.5">
                {tPublic('clubsHomeViewAll')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        )}
      </section>

      {/* ── LATEST NEWS (hidden entirely when there is nothing to show) ── */}
      {newsRows.length > 0 && (
        <section>
          <SectionHeader
            eyebrow={tPublic('newsEyebrow')}
            icon={Newspaper}
            title={tPublic('newsHomeTitle')}
            subtitle={tPublic('newsHomeSubtitle')}
          />
          <NewsCarousel rows={newsRows} locale={locale} />
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-4 flex justify-center"
          >
            <Link href={`/${locale}/news`}>
              <span className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:gap-2.5">
                {tPublic('newsHomeViewAll')}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        </section>
      )}
    </>
  );
}
