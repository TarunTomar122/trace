"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Play,
  Pause,
  Layers3,
  History,
  ChevronDown,
  ArrowUpRight,
  Podcast,
  Waves,
  Check,
  Mail,
  Menu,
  X,
  Headphones,
} from "lucide-react";

const SOURCES = [
  { label: "TechCrunch", logo: "https://www.google.com/s2/favicons?domain=techcrunch.com&sz=64" },
  { label: "The Verge", logo: "https://www.google.com/s2/favicons?domain=theverge.com&sz=64" },
  { label: "Hacker News", logo: "https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=64" },
  { label: "ArXiv", logo: "https://www.google.com/s2/favicons?domain=arxiv.org&sz=64" },
  { label: "Wired", logo: "https://www.google.com/s2/favicons?domain=wired.com&sz=64" },
  { label: "Bloomberg", logo: "https://www.google.com/s2/favicons?domain=bloomberg.com&sz=64" },
  { label: "Reuters", logo: "https://www.google.com/s2/favicons?domain=reuters.com&sz=64" },
  { label: "GitHub", logo: "https://www.google.com/s2/favicons?domain=github.com&sz=64" },
];

function FunnelAnimation() {
  return (
    <div className="relative mx-auto mt-10 w-full max-w-[980px] overflow-hidden rounded-[32px] border-[2px] border-[#131413] bg-white sm:rounded-[40px]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(to right, #131413 1px, transparent 1px), linear-gradient(to bottom, #131413 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="relative flex items-center justify-between border-b border-[#131413]/10 px-6 py-4 sm:px-7 sm:py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-2.5 rounded-full bg-[#ff8c2a] ring-1 ring-[#131413]" />
          <span className="font-figtree text-[13px] font-semibold tracking-[0.12em] uppercase text-[#131413]">Live at 06:58</span>
          <span className="hidden sm:inline font-figtree text-[13px] text-[#7a8178]">building today 07:00 edition</span>
        </div>
        <span className="rounded-full bg-[#131413] px-4 py-2 font-figtree text-[12px] font-semibold text-white">40 sources to 1 story</span>
      </div>

      <div className="relative flex h-[380px] items-stretch gap-3 p-6 sm:h-[400px] sm:gap-4 sm:p-7">
        <div className="relative flex w-[32%] max-w-[260px] shrink-0 flex-col justify-center gap-3 sm:w-[28%] sm:gap-3.5">
          {SOURCES.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.35 }} className="flex items-center gap-3 rounded-full border-[1.5px] border-[#131413] bg-white px-4 py-3.5 sm:px-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#131413]/10 overflow-hidden p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.logo} alt="" width={20} height={20} className="h-5 w-5 object-contain" loading="eager" referrerPolicy="no-referrer" />
              </span>
              <span className="truncate font-figtree text-[13.5px] font-medium leading-none text-[#131413]">{s.label}</span>
              <span className="ml-auto size-2 shrink-0 rounded-full bg-[#ff8c2a]" />
            </motion.div>
          ))}
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 360" preserveAspectRatio="none" aria-hidden>
            {SOURCES.map((_, i) => {
              const y0 = 30 + i * 43;
              return <path key={i} d={`M 0 ${y0} C 110 ${y0}, 140 ${182 + (i - 3.5) * 8}, 200 182`} fill="none" stroke="#e6ebe3" strokeWidth={1.2} strokeDasharray="5 6" strokeLinecap="round" />;
            })}
            <path d="M 200 182 C 260 182, 280 182, 400 182" fill="none" stroke="#131413" strokeWidth={1.2} opacity={0.12} />
          </svg>
          {SOURCES.map((_, i) => {
            const y0 = 30 + i * 43;
            return (
              <motion.div key={`dot-${i}`} className="pointer-events-none absolute left-[28%] size-2.5 rounded-full bg-[#ff8c2a] ring-2 ring-white sm:size-[11px] sm:ring-2" style={{ top: y0, marginTop: 9 }}
                animate={{ x: [0, 40, 92, 142], y: [0, (182 - y0) * 0.28, (182 - y0) * 0.72, 182 - y0], opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.7] }}
                transition={{ duration: 2.15, repeat: Infinity, delay: i * 0.22, ease: "easeInOut", repeatDelay: 0.6 }} />
            );
          })}
          <div className="relative z-10 flex w-[168px] flex-col items-center rounded-[28px] border-[2px] border-[#131413] bg-white px-6 py-7 sm:w-[184px] sm:px-6 sm:py-7">
            <div className="absolute inset-[10px] rounded-[20px] bg-[#f6f8f1] border border-[#e6ebe3]" />
            <div className="relative flex w-full flex-col items-center">
              <div className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 ring-1 ring-[#131413]/10">
                <span className="size-2 animate-pulse rounded-full bg-[#ddf08a] ring-1 ring-[#131413]/20" />
                <span className="font-figtree text-[11px] font-semibold tracking-[0.12em] uppercase text-[#131413]">Memory core</span>
              </div>
              <div className="mt-4 flex items-end gap-[3px]">
                {[10, 20, 14, 24, 11, 17, 9].map((h, idx) => (
                  <motion.div key={idx} className="w-[4px] rounded-full bg-[#131413]" style={{ height: h }} animate={{ scaleY: [0.6, 1, 0.7] }} transition={{ duration: 1.1, repeat: Infinity, delay: idx * 0.12 }} />
                ))}
              </div>
              <p className="mt-3 text-center font-figtree text-[12px] font-medium text-[#7a8178]">312 days stitched</p>
            </div>
          </div>
        </div>

        <div className="relative flex w-[32%] max-w-[260px] shrink-0 items-center justify-center sm:w-[30%]">
          <motion.div initial={{ opacity: 0, x: 10, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ delay: 0.6, duration: 0.5 }} className="relative w-full overflow-hidden rounded-[28px] border-[2px] border-[#131413] bg-[#ddf08a] sm:rounded-[28px]">
            <div className="flex items-center justify-between bg-[#131413] px-5 py-3.5">
              <span className="flex items-center gap-1.5 font-figtree text-[11px] font-semibold uppercase tracking-[0.07em] text-white"><Podcast size={13} className="text-[#ddf08a]" /> Today 07:00</span>
              <span className="rounded-full bg-white px-3 py-1 font-figtree text-[11px] font-bold text-[#131413]">12:34</span>
            </div>
            <div className="px-6 py-6">
              <div className="flex items-center gap-2.5 rounded-full border-[1.5px] border-[#131413] bg-white px-4 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#131413] text-white"><Play size={12} fill="currentColor" className="ml-0.5" /></span>
                <div className="flex flex-1 items-end gap-[2px]">
                  {[8, 16, 11, 22, 9, 15].map((h, i) => (
                    <motion.div key={i} className="flex-1 rounded-full bg-[#131413]" style={{ height: h }} animate={{ scaleY: [0.6, 1, 0.65] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }} />
                  ))}
                </div>
                <span className="font-figtree text-[11px] text-[#7a8178]">1x</span>
              </div>
              <p className="mt-5 font-figtree text-[15px] font-semibold leading-[1.35] text-[#131413]">Why that GPU deal needs March.</p>
              <p className="mt-2 font-figtree text-[13px] leading-[1.5] text-[#131413]/65">7 stories. 8 months context.</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 border-t border-[#131413]/10 bg-white px-6 py-4 sm:flex-row sm:justify-between sm:px-7">
        <p className="font-figtree text-[13px] font-medium text-[#7a8178]"><span className="font-semibold text-[#131413]">40+ sources</span> to one thread, daily 7am</p>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#131413]/10 bg-[#f6f8f1] px-3.5 py-1.5 font-figtree text-[12px] font-medium text-[#131413]"><span className="size-1.5 animate-pulse rounded-full bg-[#131413]" /> 312 days</span>
      </div>
    </div>
  );
}

function LimeUnderline({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-[1]">{children}</span>
      <svg aria-hidden viewBox="0 0 320 14" className="absolute bottom-[0.08em] left-0 z-0 h-[0.22em] w-full overflow-visible" preserveAspectRatio="none">
        <path d="M2 10 C 40 2, 80 14, 120 8 S 200 2, 240 9 S 290 12, 318 6" fill="none" stroke="#ddf08a" strokeWidth="8" strokeLinecap="round" opacity={1} />
      </svg>
    </span>
  );
}

function ForestBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f6f8f1] px-4 py-2.5 font-figtree text-[11px] font-semibold uppercase tracking-[0.06em] text-[#131413] ring-1 ring-[#131413]/8">
      <span className="size-1.5 animate-pulse rounded-full bg-[#ddf08a] ring-1 ring-[#131413]/15" />{children}
    </span>
  );
}

function Nav({ onJoin }: { onJoin: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-40 w-full bg-transparent">
      <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6 sm:py-5">
        <nav aria-label="Primary" className="flex items-center justify-between gap-3 rounded-full border-[2px] border-[#131413] bg-white px-3 py-2.5 sm:px-4">
          <a href="#" className="flex items-center gap-2.5 pl-1">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#131413] text-white sm:size-9"><Waves size={17} /></span>
            <span className="font-figtree text-[15px] font-bold tracking-[-0.02em] text-[#131413] sm:text-[16px]">Better Pod</span>
          </a>
          <div className="hidden items-center gap-1 lg:flex">
            {[
              ["How it works", "#how"],
              ["Listen", "#listen"],
              ["Pricing", "#pricing"],
            ].map(([label, href]) => (
              <a key={label} href={href} className="rounded-full px-4 py-2.5 font-figtree text-[14px] font-medium text-[#131413] hover:bg-[#131413]/5">{label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href="#listen" className="hidden sm:inline-flex items-center gap-2 rounded-full border-[2px] border-[#131413] bg-white px-4 py-2 font-figtree text-[14px] font-semibold text-[#131413] hover:bg-[#f6f6f3]"><Play size={14} fill="currentColor" /> Trailer</a>
            <button onClick={onJoin} className="inline-flex items-center gap-2 rounded-full border-[2px] border-[#131413] bg-[#ddf08a] px-5 py-2.5 font-figtree text-[14px] font-semibold text-[#131413] hover:bg-[#cbe86a]">Get access <ArrowRight size={16} /></button>
            <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-[#131413] bg-white lg:hidden">{open ? <X size={16} /> : <Menu size={16} />}</button>
          </div>
        </nav>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-3 overflow-hidden rounded-[20px] border-[2px] border-[#131413] bg-white lg:hidden">
              <div className="grid gap-1 p-2">
                {[["How it works", "#how"], ["Listen", "#listen"], ["Pricing", "#pricing"]].map(([label, href]) => (
                  <a key={label} href={href} onClick={() => setOpen(false)} className="rounded-full px-4 py-3 font-figtree text-[15px] font-medium text-[#131413] hover:bg-[#131413]/5">{label}</a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function BetterPodLanding() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(34);
  const waitlistRef = useRef<HTMLDivElement>(null);
  const scrollToWaitlist = () => waitlistRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress((p) => (p + 0.22 > 100 ? 0 : p + 0.22)), 80);
    return () => clearInterval(id);
  }, [playing]);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-[#131413] selection:bg-[#ddf08a] selection:text-[#131413]">
      <Nav onJoin={scrollToWaitlist} />

      {/* HERO — clean white */}
      <section className="relative overflow-hidden bg-[#fcfcf9]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_880px_320px_at_50%_-10%,#ddf08a_0%,transparent_60%)] opacity-[0.35]" />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8 lg:pt-28">
          <div className="mx-auto max-w-[860px] text-center">
            <h1 className="font-eb-garamond font-normal leading-[0.88] tracking-[-0.03em]" style={{ fontFamily: "var(--font-eb-garamond)", fontSize: "clamp(40px, 8.6vw, 88px)" }}>
              <span className="block text-[#9aa09c]">312 days of memory.</span>
              <span className="block text-[#131413]"><LimeUnderline>12 minutes</LimeUnderline> to catch up.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[520px] font-figtree text-[17px] leading-[1.6] text-[#131413]/65">
              40+ sources at 4am. One story at 7am.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={scrollToWaitlist} className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border-[2px] border-[#131413] bg-[#ddf08a] px-7 py-4 font-figtree text-[15px] font-semibold text-[#131413] hover:bg-[#cbe86a] sm:w-auto">
                Get access for $8 <ArrowRight size={16} />
              </button>
              <a href="#how" className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border-[2px] border-[#131413] bg-white px-7 py-4 font-figtree text-[15px] font-semibold text-[#131413] sm:w-auto">
                How it works
              </a>
            </div>
            <p className="mt-4 font-figtree text-[13px] font-medium text-[#9aa09c]">$8 per month. Cancel anytime.</p>
          </div>
          <div className="mt-10 sm:mt-12">
            <FunnelAnimation />
          </div>
        </div>
      </section>

      {/* CONTEXT TAX — light, no dark */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-[32px] border border-[#e6ebe3] bg-white px-7 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <ForestBadge>The context tax</ForestBadge>
              <h2 className="mt-6 max-w-[480px] text-pretty font-eb-garamond text-[32px] font-normal leading-[0.9] tracking-[-0.02em] text-[#131413] sm:text-[40px]" style={{ fontFamily: "var(--font-eb-garamond)" }}>
                Without memory, news is noise.
              </h2>
              <p className="mt-4 max-w-[460px] font-figtree text-[16px] leading-[1.6] text-[#5a5f5a]">
                You burn 45 min daily and still miss why.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[22px] border border-[#e6ebe3] bg-[#fcfcf9] px-6 py-7">
                <p className="font-figtree text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9aa09c]">Without Better Pod</p>
                <p className="mt-3 font-figtree text-[28px] font-bold tracking-[-0.02em] text-[#131413]">45 min</p>
                <p className="font-figtree text-[13px] text-[#9aa09c]">Tabs and anxiety</p>
              </div>
              <div className="rounded-[22px] border-[1.5px] border-[#131413] bg-[#ddf08a] px-6 py-7">
                <p className="font-figtree text-[11px] font-semibold uppercase tracking-[0.08em] text-[#131413]/60">With Better Pod</p>
                <p className="mt-3 font-figtree text-[28px] font-bold tracking-[-0.02em] text-[#131413]">12 min</p>
                <p className="font-figtree text-[13px] text-[#131413]/70">One story</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — white cards, generous padding */}
      <section id="how" className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="font-figtree text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa09c]">How it works</p>
          <h2 className="mx-auto mt-3 font-eb-garamond text-[32px] font-normal leading-[0.92] tracking-[-0.02em] text-[#131413] sm:text-[42px]" style={{ fontFamily: "var(--font-eb-garamond)" }}>
            Read. Remember. Tell.
          </h2>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {[
            { n: "01", icon: Layers3, title: "Read at 4am", body: "40+ sources grouped." },
            { n: "02", icon: History, title: "Remember", body: "Stitched to history." },
            { n: "03", icon: Headphones, title: "Tell at 7am", body: "12 min. 7 stories." },
          ].map((c) => (
            <article key={c.n} className="rounded-[28px] border-[1.5px] border-[#e6ebe3] bg-white p-8 sm:p-9">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-full border border-[#e6ebe3] bg-[#f6f8f1] text-[#131413]"><c.icon size={16} /></span>
                <span className="rounded-full bg-[#131413] px-3 py-1.5 font-figtree text-[11px] font-bold text-white">{c.n}</span>
              </div>
              <h3 className="mt-6 font-figtree text-[17px] font-semibold text-[#131413]">{c.title}</h3>
              <p className="mt-2 font-figtree text-[14px] leading-[1.6] text-[#7a8178]">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* LISTEN — light, no black card */}
      <section id="listen" className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-[#e6ebe3] bg-white px-7 py-8 sm:px-10 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#ddf08a] px-3.5 py-2 font-figtree text-[11px] font-semibold uppercase text-[#131413]"><Podcast size={13} /> Trailer 1:47</span>
              <h2 className="mt-4 font-eb-garamond text-[28px] font-normal leading-[0.92] tracking-[-0.02em] text-[#131413] sm:text-[34px]" style={{ fontFamily: "var(--font-eb-garamond)" }}>Hear one story.</h2>
              <p className="mt-2 font-figtree text-[14px] leading-[1.6] text-[#7a8178]">$8 per month. 7 stories daily.</p>
            </div>
            <div className="overflow-hidden rounded-[22px] border border-[#e6ebe3] bg-[#fcfcf9] p-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Pause" : "Play"} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#131413] text-white ring-1 ring-[#131413]">{playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" className="ml-0.5" />}</button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between"><span className="font-figtree text-[13px] font-semibold text-[#131413]">Trailer</span><span className="font-figtree text-[11px] tabular-nums text-[#9aa09c]">{playing ? `${Math.floor((progress / 100) * 107)}:${String(Math.floor(((progress / 100) * 107 * 60) % 60)).padStart(2, "0")}` : "0:00"} / 1:47</span></div>
                  <div className="relative mt-3 flex items-end gap-[3px]">{[7, 14, 10, 22, 8, 16, 12, 20].map((h, i) => { const filled = (i / 8) * 100 < progress; return <motion.div key={i} className="h-2.5 flex-1 rounded-full" style={{ height: h, background: filled ? "#131413" : "#e6ebe3" }} animate={playing && filled ? { scaleY: [0.7, 1] } : {}} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.05 }} />; })}</div>
                </div>
              </div>
              <div className="mt-5 rounded-[14px] bg-white border border-[#e6ebe3] px-4 py-3">
                <p className="font-figtree text-[13px] leading-[1.5] text-[#131413]">“If you saw the $40B headline, you missed the March memo.”</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING — light, centered */}
      <section id="pricing" ref={waitlistRef} className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-[#e6ebe3] bg-[#f6f8f1] px-7 py-10 sm:px-10 sm:py-12">
          <div className="mx-auto max-w-[860px] text-center">
            <h2 className="mx-auto font-eb-garamond text-[32px] font-normal leading-[0.92] tracking-[-0.02em] text-[#131413] sm:text-[38px]" style={{ fontFamily: "var(--font-eb-garamond)" }}>
              $8 per month. <span className="text-[#9aa09c]">Cancel anytime.</span>
            </h2>
            <p className="mx-auto mt-3 font-figtree text-[14px] leading-[1.6] text-[#7a8178]">7 day guarantee. Full access.</p>
            <div className="mx-auto mt-8 max-w-[480px] overflow-hidden rounded-[24px] border-[1.5px] border-[#131413] bg-white p-7 text-left">
              {!submitted ? (
                <>
                  <h3 className="font-figtree text-[17px] font-semibold text-[#131413]">Get access</h3>
                  <form onSubmit={onSubmit} className="mt-5">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa09c]" />
                        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-[52px] w-full rounded-[12px] border-[1.5px] border-[#e6ebe3] bg-white pl-10 pr-4 font-figtree text-[14px] font-medium text-[#131413] placeholder:text-[#9aa09c] focus:border-[#131413] focus:outline-none focus:ring-2 focus:ring-[#ddf08a]" />
                      </div>
                      <button type="submit" className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-[#131413] bg-[#ddf08a] px-7 font-figtree text-[14px] font-semibold text-[#131413] hover:bg-[#cbe86a]">Start <ArrowRight size={15} /></button>
                    </div>
                  </form>
                  <div className="mt-6 rounded-[16px] bg-[#f6f8f1] border border-[#e6ebe3] px-5 py-5">
                    <div className="flex items-baseline gap-1"><span className="font-figtree text-[24px] font-bold tracking-[-0.02em] text-[#131413]">$8</span><span className="font-figtree text-[13px] text-[#7a8178]">per month</span></div>
                    <ul className="mt-3 space-y-1.5 font-figtree text-[13px] leading-[1.5] text-[#5a5f5a]">
                      <li className="flex gap-2"><Check size={14} className="mt-0.5 text-[#131413]" /> Daily podcast and archive</li>
                      <li className="flex gap-2"><Check size={14} className="mt-0.5 text-[#131413]" /> 7 day guarantee</li>
                    </ul>
                  </div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-6 text-center">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#131413] text-white"><Check size={18} /></div>
                  <h3 className="mt-3 font-figtree text-[16px] font-semibold text-[#131413]">Check {email}</h3>
                  <p className="mt-1 font-figtree text-[13px] text-[#7a8178]">Access details sent.</p>
                  <button onClick={() => setSubmitted(false)} className="mt-4 rounded-full border border-[#e6ebe3] bg-white px-4 py-2 font-figtree text-[12px] font-medium text-[#131413]">Other email</button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — minimal */}
      <section className="mx-auto max-w-[680px] px-4 py-12 sm:px-6">
        <div className="divide-y divide-[#e6ebe3] border-y border-[#e6ebe3]">
          {[
            ["Not another newsletter?", "Sequels, not recaps."],
            ["Already follow 40 sources?", "We dedupe 127 into 7."],
          ].map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="font-figtree text-[14px] font-semibold text-[#131413]">{q}</span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#e6ebe3] bg-white group-open:bg-[#131413] group-open:text-white"><ChevronDown size={13} className="transition-transform group-open:rotate-180" /></span>
              </summary>
              <p className="pt-2 font-figtree text-[13px] leading-[1.6] text-[#7a8178]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#e6ebe3] bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <span className="flex items-center gap-2 font-figtree text-[13px] font-semibold text-[#131413]"><span className="flex size-7 items-center justify-center rounded-full bg-[#131413] text-white"><Waves size={13} /></span> Better Pod</span>
          <span className="font-figtree text-[11px] text-[#9aa09c]">© 2026 Better Pod Ltd.</span>
        </div>
      </footer>
    </div>
  );
}
