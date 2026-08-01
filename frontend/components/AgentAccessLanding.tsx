"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Check, Copy, MessageCircle, Newspaper, Rocket, Terminal } from 'lucide-react';

const setupPrompt = `Connect this agent to Trace as a read-only MCP server.

Server: https://www.yourtrace.online/api/mcp
Authentication: Bearer token from the TRACE_AGENT_KEY environment variable

Keep the key out of source control and logs. After setup, call get_daily_tech_brief and show me today's top tech news, builds, and conversations.`;

export default function AgentAccessLanding() {
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(setupPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-[1500px] px-4 sm:px-16 lg:px-24">
        <div className="overflow-hidden border border-[#d9dded] bg-[#f3f5ff]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Trace for agents · Pro</p>
              <h2 className="mt-5 max-w-[620px] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif', fontSize: 'clamp(2.5rem, 4.6vw, 4.2rem)', lineHeight: 0.98 }}>
                Give your agent a better read on tech.
              </h2>
              <p className="mt-5 max-w-[590px] text-[16px] leading-[1.75] text-[#656b7b]">
                Generic web search finds links. Trace gives your agent a structured daily brief: grouped news, useful builds, key takeaways, and the conversations practitioners are having now.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/agents" className="inline-flex items-center gap-2 bg-[#2557d6] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#1d48b4]">
                  Connect your agent <ArrowRight size={14} />
                </Link>
                <button type="button" onClick={copyPrompt} className="inline-flex items-center gap-2 border border-[#bfc7e2] bg-white px-5 py-3 text-[14px] font-semibold text-[#2557d6] hover:border-[#2557d6]">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy setup prompt'}
                </button>
              </div>
              <p className="mt-4 text-[12px] text-[#7f8492]">Included with Trace Pro · Read-only access · Revoke anytime</p>
            </div>

            <div className="border-t border-[#d9dded] bg-white/70 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Newspaper, label: 'Top news', value: 'Grouped stories' },
                  { icon: Rocket, label: 'Builds', value: 'Tools + launches' },
                  { icon: MessageCircle, label: 'Conversations', value: 'HN + community' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="border border-[#dfe3ef] bg-white p-4">
                    <Icon size={16} className="text-[#2557d6]" />
                    <p className="mt-4 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#858b99]">{label}</p>
                    <p className="mt-1 text-[13px] font-semibold text-[#202532]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 border border-[#202532] bg-[#151923] p-5 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55"><Terminal size={13} /> Your agent</span>
                  <span className="text-[10px] text-emerald-300">Trace connected</span>
                </div>
                <p className="mt-4 text-[13px] leading-[1.65] text-white/85">“Send my 8:30 AM tech brief to Telegram. Lead with AI model releases, then developer tools and the best technical debate.”</p>
                <div className="mt-5 flex items-center gap-2 text-[11px] text-white/45"><Bot size={13} /> MCP or HTTPS → Telegram, WhatsApp, Discord, Slack, or your own app</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
