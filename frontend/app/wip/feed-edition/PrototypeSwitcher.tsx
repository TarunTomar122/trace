"use client";

/**
 * PROTOTYPE — floating state toggles. Hidden in production builds.
 * ?tier=free|pro   → evaluate the paywall without a second account
 * ?img=off         → hide imagery while comparing the text-only treatment
 */

import React, { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function PrototypeToggles({
  tier,
  img,
  isPro,
}: {
  tier?: string;
  img?: string;
  isPro: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useMemo(
    () => (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  if (process.env.NODE_ENV === 'production') return null;

  const effectiveTier = tier ?? (isPro ? 'pro' : 'free');
  const imagesOn = img !== 'off';

  return (
    <div className="fixed bottom-5 left-1/2 z-[9999] -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full bg-[#16150f] px-2.5 py-1.5 shadow-[0_10px_36px_rgba(0,0,0,0.38)] ring-1 ring-white/10">
        <span className="px-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f6a5c]">
          tier
        </span>
        {(['free', 'pro'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setParam('tier', t)}
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              effectiveTier === t
                ? 'bg-[#2557d6] text-white'
                : 'text-[#a8a294] hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}

        <span className="mx-1.5 h-4 w-px bg-white/15" />

        <span className="px-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f6a5c]">
          img
        </span>
        <button
          onClick={() => setParam('img', imagesOn ? 'off' : null)}
          className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            imagesOn ? 'bg-[#2557d6] text-white' : 'text-[#a8a294] hover:text-white'
          }`}
        >
          {imagesOn ? 'on' : 'off'}
        </button>
      </div>
    </div>
  );
}
