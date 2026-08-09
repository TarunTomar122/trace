"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Check, Copy, Terminal } from 'lucide-react';
import type { V3UserFeed } from '@/lib/firestore';
import { buildAgentBrief } from '@/lib/agent-brief';

const setupPrompt = `Connect this agent to Trace as a read-only MCP server.

Server: https://www.yourtrace.online/api/mcp
Authentication: Bearer token from the TRACE_AGENT_KEY environment variable

Keep the key out of source control and logs. After setup, call get_daily_tech_brief and show me today's top tech news, builds, and conversations.`;

export default function AgentAccessLanding({ feed }: { feed: V3UserFeed | null }) {
  const [copied, setCopied] = useState(false);
  const topStories = feed ? buildAgentBrief(feed, 3).top_news : [];

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(setupPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="agents" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-[24px] bg-surface-secondary/45 ring-1 ring-foreground/7 dark:ring-white/10">
          <div className="grid gap-3 p-2 sm:p-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="p-5 sm:p-10 lg:p-12">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Trace for agents · Pro</p>
              <h2 className="mt-5 max-w-[620px] text-balance font-semibold tracking-[-0.04em]" style={{ fontSize: 'clamp(2.15rem, 10vw, 4.2rem)', lineHeight: 0.98 }}>
                Give your agent a better read on tech.
              </h2>
              <p className="mt-5 max-w-[590px] text-pretty text-[16px] leading-[1.75] text-secondary">
                Trace gives your agent a structured AI and technology brief with grouped news, clear takeaways, original sources, and the most useful supporting conversations.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/agents" className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[14px] font-semibold text-background hover:opacity-90">
                  Connect your agent <ArrowRight size={14} />
                </Link>
                <button type="button" onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-full bg-surface px-5 py-3 text-[14px] font-semibold text-foreground ring-1 ring-foreground/10 hover:bg-surface-secondary">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy setup prompt'}
                </button>
              </div>
              <p className="mt-4 text-[12px] text-secondary">Included with Trace Pro · Read-only access · Revoke anytime</p>
            </div>

            <div className="rounded-[20px] bg-surface/70 p-2 sm:p-6 lg:p-7">
              <div className="rounded-[18px] p-4 text-white ring-1 ring-white/10 sm:p-5" style={{ backgroundColor: '#181815', color: '#f7f4ec' }}>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c7cbd4]"><Terminal size={14} /> Your agent</span>
                  <span className="text-[11px] font-medium text-[#6ee7b7]">Trace connected</span>
                </div>
                <p className="mt-3 text-[13px] leading-[1.6] text-[#eef0f4]">“Send my 8:30 AM tech brief to Telegram. Lead with AI model releases, then developer tools and the best technical debate.”</p>
                {topStories.length > 0 && (
                  <div className="mt-4 rounded-[15px] bg-white/[0.04] p-4 ring-1 ring-white/8">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6ee7b7]"><Bot size={14} /> Agent response</span>
                      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#a8afbd]">{topStories.length} top stories</span>
                    </div>
                    <p className="mt-2 text-[12px] leading-[1.55] text-[#c7cbd4]">Morning, here are the strongest signals in today&rsquo;s Trace:</p>
                    <ol className="mt-3 space-y-2">
                      {topStories.map((story, index) => {
                        return (
                          <li key={story.id} className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 rounded-[12px] bg-white/[0.035] p-3">
                            <span className="pt-0 font-mono text-[11px] font-medium leading-[1.45] text-[#a8afbd]">{String(index + 1).padStart(2, '0')}</span>
                            <div className="min-w-0">
                              {story.url ? (
                                <a href={story.url} target="_blank" rel="noopener noreferrer" className="block text-[13px] font-semibold leading-[1.45] text-white hover:text-[#6ee7b7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6ee7b7]">
                                  {story.title}
                                </a>
                              ) : (
                                <p className="text-[13px] font-semibold leading-[1.45] text-white">{story.title}</p>
                              )}
                              <p className="mt-1 line-clamp-1 text-[12px] leading-[1.5] text-[#c7cbd4]">{story.summary}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
                <div className="mt-4 flex items-start gap-2 text-[12px] leading-[1.5] text-[#a8afbd]"><Bot size={14} className="mt-0.5 shrink-0" /> MCP or HTTPS → Telegram, WhatsApp, Discord, Slack, or your own app</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
