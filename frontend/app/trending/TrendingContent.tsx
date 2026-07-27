"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { trackCheckoutClicked } from "@/lib/posthog";

type TrendingItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  thumbnail?: string;
};

type TopicCard = {
  slug: string;
  label: string;
  summary: string;
  sourceCount: number;
  articleCount: number;
  keyPoints: string[];
  thumbnail?: string;
};

type RecentArchiveItem = { date: string; topHeadline?: string };

type HotTweet = { id: string; title: string; url: string; description: string; pubDate: string; category: string };

/* ─── Click-Lock Modal ─── */

function TrendingClickLock({ children, active }: { children: React.ReactNode; active: boolean }) {
  const [open, setOpen] = useState(false);

  if (!active) return <>{children}</>;

  return (
    <div className="relative">
      {/* Transparent shield intercepts clicks on children */}
      <div
        className="pointer-events-auto absolute inset-0 z-[60] cursor-pointer"
        aria-hidden
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      />
      {/* Children rendered normally but non-interactive (under the shield) */}
      <div className="pointer-events-none">{children}</div>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1.5 text-secondary/60 transition hover:bg-foreground/5 hover:text-foreground"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
            <p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary/40">Trace</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground">Log in to view full stories</h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary/60">
              Sign in to Trace to read topics, stories, and tweets in full — with key takeaways, source links, and one clear entry point into every story.
            </p>
            <Link
              href="/profile?tab=subscription"
              prefetch={false}
              onClick={() => trackCheckoutClicked("trending_click_lock_modal")}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
            >
              Sign in to Trace
            </Link>
            <button
              type="button"
              className="mt-3 w-full py-2 text-sm text-secondary/60 transition hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

function stripMarkdown(t: string): string { return (t||"").replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1").replace(/^\s*#+\s*/gm,"").trim(); }

function getTodayLabel(): string { return new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}); }

function getTimeLabel(d?: string): string {
  if (!d) return "";
  const ts = new Date(d).getTime(); if (Number.isNaN(ts)) return "";
  const n = new Date(); const diff = Math.floor((n.getTime()-ts)/60000);
  if (diff < 60) return `${diff}m ago`;
  const dt = new Date(ts);
  if (dt.toDateString()===n.toDateString()) return dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true});
  const y = new Date(n); y.setDate(y.getDate()-1);
  if (dt.toDateString()===y.toDateString()) return "Yesterday";
  return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

function hostFromUrl(u: string): string { try { return new URL(u).hostname.replace("www.",""); } catch { return ""; } }

/* ─── Hot Tweet Item ─── */

function HotTweetItem({ tweet }: { tweet: HotTweet }) {
  return (
    <div className="block py-3.5 border-b border-border/15 last:border-b-0 hover:bg-foreground/[0.04] -mx-2 px-2 rounded transition-colors">
      <h4 className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] line-clamp-2">{tweet.title}</h4>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[10px] text-secondary/50">{getTimeLabel(tweet.pubDate)}</span>
        <span className="text-secondary/25 text-[10px]">·</span>
        <span className="text-[10px] font-medium text-[#1d9bf0]">View on X</span>
      </div>
    </div>
  );
}

/* ─── Editorial Hero Card (topics) ─── */

function HeroTopicCard({ topic }: { topic: TopicCard }) {
  return (
    <div className="block group">
      <article>
        {topic.thumbnail && (
          <div className="overflow-hidden rounded-xl mb-4">
            <img src={topic.thumbnail} alt="" loading="eager" decoding="async"
              className="w-full h-[300px] object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-secondary/55 mb-2">
          <span className="font-medium uppercase tracking-[0.08em] text-foreground/60">Topic</span>
          <span className="text-secondary/30">·</span>
          <span>{topic.sourceCount} sources</span>
        </div>
        <h2 className="text-[1.55rem] font-bold text-foreground leading-[1.18] tracking-[-0.025em] mb-2">{stripMarkdown(topic.label)}</h2>
        {topic.summary && <p className="text-[15px] text-secondary/70 leading-relaxed line-clamp-3">{stripMarkdown(topic.summary)}</p>}
      </article>
    </div>
  );
}

/* ─── Editorial Medium Card (topics) ─── */

function MediumTopicCard({ topic }: { topic: TopicCard }) {
  return (
    <div className="block group">
      <article>
        {topic.thumbnail && (
          <div className="overflow-hidden rounded-lg mb-3">
            <img src={topic.thumbnail} alt="" loading="lazy" decoding="async"
              className="w-full h-[170px] object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-secondary/50 mb-1.5">
          <span className="font-medium uppercase tracking-[0.08em]">Topic</span>
          <span className="text-secondary/30">·</span>
          <span>{topic.sourceCount} sources</span>
        </div>
        <h3 className="min-h-[3.6rem] text-[15px] font-bold text-foreground leading-snug tracking-[-0.01em] mb-1 line-clamp-3">{stripMarkdown(topic.label)}</h3>
        {topic.summary && <p className="text-[13px] text-secondary/60 leading-relaxed line-clamp-2">{stripMarkdown(topic.summary)}</p>}
      </article>
    </div>
  );
}

/* ─── Editorial Sidebar Item (stories) ─── */

function SidebarStoryItem({ item, showDivider = true }: { item: TrendingItem; showDivider?: boolean }) {
  const source = hostFromUrl(item.url) || item.source || "";
  return (
    <div className="block hover:bg-foreground/[0.03] -mx-2 px-2 rounded-lg transition-colors">
      <article className={`py-3.5 ${showDivider ? "border-b border-border/15" : ""}`}>
        <h4 className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] mb-1.5 line-clamp-3">{stripMarkdown(item.title)}</h4>
        <div className="flex items-center gap-1.5 text-[10px] text-secondary/50">
          {source && <span className="truncate max-w-[120px]">{source}</span>}
        </div>
      </article>
    </div>
  );
}

/* ─── Main Component ─── */

export default function TrendingContent({
  items,
  topicCards,
  recentDailyArchives = [],
}: {
  items: TrendingItem[];
  topicCards: TopicCard[];
  recentDailyArchives?: RecentArchiveItem[];
}) {
  const [tweets, setTweets] = useState<HotTweet[]>([]);

  useEffect(() => {
    fetch("/api/hot-tweets").then(r => r.json()).then(d => {
      if (Array.isArray(d.items)) setTweets(d.items);
    }).catch(() => {});
  }, []);

  const heroTopic = topicCards[0] ?? null;
  const gridTopics = topicCards.slice(1, 5);
  const sidebarStories = items.slice(0, 6);
  const hasContent = topicCards.length > 0 || items.length > 0 || tweets.length > 0;

  return (
    <div className="space-y-0">
      {/* Hero section */}
      <section className="pt-2 pb-2 sm:pt-4 sm:pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">Public preview</p>
        <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[2.75rem]">{getTodayLabel()}</h1>
        <p className="mt-4 max-w-lg text-[15px] leading-[1.8] text-secondary">Trace groups coverage by topic across 50+ sources so you get one clear entry point into the story — not ten duplicate tabs.</p>
      </section>

      <TrendingClickLock active={hasContent}>
        {/* ── 3-Column Editorial Grid (desktop) ── */}
        <div className="hidden lg:grid lg:grid-cols-[minmax(200px,1fr)_minmax(0,2.2fr)_minmax(200px,1fr)] gap-8 pt-6 pb-8">
          {/* Left — Hot Tweets */}
          <aside className="min-w-0">
            <div className="mb-4 flex items-center gap-2">
              <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{color: "#1d9bf0"}}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1d9bf0]">Hot Tweets</span>
              <div className="flex-1 h-px bg-border/25" />
            </div>
            {tweets.length > 0 ? (
              <div>
                {tweets.slice(0, 5).map(t => <HotTweetItem key={t.id} tweet={t} />)}
                {tweets.length > 5 && (
                  <div className="relative mt-1">
                    <div className="pointer-events-none select-none opacity-30 blur-[3px]" aria-hidden>
                      {tweets.slice(5, 8).map(t => <HotTweetItem key={t.id} tweet={t} />)}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background via-background/50 to-transparent">
                      <span className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-background">
                        Unlock more tweets
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-secondary/40 py-4">Loading tweets...</p>
            )}
          </aside>

          {/* Center — Topics (hero + grid) */}
          <main className="min-w-0">
            {heroTopic && (
              <div className="mb-8">
                <HeroTopicCard topic={heroTopic} />
              </div>
            )}
            {gridTopics.length > 0 && (
              <div className="grid grid-cols-2 gap-6">
                {gridTopics.map(t => <MediumTopicCard key={t.slug} topic={t} />)}
              </div>
            )}
            {!heroTopic && (
              <div className="py-20 text-center text-[14px] text-secondary/40">No topics yet</div>
            )}
          </main>

          {/* Right — Stories */}
          <aside className="min-w-0">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/60">Trending Stories</span>
              <div className="flex-1 h-px bg-border/25" />
            </div>
            {sidebarStories.length > 0 ? (
              <div>
                {sidebarStories.map((item, i) => (
                  <SidebarStoryItem key={item.id} item={item} showDivider={i < sidebarStories.length - 1} />
                ))}
                {items.length > 6 && (
                  <div className="relative mt-1">
                    <div className="pointer-events-none select-none opacity-25 blur-[3px]" aria-hidden>
                      {items.slice(6, 9).map(item => <SidebarStoryItem key={item.id} item={item} showDivider />)}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background via-background/50 to-transparent">
                      <span className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-background">
                        Unlock more stories
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-secondary/40 py-4">More stories coming soon</p>
            )}
          </aside>
        </div>

        {/* ── Mobile (below lg) ── */}
        <div className="lg:hidden border-t border-border/[0.06] space-y-0">
          {/* Mobile topics */}
          {topicCards.length > 0 && (
            <div className="py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/60 mb-3">Topics</p>
              {topicCards.slice(0, 4).map(t => (
                <div key={t.slug} className="block py-3.5 border-b border-border/[0.06] hover:bg-foreground/[0.02] -mx-2 px-2 rounded transition-colors">
                  <p className="text-[14px] font-semibold text-foreground leading-snug">{stripMarkdown(t.label)}</p>
                  <p className="text-[10px] text-secondary/45 mt-1">{t.sourceCount} sources · {t.articleCount} updates</p>
                </div>
              ))}
            </div>
          )}
          {/* Mobile stories */}
          {items.length > 0 && (
            <div className="py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/60 mb-3">Stories</p>
              {items.slice(0, 4).map(item => {
                const src = hostFromUrl(item.url) || item.source || "";
                return (
                  <div key={item.id} className="block py-3.5 border-b border-border/[0.06] hover:bg-foreground/[0.02] -mx-2 px-2 rounded transition-colors">
                    <p className="text-[14px] font-semibold text-foreground leading-snug">{stripMarkdown(item.title)}</p>
                    {src && <p className="text-[10px] text-secondary/45 mt-1">{src}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </TrendingClickLock>

      {/* Pro CTA */}
      {(topicCards.length > 0 || items.length > 0 || tweets.length > 0) && (
        <div className="pt-8 pb-4">
          <div className="mx-auto max-w-lg rounded-[24px] bg-[#151515] p-8 text-center shadow-[0_25px_60px_rgba(15,15,15,0.2)]">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50 mb-4">Trace Pro</div>
            <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-white sm:text-[1.75rem]">Unlock the full feed</h2>
            <p className="mt-3 text-[14px] text-white/50 leading-relaxed max-w-md mx-auto">Get today&apos;s complete briefing — every story, topic, key takeaway, and hot tweet.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12px] text-white/60">
              <span className="inline-flex items-center rounded-full bg-white/8 px-2.5 py-1">Daily pulse</span>
              <span className="inline-flex items-center rounded-full bg-white/8 px-2.5 py-1">Grouped topics</span>
              <span className="inline-flex items-center rounded-full bg-white/8 px-2.5 py-1">Hot tweets</span>
            </div>
            <Link href="/profile?tab=subscription" prefetch={false} onClick={() => trackCheckoutClicked("trending_unlock_cta")}
              className="mt-6 inline-flex items-center rounded-full bg-white px-8 py-3.5 text-[14px] font-semibold text-[#151515] transition-all hover:bg-white/90">
              Subscribe to Pro
            </Link>
            <p className="mt-3 text-[12px] text-white/30">
              <span className="line-through text-white/25">$4.99/month</span>{' '}
              <span className="text-white/50">$2.99/month</span> · Cancel anytime
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
