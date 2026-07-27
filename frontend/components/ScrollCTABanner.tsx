"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export default function ScrollCTABanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const handleScroll = () => {
      const scrollPercent =
        window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setVisible(scrollPercent > 0.45);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dismissed]);

  if (dismissed || !visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-2xl px-4 pb-4">
        <div className="relative flex items-center gap-4 rounded-2xl border border-black/8 bg-white/95 backdrop-blur-xl px-5 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2.5 right-2.5 rounded-full p-1 text-secondary/40 hover:text-secondary transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-foreground leading-snug">
              Get the full daily pulse — stories, topics, and key takeaways
            </p>
            <p className="text-[12px] text-secondary/60 mt-0.5">
              Subscribe to Trace Pro. Cancel anytime.
            </p>
          </div>
          <Link
            href="/subscribe"
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-full bg-[#151515] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-black hover:shadow-lg"
          >
            Subscribe
          </Link>
        </div>
      </div>
    </div>
  );
}
