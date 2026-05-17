'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion';
import { UserPlus, Scale, GitBranch, Trophy } from 'lucide-react';

const ICONS = [UserPlus, Scale, GitBranch, Trophy];
const SPACING = 420; // px between steps in the vertical reel

/* ─── one step (icon + index + title move together) ──────────────────────── */

function StepPanel({
  index,
  count,
  pos,
  label,
}: {
  index: number;
  count: number;
  pos: MotionValue<number>;
  label: string;
}) {
  const Icon = ICONS[index] ?? Trophy;

  const y = useTransform(pos, (p) => (index - p) * SPACING);
  const opacity = useTransform(pos, (p) => {
    const d = Math.abs(p - index);
    return d >= 1 ? 0 : 1 - d * d * (3 - 2 * d); // smoothstep
  });
  const scale = useTransform(pos, (p) => {
    const d = Math.min(1, Math.abs(p - index));
    return 1 - d * 0.14;
  });
  const numOpacity = useTransform(pos, (p) => {
    const d = Math.abs(p - index);
    return d >= 1 ? 0 : 0.05 * (1 - d);
  });

  return (
    <motion.div
      style={{ y, opacity, scale }}
      className="absolute inset-0 flex items-center justify-center px-6"
    >
      <div className="relative flex flex-col items-center text-center">
        <motion.span
          aria-hidden
          style={{ opacity: numOpacity }}
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(11rem,32vw,26rem)] font-black leading-none tracking-tighter text-[var(--color-primary)]"
        >
          {String(index + 1).padStart(2, '0')}
        </motion.span>

        <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[0_18px_50px_-12px_var(--color-primary)]">
          <Icon className="h-9 w-9" strokeWidth={1.7} />
        </div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.34em] text-[var(--color-text-muted)]">
          {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </p>
        <h3 className="text-[clamp(2rem,5vw,3.75rem)] font-black leading-[1.05] tracking-tight text-[var(--color-text)]">
          {label}
        </h3>
      </div>
    </motion.div>
  );
}

/* ─── reduced-motion / static fallback ───────────────────────────────────── */

function StaticSteps({
  steps,
  title,
  eyebrow,
}: {
  steps: string[];
  title: string;
  eyebrow: string;
}) {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-24">
      <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-primary)]">
        {eyebrow}
      </p>
      <h2 className="mb-14 text-center text-[clamp(1.7rem,4vw,2.8rem)] font-black tracking-tight text-[var(--color-text)]">
        {title}
      </h2>
      <ol className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = ICONS[i] ?? Trophy;
          return (
            <li key={s} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]">
                <Icon className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="mt-1 text-[15px] font-bold text-[var(--color-text)]">
                {s}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ─── pinned scroll-scrubbed story ───────────────────────────────────────── */

export function ScrollStory() {
  const tPublic = useTranslations('public');
  const reduce = useReducedMotion();

  const steps = [
    tPublic('howItWorksStep1'),
    tPublic('howItWorksStep2'),
    tPublic('howItWorksStep3'),
    tPublic('howItWorksStep4'),
  ];
  const eyebrow = tPublic('howItWorksTitle');
  const title = tPublic('stepsTitle');

  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  // Soft spring acts as a rate limiter: a fast scroll flick is smoothed into a
  // controlled glide through the steps instead of snapping past them.
  const smooth = useSpring(scrollYProgress, {
    stiffness: 55,
    damping: 28,
    mass: 0.5,
    restDelta: 0.0004,
  });
  // Reach the last step at ~82% of the pinned track, then hold it there for the
  // remaining scroll so the final step gets a fully-pinned, readable dwell
  // (and the spring lag settles) BEFORE the section unpins.
  const pos = useTransform(smooth, [0.04, 0.7], [0, steps.length - 1], {
    clamp: true,
  });
  const railFill = useTransform(smooth, [0.04, 0.7], [0, 1], { clamp: true });

  if (reduce) {
    return <StaticSteps steps={steps} title={title} eyebrow={eyebrow} />;
  }

  return (
    <div ref={ref} className="relative h-[560vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* heading — fixed near top */}
        <div className="absolute inset-x-0 top-0 z-10 mx-auto max-w-[1100px] px-6 pt-[14vh] text-center">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.34em] text-[var(--color-primary)]">
            {eyebrow}
          </p>
          <h2 className="mx-auto max-w-[18ch] text-[clamp(1.3rem,3vw,2.1rem)] font-black tracking-tight text-[var(--color-text)]">
            {title}
          </h2>
        </div>

        {/* reel — vertically centered in the viewport */}
        <div className="absolute inset-0">
          {steps.map((s, i) => (
            <StepPanel
              key={s}
              index={i}
              count={steps.length}
              pos={pos}
              label={s}
            />
          ))}
        </div>

        {/* progress rail — fixed near bottom */}
        <div className="absolute inset-x-0 bottom-[7vh] z-10 mx-auto w-full max-w-[560px] px-6">
          <div className="relative h-px w-full bg-[var(--color-border)]">
            <motion.div
              className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--color-primary)]"
              style={{ scaleX: railFill }}
            />
            <div className="absolute -top-1.5 flex w-full justify-between">
              {steps.map((s, i) => (
                <RailNode key={s} index={i} pos={pos} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailNode({
  index,
  pos,
}: {
  index: number;
  pos: MotionValue<number>;
}) {
  const scale = useTransform(pos, (p) => {
    const d = Math.abs(p - index);
    return d >= 1 ? 1 : 1 + (1 - d) * 0.8;
  });
  const activeOpacity = useTransform(pos, (p) => (p >= index - 0.5 ? 1 : 0));

  return (
    <motion.span
      style={{ scale }}
      className="relative h-3 w-3 rounded-full bg-[var(--color-border)] ring-4 ring-[var(--color-bg)]"
    >
      <motion.span
        style={{ opacity: activeOpacity }}
        className="absolute inset-0 rounded-full bg-[var(--color-primary)]"
      />
    </motion.span>
  );
}
