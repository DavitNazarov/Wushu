'use client';

import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/Header';
import { ScrollProgress } from '@/components/home/ScrollProgress';
import { CinematicHero } from '@/components/home/CinematicHero';
import { ScrollStory } from '@/components/home/ScrollStory';
import { StatsBand } from '@/components/home/StatsBand';
import { HorizontalEvents } from '@/components/home/HorizontalEvents';

/*
 * NOTE: this page intentionally does NOT use <PublicLayout>. It renders
 * <Header /> directly so the hero/story/events sections can go full-bleed.
 * If shared public-layout behaviour is added later (providers, skip links,
 * etc.), mirror it here too.
 *
 * Eager: above-the-fold + the pinned sections whose scroll math must not be
 * disturbed by lazy mount timing (ScrollStory, HorizontalEvents). The lighter
 * static sections below are code-split.
 */
const Disciplines = dynamic(() =>
  import('@/components/home/Disciplines').then((m) => m.Disciplines),
);
const KineticMarquee = dynamic(() =>
  import('@/components/home/KineticMarquee').then((m) => m.KineticMarquee),
);
const FinalCTA = dynamic(() =>
  import('@/components/home/FinalCTA').then((m) => m.FinalCTA),
);

const HomePageSections = dynamic(() => import('./HomePageSections'), {
  ssr: false,
  loading: () => (
    <div className="space-y-24">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        />
      ))}
    </div>
  ),
});

export default function PublicHomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <ScrollProgress />

      <main>
        <CinematicHero />
        <ScrollStory />
        <StatsBand />
        <HorizontalEvents />

        <div className="mx-auto max-w-[1200px] px-4 py-24 md:px-6 md:py-32">
          <div className="space-y-28">
            <HomePageSections />
          </div>
        </div>

        <Disciplines />

        <KineticMarquee />
        <FinalCTA />
      </main>
    </div>
  );
}
