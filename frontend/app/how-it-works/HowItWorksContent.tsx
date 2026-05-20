"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Newspaper,
  GitMerge,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

const STEPS = [
  {
    num: 1,
    icon: Newspaper,
    title: "Sources",
    body: "Trace scans 50+ news sites, communities, and platforms — including TechCrunch, Hacker News, Reddit, Product Hunt, GitHub, and Twitter/X — so you don't have to open each one separately.",
  },
  {
    num: 2,
    icon: GitMerge,
    title: "Grouping",
    body: "Identical stories across sources get collapsed into one item. No more reading the same OpenAI launch on five different sites. One story, one brief, links to all the original coverage.",
  },
  {
    num: 3,
    icon: Sparkles,
    title: "AI Summaries",
    body: "Each story group gets a short brief, key takeaways, and a timeline — so you get the full picture in seconds. Deep dive links are there if you want more, but you won't need them most days.",
  },
  {
    num: 4,
    icon: TrendingUp,
    title: "Signal Boost",
    body: "Community discussions, hot takes, and trending topics get ranked by engagement and relevance — not clickbait. See what people are actually saying and which takes have substance.",
  },
  {
    num: 5,
    icon: Zap,
    title: "Your Daily Pulse",
    body: "Everything lands in one scannable feed. Under 10 minutes, linked to sources, with nothing you don't need. One tab, one brief, and you're caught up for the day.",
  },
];

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function HowItWorksContent() {
  return (
    <div className="mx-auto max-w-3xl pb-20">
      <div className="relative">
        {STEPS.map((step, i) => (
          <Reveal key={step.num} delay={i * 120}>
            <div className="relative flex gap-6 pb-12 last:pb-0">
              {i < STEPS.length - 1 && (
                <div className="absolute left-[27px] top-14 bottom-0 w-px bg-[#e5e7eb]" />
              )}

              <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
                <step.icon size={22} />
              </div>

              <div className="flex-1 landing-card p-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">
                    Step {step.num}
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight text-[#111827]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                  {step.body}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={600}>
        <div className="mt-12 rounded-[1.5rem] bg-[#111827] p-8 text-white text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Ready to see it in action?
          </h2>
          <p className="mt-3 text-white/60 max-w-md mx-auto">
            The best way to understand Trace is to try it. Read today&apos;s
            brief and see how much you catch in 10 minutes.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-[#2563eb] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
            style={{ boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)" }}
          >
            Read today&apos;s brief →
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
