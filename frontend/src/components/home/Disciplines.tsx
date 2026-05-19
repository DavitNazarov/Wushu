'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from 'framer-motion';

type Panel = {
  index: number;
  img: string;
  alt: string;
  tag: string;
  name: string;
  desc: string;
};

/* ─── one cinematic discipline: small centered card → full-bleed reveal ───── */

function CinematicPanel({ index, img, alt, tag, name, desc }: Panel) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  // Spring smooths a fast scroll flick into a controlled grow instead of a snap.
  const smooth = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 26,
    mass: 0.5,
    restDelta: 0.0004,
  });

  // tiny centered frame grows to fill the viewport, then holds for the dwell
  const scale = useTransform(smooth, [0, 0.5], [0.46, 1], { clamp: true });
  const radius = useTransform(smooth, [0, 0.5], [40, 0], { clamp: true });
  // gentle counter-zoom so the photo settles as the frame opens (ken-burns)
  const imgScale = useTransform(smooth, [0, 0.5, 1], [1.28, 1.08, 1], {
    clamp: true,
  });
  // scrim + caption only once the frame is near full size
  const scrim = useTransform(smooth, [0.4, 0.62], [0, 1], { clamp: true });
  const textY = useTransform(smooth, [0.46, 0.74], [48, 0], { clamp: true });
  const textOpacity = useTransform(smooth, [0.46, 0.68], [0, 1], {
    clamp: true,
  });

  const Caption = (
    <>
      <span className="text-[12px] font-bold uppercase tracking-[0.36em] text-[var(--color-primary)]">
        {String(index + 1).padStart(2, '0')} · {tag}
      </span>
      <h3 className="mt-4 text-[clamp(3rem,11vw,9rem)] font-black leading-[0.9] tracking-tight text-white">
        {name}
      </h3>
      <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-white/85 sm:text-[19px]">
        {desc}
      </p>
    </>
  );

  if (reduce) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 md:px-6">
        <div className="relative overflow-hidden rounded-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={alt}
            className="h-[72svh] w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 40%, transparent 78%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1280px] px-7 pb-12 sm:px-12">
            {Caption}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden px-4">
        <motion.div
          style={{ scale, borderRadius: radius }}
          className="relative h-[100svh] w-full overflow-hidden bg-[var(--color-surface)] [will-change:transform]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={img}
            alt={alt}
            style={{ scale: imgScale }}
            className="absolute inset-0 h-full w-full object-cover [will-change:transform]"
            loading="lazy"
            decoding="async"
          />
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{
              opacity: scrim,
              background:
                'linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.45) 38%, rgba(0,0,0,0.12) 70%, transparent 100%)',
            }}
          />
          <motion.div
            style={{ y: textY, opacity: textOpacity }}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[1280px] px-6 pb-[12vh] sm:px-12"
          >
            {Caption}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export function Disciplines() {
  const tPublic = useTranslations('public');

  const panels: Omit<Panel, 'index'>[] = [
    {
      img: '/images/discipline-taolu.jpg',
      alt: tPublic('disciplineTaoluName'),
      tag: tPublic('disciplineTaoluTag'),
      name: tPublic('disciplineTaoluName'),
      desc: tPublic('disciplineTaoluDesc'),
    },
    {
      img: '/images/discipline-sanda.jpg',
      alt: tPublic('disciplineSandaName'),
      tag: tPublic('disciplineSandaTag'),
      name: tPublic('disciplineSandaName'),
      desc: tPublic('disciplineSandaDesc'),
    },
  ];

  return (
    <section className="relative">
      <div className="mx-auto max-w-[1280px] px-4 pb-10 pt-28 md:px-6 md:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[640px]"
        >
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.34em] text-[var(--color-primary)]">
            {tPublic('disciplinesEyebrow')}
          </p>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-tight text-[var(--color-text)]">
            {tPublic('disciplinesTitle')}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-text-muted)] sm:text-[16px]">
            {tPublic('disciplinesSubtitle')}
          </p>
        </motion.div>
      </div>

      {panels.map((p, i) => (
        <CinematicPanel key={p.name} index={i} {...p} />
      ))}
    </section>
  );
}
