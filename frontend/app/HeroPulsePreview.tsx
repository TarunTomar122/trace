"use client";

import React, { useState } from 'react';
import { ExternalLink, Flame } from 'lucide-react';

function HeroDemoFeedToggle({
  view,
  onChange,
}: {
  view: 'pulse' | 'briefing';
  onChange: (view: 'pulse' | 'briefing') => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/6 p-1">
      {([
        { key: 'briefing' as const, label: 'News' },
        { key: 'pulse' as const, label: 'Pulse' },
      ] as const).map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-3.5 sm:text-[12px] ${
            view === item.key
              ? 'bg-foreground text-background'
              : 'text-secondary/70 hover:text-foreground'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function HeroPulsePreview() {
  const [demoView, setDemoView] = useState<'pulse' | 'briefing'>('briefing');
  const [newsPick, setNewsPick] = useState(0);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const newsStories = [
    {
      title: 'Google turns Maps into an AI navigation product',
      preview:
        'Gemini answers, immersive route views, and richer driver context — a shift toward conversational navigation.',
      category: 'AI & Machine Learning',
      meta: '42m ago · 5 sources',
      keyTakeaways: [
        'Gemini is woven into turn-by-turn guidance so drivers can ask plain-language questions without leaving navigation.',
        'Immersive previews and lane-level detail are pitched as reducing wrong exits in complex interchanges.',
        'Google is framing Maps as an "AI surface" alongside Search and Workspace, not just a utility.',
      ],
      timeline: [
        {
          when: 'Mon 6:12 AM',
          source: 'Bloomberg',
          title: 'Google tests conversational prompts inside Maps beta',
          summary: 'Screenshots show a Gemini chip above the route card for a small Android cohort.',
        },
        {
          when: 'Mon 11:40 AM',
          source: 'Google Blog',
          title: 'Official walkthrough of AI navigation features',
          summary: 'Emphasis on eyes-free Q&A and summarizing reviews for busy corridors.',
        },
        {
          when: 'Tue 3:05 PM',
          source: 'The Verge',
          title: 'Competitors race to match on-device routing assistants',
          summary: 'Analysts note regulatory scrutiny on location data used for model tuning.',
        },
      ],
    },
    {
      title: 'Meta confirms major workforce reduction',
      preview:
        'The company is restructuring teams while doubling down on AI infrastructure and core products.',
      category: 'Big Tech',
      meta: '3h ago · 3 sources',
      keyTakeaways: [
        'Cuts are concentrated in middle management and duplicated product roles, per internal talking points.',
        'CapEx guidance still points upward for GPUs and data-center leases through next year.',
        'Reality Labs spending is being re-phased; wearables remain a public priority.',
      ],
      timeline: [
        {
          when: 'Tue 9:00 AM',
          source: 'WSJ',
          title: 'Meta prepares another round of layoffs',
          summary: 'Sources cite a focus on "flattening" org charts after rapid hiring in 2021–22.',
        },
        {
          when: 'Tue 11:22 AM',
          source: 'Meta',
          title: 'Internal memo outlines restructuring timeline',
          summary: 'Affected employees to hear by end of week; severance similar to prior rounds.',
        },
        {
          when: 'Tue 2:48 PM',
          source: 'FT',
          title: 'Investors weigh efficiency vs. metaverse burn rate',
          summary: 'Shares move on commentary that AI ads could offset slower Reality Labs revenue.',
        },
      ],
    },
    {
      title: 'Anthropic ships a sharper Claude for long documents',
      preview:
        'Better reasoning on dense PDFs and spreadsheets, with clearer citations for enterprise workflows.',
      category: 'AI & Machine Learning',
      meta: 'Yesterday · 6 sources',
      keyTakeaways: [
        'Long-context performance is tuned for contracts, security reviews, and financial filings.',
        'Inline citations link back to page regions so teams can audit answers quickly.',
        'Pricing tiers nudge enterprises toward annual commits with higher rate limits.',
      ],
      timeline: [
        {
          when: 'Sun 4:10 PM',
          source: 'Anthropic',
          title: 'Release notes: document QA and spreadsheet tools',
          summary: 'Highlights lower hallucination rate on tabular extracts in internal benchmarks.',
        },
        {
          when: 'Mon 8:30 AM',
          source: 'TechCrunch',
          title: 'Enterprises trial Claude on due-diligence workflows',
          summary: 'Legal teams cite citation trails as the feature that passed procurement.',
        },
        {
          when: 'Mon 6:15 PM',
          source: 'Ars Technica',
          title: 'Benchmark drama: vendors dispute methodology',
          summary: 'Anthropic argues rivals omit long-doc suites their customers actually run.',
        },
      ],
    },
  ];

  const hotTweets = [
    {
      title: '"We replaced our entire RAG pipeline with a single long-context call — accuracy jumped from 72% to 94%"',
      description: 'Team at a legal-tech startup shares benchmarks after switching from chunked retrieval to long-context prompting. Cost went up 3x but error rate on contract review dropped dramatically.',
      time: '2h ago',
      url: '#',
    },
    {
      title: 'The mass exodus from X to Bluesky is real — 30M users and the vibe has shifted',
      description: "It's less about features and more about who is already there. Engineers, journalists, and academics are rebuilding their networks from scratch.",
      time: '5h ago',
      url: '#',
    },
    {
      title: 'Stop calling everything an "AI agent" — a rant that turned into an actual taxonomy',
      description: "If it's just a prompt chain with a for loop it's not an agent. Thread proposes a 4-level classification that's gaining traction in ML circles.",
      time: '8h ago',
      url: '#',
    },
    {
      title: 'Why senior devs are leaving FAANG for 4-person startups — a thread of exit stories',
      description: 'Compensation is still high but the work feels like maintaining someone else\'s legacy. "I went from shipping zero to shipping every day."',
      time: '12h ago',
      url: '#',
    },
  ];

  const buildItems = [
    {
      title: 'Unkey — API key management',
      preview: 'Open-source rate limiting and key auth for serverless APIs.',
      src: 'Product Hunt',
      signals: '342 upvotes',
      emoji: '🔑',
    },
    {
      title: 'sqlite-vec',
      preview: 'Vector search extension for SQLite — no external DB needed.',
      src: 'GitHub Trending',
      signals: '1.2k stars today',
      emoji: '📦',
    },
    {
      title: 'Dub.co link analytics',
      preview: 'Open-source link management with built-in conversion tracking.',
      src: 'Product Hunt',
      signals: '218 upvotes',
      emoji: '🔗',
    },
    {
      title: 'Trigger.dev v3',
      preview: 'Background jobs for TypeScript with long-running task support.',
      src: 'Show HN',
      signals: '187 points',
      emoji: '⚡',
    },
  ];

  const discussionItems = [
    {
      title: '"We replaced our entire RAG pipeline with a single long-context call"',
      preview: 'Cost went up 3x but accuracy jumped from 72% to 94% — team argues it was worth it for legal docs.',
      src: 'r/LocalLLaMA',
      signals: '847 points',
    },
    {
      title: 'The mass exodus from X to Bluesky is real now',
      preview: 'Bluesky crossed 30M users. The shift is less about features and more about who is already there.',
      src: 'Hacker News',
      signals: '423 points',
    },
    {
      title: 'Stop calling everything an "AI agent"',
      preview: 'If it\'s just a prompt chain with a for loop, it\'s not an agent. A rant that turned into a real taxonomy.',
      src: 'r/ExperiencedDevs',
      signals: '612 points',
    },
    {
      title: 'Why senior devs are mass-quitting FAANG for 4-person startups',
      preview: 'Compensation is still high but the work feels like maintaining someone else\'s legacy. Thread of exit stories.',
      src: 'Hacker News',
      signals: '389 points',
    },
  ];

  const preventNav = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="relative overflow-x-clip">
      <div className="relative z-10 overflow-hidden rounded-2xl border border-border/15 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-black/4">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/15 px-4 py-3 sm:px-5">
          <p className="text-[10px] font-semibold text-secondary/45 uppercase tracking-[0.18em]">{todayLabel}</p>
          <HeroDemoFeedToggle view={demoView} onChange={setDemoView} />
        </div>

        <div className="h-[min(28rem,75vh)]">
          {demoView === 'pulse' ? (
            <div className="h-full overflow-y-auto overscroll-contain">
              {/* Hot Tweets section */}
              <div className="px-4 pt-5 pb-3 sm:px-5 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Flame size={14} className="text-orange-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700/70">
                    Hot Tweets
                  </span>
                  <div className="flex-1 h-px bg-border/20" />
                </div>
                <div className="space-y-0">
                  {hotTweets.map((tweet) => (
                    <a
                      key={tweet.title}
                      href={tweet.url}
                      onClick={preventNav}
                      className="block py-3 rounded-lg hover:bg-foreground/[0.03] transition-colors border-b border-border/10 last:border-b-0"
                    >
                      <p className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] line-clamp-2">
                        {tweet.title}
                      </p>
                      <p className="text-[11px] text-secondary/60 leading-relaxed mt-1 line-clamp-2">
                        {tweet.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] text-secondary/50">{tweet.time}</span>
                        <span className="text-secondary/25 text-[10px]">·</span>
                        <span className="text-[10px] font-medium text-[#1d9bf0]">View on X</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* What People Are Saying */}
              <div className="px-4 pt-2 pb-4 sm:px-5">
                <p className="mb-3 text-[10px] font-semibold text-foreground/50 uppercase tracking-[0.2em]">
                  What People Are Saying
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {discussionItems.map((row) => (
                    <a
                      key={row.title}
                      href="#"
                      onClick={preventNav}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/20 bg-white p-3 transition-all hover:border-border/40 hover:shadow-sm"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">{row.src}</span>
                        <span className="text-foreground/20">·</span>
                        <span className="text-[9px] text-secondary/60">{row.signals}</span>
                      </div>
                      <p className="mb-1.5 text-[12px] font-semibold text-foreground leading-snug decoration-foreground/30 underline-offset-2 group-hover:underline">
                        {row.title}
                      </p>
                      <p className="mb-2 line-clamp-3 text-[11px] text-secondary/65 leading-relaxed">{row.preview}</p>
                      <div className="mt-auto flex items-center justify-end gap-1 border-t border-border/10 pt-2 text-[10px] font-semibold text-secondary/55 transition-colors group-hover:text-foreground/75">
                        <span>Open thread</span>
                        <ExternalLink size={10} className="shrink-0 text-secondary/45 group-hover:text-foreground/60" aria-hidden />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* What People Are Building */}
              <div className="px-4 pt-1 pb-5 sm:px-5">
                <p className="mb-3 text-[10px] font-semibold text-foreground/50 uppercase tracking-[0.2em]">
                  What People Are Building
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {buildItems.map((row) => (
                    <a
                      key={row.title}
                      href="#"
                      onClick={preventNav}
                      className="group flex gap-2.5 rounded-xl border border-border/20 bg-white p-3 transition-all hover:border-border/40 hover:shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f7f3eb] text-[16px]">
                        {row.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="line-clamp-1 text-[12px] font-semibold text-foreground leading-snug decoration-foreground/30 underline-offset-2 group-hover:underline">
                            {row.title}
                          </p>
                          <ExternalLink size={10} className="mt-0.5 shrink-0 text-secondary/30 transition-colors group-hover:text-secondary/60" aria-hidden />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-secondary/60 leading-snug">{row.preview}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-semibold text-foreground/40 uppercase tracking-wide">{row.src}</span>
                          <span className="text-foreground/20">·</span>
                          <span className="text-[9px] text-secondary/60">{row.signals}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-row">
              {/* Story list — full width on mobile, sidebar on sm+ */}
              <div className="flex min-h-0 w-full flex-col sm:w-[36%] sm:flex-none sm:border-r sm:border-border/15">
                <div className="shrink-0 border-b border-border/15 px-4 py-3 sm:px-3.5">
                  <p className="text-[12px] font-bold text-foreground">News</p>
                  <p className="mt-0.5 text-[10px] text-secondary/55">Today · {newsStories.length} stories</p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {(['For You', 'AI', 'Suggested'] as const).map((pill, i) => (
                      <span
                        key={pill}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                          i === 0 ? 'bg-foreground text-background' : 'bg-foreground/8 text-secondary/70'
                        }`}
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="min-h-0 overflow-y-auto p-2.5">
                  <div className="space-y-2">
                    {newsStories.map((story, idx) => (
                      <button
                        key={story.title}
                        type="button"
                        onClick={() => setNewsPick(idx)}
                        className={`w-full rounded-xl border p-3 text-left transition-all ${
                          idx === newsPick
                            ? 'border-foreground/20 bg-foreground/[0.03] shadow-sm'
                            : 'border-border/15 bg-white hover:border-border/35 hover:bg-foreground/[0.02]'
                        }`}
                      >
                        <p className="text-[13px] font-semibold text-foreground leading-snug">{story.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-secondary/65 leading-relaxed">{story.preview}</p>
                        <p className="mt-2 text-[10px] font-medium text-secondary/45">{story.meta}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detail panel — hidden on mobile, shown on sm+ */}
              <div className="hidden min-h-0 flex-1 overflow-y-auto bg-[#fbfaf7] px-5 py-5 sm:block sm:px-6">
                <div className="mx-auto max-w-xl">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/40">
                    <span>{newsStories[newsPick].category}</span>
                    <span className="text-foreground/20">·</span>
                    <span>{newsStories[newsPick].meta}</span>
                  </div>
                  <h3 className="text-[1.45rem] font-bold tracking-[-0.03em] text-foreground sm:text-[1.65rem]">
                    {newsStories[newsPick].title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-secondary">
                    {newsStories[newsPick].preview}
                  </p>

                  <div className="mt-6 rounded-2xl border border-border/15 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Key points</p>
                    <div className="mt-3 space-y-3">
                      {newsStories[newsPick].keyTakeaways.map((point) => (
                        <div key={point} className="flex items-start gap-2.5">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/35" />
                          <p className="text-[13px] leading-relaxed text-secondary/80">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-border/15 bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Timeline</p>
                    <div className="mt-3 space-y-3">
                      {newsStories[newsPick].timeline.map((event) => (
                        <div key={`${event.when}-${event.title}`} className="rounded-xl border border-border/10 bg-[#fcfcfb] p-3">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-secondary/45">
                            <span>{event.when}</span>
                            <span className="text-foreground/20">·</span>
                            <span className="font-semibold uppercase tracking-[0.14em]">{event.source}</span>
                          </div>
                          <p className="mt-1.5 text-[12px] font-semibold text-foreground">{event.title}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-secondary/70">{event.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#c7b8ff]/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-[#f5d6c6]/18 blur-3xl" />
    </div>
  );
}
