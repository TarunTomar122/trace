"use client";

import React, { useState } from 'react';
import { ExternalLink, Flame } from 'lucide-react';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.731-8.835L1.254 2.25H8.08l4.261 5.635 5.903-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function HeroDemoFeedToggle({
  view,
  onChange,
}: {
  view: 'pulse' | 'briefing';
  onChange: (view: 'pulse' | 'briefing') => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-6">
      {(['briefing', 'pulse'] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`relative pb-1.5 text-[13px] font-semibold transition-colors ${
            view === item
              ? 'text-[#111827]'
              : 'text-[#9ca3af] hover:text-[#374151]'
          }`}
        >
          {item === 'briefing' ? 'News' : 'Pulse'}
          {view === item && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-[#111827]" />
          )}
        </button>
      ))}
    </div>
  );
}

type DemoTweet = { id: string; title: string; description: string; time: string; url: string };
type DemoDiscussion = { id: string; title: string; preview: string; source: string; signals: string; url: string };
type DemoTool = { id: string; title: string; preview: string; source: string; signals: string; url: string };

function DemoPulseTab({
  hotTweets,
  discussions,
  tools,
  preventNav,
}: {
  hotTweets: DemoTweet[];
  discussions: DemoDiscussion[];
  tools: DemoTool[];
  preventNav: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-10 sm:flex-row">
          {/* Left: Hot on X */}
          {hotTweets.length > 0 && (
            <div className="min-w-0 flex-1">
              <div className="mb-5 flex items-center gap-2 border-b border-[#e5e7eb] pb-3">
                <Flame size={14} className="text-orange-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600/70">
                  Hot on X
                </span>
              </div>
              <div className="space-y-0">
                {hotTweets.map((tweet) => (
                  <a
                    key={tweet.id}
                    href={tweet.url}
                    onClick={preventNav}
                    className="group flex gap-3.5 border-b border-[#f3f4f6] py-4 transition-colors last:border-b-0"
                  >
                    <XIcon className="mt-[3px] h-[14px] w-[14px] shrink-0 text-[#d1d5db] transition-colors group-hover:text-[#1d9bf0]" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#111827]">
                        {tweet.title}
                      </p>
                      {tweet.description && (
                        <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[#6b7280]">
                          {tweet.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-[#9ca3af]">{tweet.time}</span>
                        <span className="text-[11px] font-medium text-[#1d9bf0] opacity-0 transition-opacity group-hover:opacity-100">
                          View on X →
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Right: Community + Building */}
          {(discussions.length > 0 || tools.length > 0) && (
            <div className="w-full space-y-8 sm:w-[300px] sm:shrink-0">
              {discussions.length > 0 && (
                <div>
                  <div className="mb-4 border-b border-[#e5e7eb] pb-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
                      Community
                    </span>
                  </div>
                  <div className="space-y-4">
                    {discussions.map((item) => {
                      const isHN = item.source.toLowerCase().includes('hacker');
                      return (
                        <a
                          key={item.id}
                          href={item.url}
                          onClick={preventNav}
                          className="group block"
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                isHN ? 'bg-orange-50 text-orange-600' : 'bg-[#f3f4f6] text-[#6b7280]'
                              }`}
                            >
                              {item.source}
                            </span>
                            <span className="text-[11px] font-medium text-[#9ca3af]">{item.signals}</span>
                          </div>
                          <p className="text-[13px] font-semibold leading-snug text-[#111827] underline-offset-2 group-hover:underline decoration-[#111827]/20">
                            {item.title}
                          </p>
                          {item.preview && (
                            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#6b7280]">
                              {item.preview}
                            </p>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {tools.length > 0 && (
                <div>
                  <div className="mb-4 border-b border-[#e5e7eb] pb-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
                      What&apos;s being built
                    </span>
                  </div>
                  <div className="space-y-4">
                    {tools.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        onClick={preventNav}
                        className="group flex gap-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f7f3eb] text-[13px]">
                          🚀
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold leading-snug text-[#111827] underline-offset-2 group-hover:underline decoration-[#111827]/20">
                            {item.title}
                          </p>
                          {item.source && (
                            <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                              {item.source}
                              {item.signals ? ` · ${item.signals}` : ''}
                            </p>
                          )}
                        </div>
                        <ExternalLink
                          size={11}
                          className="mt-0.5 shrink-0 text-[#d1d5db] transition-colors group-hover:text-[#9ca3af]"
                          aria-hidden
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HeroPulsePreview() {
  const [demoView, setDemoView] = useState<'pulse' | 'briefing'>('pulse');
  const [newsPick, setNewsPick] = useState(0);
  const todayLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();

  const newsStories = [
    {
      title: 'Google turns Maps into an AI navigation product',
      preview: 'Gemini answers, immersive route views, and richer driver context — a shift toward conversational navigation.',
      overview:
        'Google is repositioning Maps as a conversational AI surface, not just a routing utility. A Gemini chip now sits above the turn-by-turn card in beta, letting drivers ask plain-language questions — "Is there parking near the restaurant?" — without leaving navigation. Immersive 3D previews and lane-level detail are meant to cut wrong exits in complex interchanges, while summarized business reviews along a corridor replace scrolling through dozens of listings. The move mirrors how Search and Workspace absorbed Gemini: Maps becomes another daily touchpoint where Google can prove model utility on-device. Regulators and privacy advocates are already asking how location history feeds model tuning, which could shape rollout beyond the initial Android cohort.',
      category: 'AI & Machine Learning',
      meta: '42m ago · 5 sources',
      img: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=120&q=60',
      keyTakeaways: [
        'Gemini is woven into turn-by-turn guidance so drivers can ask plain-language questions without leaving navigation.',
        'Immersive previews and lane-level detail are pitched as reducing wrong exits in complex interchanges.',
        'Summarized POI reviews along a route replace scrolling individual listings while driving.',
        'Google is framing Maps as an "AI surface" alongside Search and Workspace, not just a utility.',
        'Location data used for model tuning is drawing early regulatory scrutiny from EU and US privacy groups.',
      ],
      timeline: [
        {
          when: 'Mon 6:12 AM',
          source: 'Bloomberg',
          title: 'Google tests conversational prompts inside Maps beta',
          summary:
            'Screenshots from a small Android cohort show a Gemini chip above the route card. Drivers can ask follow-up questions about stops along the route; responses are synthesized from Maps data and indexed reviews rather than opening a separate Search session.',
        },
        {
          when: 'Mon 11:40 AM',
          source: 'Google Blog',
          title: 'Official walkthrough of AI navigation features',
          summary:
            'Google’s demo emphasizes eyes-free Q&A, corridor-level review summaries, and immersive junction previews. Product leads say the goal is fewer glance-aways from the road, not a chatbot bolted onto legacy turn-by-turn UI.',
        },
        {
          when: 'Tue 3:05 PM',
          source: 'The Verge',
          title: 'Competitors race to match on-device routing assistants',
          summary:
            'Apple and startup navigation players are exploring similar on-device assistants. Analysts note that any feature using historical location for personalization will face the same compliance questions Google is already fielding in Brussels.',
        },
      ],
    },
    {
      title: 'Meta confirms major workforce reduction',
      preview: 'The company is restructuring teams while doubling down on AI infrastructure and core products.',
      overview:
        'Meta confirmed another round of layoffs focused on flattening middle management and eliminating overlapping product roles left over from the 2021–22 hiring surge. Internal talking points seen by reporters stress that cuts are not a retreat from AI: CapEx guidance still points up for GPUs, networking, and data-center leases through next year. Reality Labs spending is being re-phased rather than eliminated — wearables and smart glasses remain public priorities, but metaverse worlds get less airtime in earnings scripts. Investors reacted cautiously: efficiency wins praise, but questions remain whether Advantage+ ads can grow fast enough to offset slower Reality Labs revenue and the cost of training frontier models.',
      category: 'Big Tech',
      meta: '3h ago · 3 sources',
      img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=120&q=60',
      keyTakeaways: [
        'Cuts target middle management and duplicated product roles rather than core engineering on ads and AI infra.',
        'CapEx guidance still points upward for GPUs and data-center leases through next year.',
        'Reality Labs spending is being re-phased; wearables remain a public priority while metaverse worlds get less emphasis.',
        'Affected employees are expected to hear by end of week with severance packages similar to prior rounds.',
        'Wall Street wants proof that AI-driven ads can offset slower Reality Labs revenue growth.',
      ],
      timeline: [
        {
          when: 'Tue 9:00 AM',
          source: 'WSJ',
          title: 'Meta prepares another round of layoffs',
          summary:
            'Sources describe a focus on "flattening" org charts after rapid hiring in 2021–22. Teams working on overlapping social features and experimental apps are said to be most exposed, while infra and ranking engineers are largely protected.',
        },
        {
          when: 'Tue 11:22 AM',
          source: 'Meta',
          title: 'Internal memo outlines restructuring timeline',
          summary:
            'Leadership memo tells managers to complete notifications by Friday. Severance mirrors prior rounds: base pay continuation, accelerated vesting for some bands, and six months of healthcare in the US.',
        },
        {
          when: 'Tue 2:48 PM',
          source: 'FT',
          title: 'Investors weigh efficiency vs. metaverse burn rate',
          summary:
            'Shares moved modestly on commentary that Advantage+ adoption is accelerating among mid-market advertisers. Analysts still model Reality Labs as a multi-billion drag, questioning whether glasses can ship at scale before the next capex cycle.',
        },
      ],
    },
    {
      title: 'Anthropic ships a sharper Claude for long documents',
      preview: 'Better reasoning on dense PDFs and spreadsheets, with clearer citations for enterprise workflows.',
      overview:
        'Anthropic rolled out a document-focused upgrade to Claude tuned for contracts, security reviews, and financial filings — the kinds of PDFs enterprises actually upload, not toy benchmarks. The model returns inline citations tied to page regions so legal and compliance teams can audit answers without re-reading hundred-page files. Spreadsheet ingestion improved enough that finance teams are piloting variance explanations across multi-tab workbooks. Pricing pushes larger customers toward annual commits with higher rate limits, which procurement teams prefer over unpredictable per-seat metering. Rival vendors immediately disputed benchmark methodology, arguing their long-doc suites were omitted — a familiar script as every lab races for enterprise due-diligence workflows.',
      category: 'AI & Machine Learning',
      meta: 'Yesterday · 6 sources',
      img: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=120&q=60',
      keyTakeaways: [
        'Long-context performance is tuned for contracts, security reviews, and financial filings — not headline benchmarks.',
        'Inline citations link back to page regions so teams can audit answers without re-reading entire files.',
        'Spreadsheet tools support multi-tab variance explanations for finance and ops workflows.',
        'Pricing tiers nudge enterprises toward annual commits with higher rate limits.',
        'Competitors are challenging benchmark claims, saying long-doc test suites do not reflect customer workloads.',
      ],
      timeline: [
        {
          when: 'Sun 4:10 PM',
          source: 'Anthropic',
          title: 'Release notes: document QA and spreadsheet tools',
          summary:
            'Release notes highlight lower hallucination rates on tabular extracts in internal evals. Anthropic publishes citation-format examples aimed at legal reviewers who need paragraph-level provenance, not just hyperlinks to whole documents.',
        },
        {
          when: 'Mon 8:30 AM',
          source: 'TechCrunch',
          title: 'Enterprises trial Claude on due-diligence workflows',
          summary:
            'Legal teams at PE firms and in-house counsel describe citation trails as the feature that passed procurement. Pilots focus on M&A data rooms where analysts previously spent days on manual cross-referencing.',
        },
        {
          when: 'Mon 6:15 PM',
          source: 'Ars Technica',
          title: 'Benchmark drama: vendors dispute methodology',
          summary:
            'Rival labs argue Anthropic cherry-picked document suites. Anthropic counters that its eval set was built from anonymized customer uploads — a claim competitors want independently verified before the next marketing cycle.',
        },
      ],
    },
  ];

  const hotTweets: DemoTweet[] = [
    {
      id: '1',
      title: '"We replaced our entire RAG pipeline with a single long-context call. Accuracy jumped from 72% to 94%"',
      description: 'Team at a legal-tech startup shares benchmarks after switching from chunked retrieval to long-context prompting. Cost went up 3x but error rate on contract review dropped dramatically.',
      time: '2h ago',
      url: '#',
    },
    {
      id: '2',
      title: 'The mass exodus from X to Bluesky is real. 30M users and the vibe has shifted',
      description: "It's less about features and more about who is already there. Engineers, journalists, and academics are rebuilding their networks from scratch.",
      time: '5h ago',
      url: '#',
    },
    {
      id: '3',
      title: 'Stop calling everything an "AI agent". A rant that turned into an actual taxonomy',
      description: "If it's just a prompt chain with a for loop it's not an agent. Thread proposes a 4-level classification that's gaining traction in ML circles.",
      time: '8h ago',
      url: '#',
    },
    {
      id: '4',
      title: 'Why senior devs are leaving FAANG for 4-person startups. A thread of exit stories',
      description: 'Compensation is still high but the work feels like maintaining someone else\'s legacy. "I went from shipping zero to shipping every day."',
      time: '12h ago',
      url: '#',
    },
  ];

  const discussions: DemoDiscussion[] = [
    {
      id: 'd1',
      title: '"We replaced our entire RAG pipeline with a single long-context call"',
      preview: 'Cost went up 3x but accuracy jumped from 72% to 94%. Team argues it was worth it for legal docs.',
      source: 'r/LocalLLaMA',
      signals: '847 pts',
      url: '#',
    },
    {
      id: 'd2',
      title: 'The mass exodus from X to Bluesky is real now',
      preview: 'Bluesky crossed 30M users. The shift is less about features and more about who is already there.',
      source: 'Hacker News',
      signals: '423 pts',
      url: '#',
    },
    {
      id: 'd3',
      title: 'Stop calling everything an "AI agent"',
      preview: "If it's just a prompt chain with a for loop, it's not an agent. A rant that turned into a real taxonomy.",
      source: 'r/ExperiencedDevs',
      signals: '612 pts',
      url: '#',
    },
  ];

  const tools: DemoTool[] = [
    {
      id: 't1',
      title: 'Unkey: API key management',
      preview: 'Open-source rate limiting and key auth for serverless APIs.',
      source: 'Product Hunt',
      signals: '342 upvotes',
      url: '#',
    },
    {
      id: 't2',
      title: 'sqlite-vec',
      preview: 'Vector search extension for SQLite. No external DB needed.',
      source: 'GitHub Trending',
      signals: '1.2k stars today',
      url: '#',
    },
    {
      id: 't3',
      title: 'Trigger.dev v3',
      preview: 'Background jobs for TypeScript with long-running task support.',
      source: 'Show HN',
      signals: '187 points',
      url: '#',
    },
  ];

  const preventNav = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="relative overflow-x-clip">
      <div className="relative z-10 overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        {/* Tab bar — matches /feed Pulse tab chrome */}
        <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 pt-3 sm:px-6">
          <div className="flex items-center justify-between">
            <HeroDemoFeedToggle view={demoView} onChange={setDemoView} />
            <p className="pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9ca3af]">
              {todayLabel}
            </p>
          </div>
        </div>

        <div className="h-[min(36rem,80vh)]">
          {demoView === 'pulse' ? (
            <DemoPulseTab
              hotTweets={hotTweets}
              discussions={discussions}
              tools={tools}
              preventNav={preventNav}
            />
          ) : (
            <div className="flex h-full min-h-0 flex-row">
              <div className="flex min-h-0 w-full flex-col sm:w-[36%] sm:flex-none sm:border-r sm:border-[#e5e7eb]">
                <div className="shrink-0 border-b border-[#e5e7eb] px-4 py-3 sm:px-3.5">
                  <p className="text-[12px] font-bold text-[#111827]">News</p>
                  <p className="mt-0.5 text-[10px] text-[#9ca3af]">Today · {newsStories.length} stories</p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {(['For You', 'AI', 'Suggested'] as const).map((pill, i) => (
                      <span
                        key={pill}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                          i === 0 ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#6b7280]'
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
                            ? 'border-[#2563eb]/30 bg-[#eff6ff] shadow-sm'
                            : 'border-[#e5e7eb] bg-white hover:border-[#d1d5db] hover:bg-[#f9fafb]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-snug text-[#111827]">{story.title}</p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#9ca3af]">{story.preview}</p>
                            <p className="mt-2 text-[10px] font-medium text-[#9ca3af]">{story.meta}</p>
                          </div>
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6]">
                            <img src={story.img} alt="" className="h-full w-full object-cover" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hidden min-h-0 flex-1 overflow-y-auto bg-white sm:block">
                <article className="mx-auto w-full max-w-[720px] px-6 py-8 sm:px-10 sm:py-10">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9ca3af]">
                    {newsStories[newsPick].category} · {newsStories[newsPick].meta}
                  </p>
                  <h1 className="mt-3 text-[1.65rem] font-bold leading-[1.18] tracking-[-0.02em] text-[#111827] sm:text-[28px]">
                    {newsStories[newsPick].title}
                  </h1>
                  <div className="mt-6 overflow-hidden rounded-md bg-[#f3f4f6]">
                    <img
                      src={newsStories[newsPick].img.replace('w=120', 'w=800').replace('h=630', 'h=450')}
                      alt=""
                      className="aspect-[16/9] w-full object-cover"
                    />
                  </div>
                  <p className="mt-7 text-[15.5px] leading-[1.7] text-[#374151]">
                    {newsStories[newsPick].overview}
                  </p>

                  <section className="mt-10 border-t border-[#e5e7eb] pt-7">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Key points</p>
                    <ul className="mt-4 space-y-3">
                      {newsStories[newsPick].keyTakeaways.map((point) => (
                        <li key={point} className="flex items-start gap-3 text-[14.5px] leading-[1.6] text-[#374151]">
                          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#9ca3af]" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="mt-10 border-t border-[#e5e7eb] pt-7">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Timeline</p>
                    <div className="relative mt-5">
                      <div className="absolute bottom-1 left-[5px] top-1 w-px bg-[#e5e7eb]" />
                      <div className="space-y-6">
                        {newsStories[newsPick].timeline.map((event) => (
                          <div key={`${event.when}-${event.title}`} className="relative pl-7">
                            <span className="absolute left-0 top-[7px] block h-[11px] w-[11px] rounded-full border-2 border-white bg-[#d1d5db] ring-1 ring-[#e5e7eb]" />
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9ca3af]">
                              <span>{event.when}</span>
                              <span className="text-[#d1d5db]">·</span>
                              <span className="font-medium uppercase tracking-[0.08em] text-[#6b7280]">{event.source}</span>
                            </div>
                            <p className="mt-1 text-[14px] font-semibold leading-snug text-[#111827]">{event.title}</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">{event.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </article>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#93c5fd]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-[#bfdbfe]/20 blur-3xl" />
    </div>
  );
}
