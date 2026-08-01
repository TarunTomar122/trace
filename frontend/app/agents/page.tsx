import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, Braces, Check, MessageCircle, Newspaper, Rocket, ShieldCheck, Terminal } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import AgentAccessManager from '@/components/AgentAccessManager';

export const metadata: Metadata = {
  title: 'Trace for AI Agents | Live Tech News MCP and API',
  description: 'Connect Claude, ChatGPT, Codex, Cursor, or your own agent to structured current tech news, builds, and community conversations through Trace MCP or HTTPS.',
  alternates: { canonical: 'https://www.yourtrace.online/agents' },
  openGraph: {
    title: 'Give your AI agent a live read on tech',
    description: 'Structured tech news, builds, and conversations through one read-only Trace connection.',
    url: 'https://www.yourtrace.online/agents',
    type: 'website',
  },
};

const codexCommand = `export TRACE_AGENT_KEY="your_key_here"
codex mcp add trace \\
  --url https://www.yourtrace.online/api/mcp \\
  --bearer-token-env-var TRACE_AGENT_KEY`;

const genericConfig = `{
  "mcpServers": {
    "trace": {
      "url": "https://www.yourtrace.online/api/mcp",
      "headers": {
        "Authorization": "Bearer \${TRACE_AGENT_KEY}"
      }
    }
  }
}`;

const restExample = `curl "https://www.yourtrace.online/api/agents/brief?limit=8" \\
  -H "Authorization: Bearer $TRACE_AGENT_KEY"`;

export default function AgentsPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Connect an AI agent to Trace',
    description: 'Setup documentation for the Trace read-only MCP server and agent brief API.',
    url: 'https://www.yourtrace.online/agents',
    publisher: { '@type': 'Organization', name: 'Trace' },
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1b1a17]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <PublicHeader variant="landing" ctaLabel="Open Trace" ctaHref="/feed" />
      <main>
        <section className="border-b border-[#e4e1d8] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2557d6]">Trace for agents · Pro</p>
            <h1 className="mt-6 max-w-4xl tracking-[-0.05em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif', fontSize: 'clamp(3rem, 7vw, 6.2rem)', lineHeight: 0.92 }}>Your agent should know what tech is doing today.</h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.8] text-[#6d695e]">Connect once. Your agent gets structured current tech news, notable builds, and practitioner conversations without searching the open web from scratch every time.</p>
            <div className="mt-8 flex flex-wrap gap-3 text-[12px] font-semibold">
              <span className="inline-flex items-center gap-2 border border-[#d8dcd0] bg-white px-3 py-2"><ShieldCheck size={14} className="text-[#2557d6]" />Read only</span>
              <span className="inline-flex items-center gap-2 border border-[#d8dcd0] bg-white px-3 py-2"><Check size={14} className="text-[#2557d6]" />Pro checked on every request</span>
              <span className="inline-flex items-center gap-2 border border-[#d8dcd0] bg-white px-3 py-2"><Bot size={14} className="text-[#2557d6]" />MCP + HTTPS</span>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {[
              { icon: Newspaper, title: 'Top tech news', body: 'Grouped stories, concise summaries, key takeaways, and source trails.' },
              { icon: Rocket, title: 'Builds worth seeing', body: 'Open-source projects, launches, and developer tools with actual signal.' },
              { icon: MessageCircle, title: 'Live conversations', body: 'Technical discussions and community reactions around what just happened.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="border border-[#e4e1d8] bg-white p-6">
                <Icon size={18} className="text-[#2557d6]" />
                <h2 className="mt-5 text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
                <p className="mt-2 text-[14px] leading-[1.7] text-[#747064]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-8" id="connect">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2557d6]">Step 1</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Create your read-only Agent Key</h2>
            </div>
            <AgentAccessManager />
          </div>
        </section>

        <section className="border-y border-[#e4e1d8] bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2557d6]">Step 2</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Connect the client you already use</h2>
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <CodeCard icon={Terminal} title="Codex" code={codexCommand} />
              <CodeCard icon={Braces} title="Claude, Cursor, and MCP clients" code={genericConfig} />
              <CodeCard icon={Braces} title="Custom agents and bots" code={restExample} />
              <div className="border border-[#d9dded] bg-[#f3f5ff] p-6">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2557d6]">Delivery channels</p>
                <h3 className="mt-3 text-[20px] font-semibold">Telegram, WhatsApp, Discord, Slack</h3>
                <p className="mt-3 text-[14px] leading-[1.7] text-[#686e7e]">Trace supplies the intelligence. Your bot or agent decides where to send it. Any system that can call MCP or HTTPS can fetch the brief and post it into the channel you already use.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2557d6]">Step 3</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Ask for outcomes, not endpoints</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                'Every weekday at 8:30 AM, send the five AI and developer stories I should know to Telegram. Include why each matters.',
                'Show me the three most interesting open-source projects in today’s Trace brief and explain what is actually new about them.',
                'Summarize the strongest technical conversations today. Separate informed practitioner debate from generic reactions.',
                'Before our product standup, give me a founder-focused brief with market shifts, new tools, and community signals.',
              ].map((prompt) => <blockquote key={prompt} className="border-l-2 border-[#2557d6] bg-white p-5 text-[14px] leading-[1.7] text-[#4f5360]">“{prompt}”</blockquote>)}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl border border-[#e4e1d8] bg-white p-7 sm:p-10">
            <h2 className="text-[26px] font-semibold tracking-[-0.03em]">What the connection can access</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="text-[14px] font-semibold">Allowed</h3>
                <ul className="mt-3 space-y-2 text-[14px] text-[#6d695e]"><li>Today’s structured Trace feed</li><li>Grouped news, builds, and conversations</li><li>Summaries, takeaways, timestamps, and source links</li></ul>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Never allowed</h3>
                <ul className="mt-3 space-y-2 text-[14px] text-[#6d695e]"><li>Changing your Trace account</li><li>Publishing, purchasing, or writing data</li><li>Access after the key is revoked or Pro ends</li></ul>
              </div>
            </div>
            <p className="mt-7 text-[13px] text-[#777267]">Full machine-readable setup notes: <Link href="/agents/llms.txt" className="font-semibold text-[#2557d6]">/agents/llms.txt</Link></p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function CodeCard({ icon: Icon, title, code }: { icon: typeof Terminal; title: string; code: string }) {
  return (
    <div className="overflow-hidden border border-[#202532] bg-[#151923] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50"><Icon size={13} />{title}</div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-5 font-mono text-[11px] leading-[1.7] text-white/80">{code}</pre>
    </div>
  );
}
