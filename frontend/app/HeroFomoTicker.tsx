"use client";

import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { HeroHeadline } from '@/lib/hero-headlines';

const FALLBACK_HEADLINES: HeroHeadline[] = [
  { text: 'Something big happened in AI today.', company: '', domain: '' },
  { text: 'A major tech company made a surprise move.', company: '', domain: '' },
  { text: 'A new tool launched that engineers are talking about.', company: '', domain: '' },
];

const HOLD_MS = 2400;
const FADE_MS = 450;

export default function HeroFomoTicker({
  initialHeadlines = [],
  onCtaClick,
}: {
  initialHeadlines?: HeroHeadline[];
  onCtaClick?: () => void;
}) {
  const [headlines] = useState<HeroHeadline[]>(
    initialHeadlines.length > 0 ? initialHeadlines : FALLBACK_HEADLINES
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (!ready || headlines.length === 0) return;
    const hold = setTimeout(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setActiveIndex((i) => (i + 1) % headlines.length);
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(swap);
    }, HOLD_MS);
    return () => clearTimeout(hold);
  }, [ready, activeIndex, headlines]);

  if (!ready) {
    return (
      <div className="flex flex-col items-center gap-5" style={{ minHeight: '20rem' }}>
        <div className="h-3 w-32 rounded-full bg-foreground/8 animate-pulse" />
        <div className="h-14 w-3/4 rounded-xl bg-foreground/8 animate-pulse" />
        <div className="mt-8 h-12 w-44 rounded-full bg-foreground/8 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-secondary/40">
        Did you know...
      </p>

      {/* Fixed-height headline slot */}
      <div className="relative mt-8 flex min-h-[8rem] items-center justify-center sm:min-h-[7rem]">
        {headlines[activeIndex] && (
          <p
            className="text-[1.75rem] font-bold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[2.5rem] lg:text-[3rem] max-w-3xl"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(10px)',
              transition: `opacity ${FADE_MS}ms cubic-bezier(0.22,1,0.36,1), transform ${FADE_MS}ms cubic-bezier(0.22,1,0.36,1)`,
            }}
          >
            {headlines[activeIndex].text}
          </p>
        )}
      </div>

      {/* Dots */}
      <div className="mt-4 flex items-center gap-2">
        {headlines.map((_, i) => (
          <span
            key={i}
            className="block rounded-full transition-all duration-300"
            style={{
              width: i === activeIndex ? '20px' : '6px',
              height: '6px',
              background: i === activeIndex ? 'rgb(21,21,21)' : 'rgba(21,21,21,0.15)',
            }}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <p className="text-[2rem] font-bold tracking-[-0.03em] text-foreground/20 sm:text-[2.5rem]">
          You didn&apos;t.
        </p>
        <button
          onClick={onCtaClick}
          className="group inline-flex items-center gap-2.5 rounded-full bg-[#151515] px-8 py-4 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-black hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]"
        >
          Now you will
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
        </button>
        <p className="text-[12px] text-secondary/45">Free to read · No credit card</p>
      </div>
    </div>
  );
}
