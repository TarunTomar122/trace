import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, Braces, Check, ShieldCheck, Terminal } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import AgentAccessManager from '@/components/AgentAccessManager';
import CopyPromptCard from '@/components/CopyPromptCard';
import { AuthProvider } from '@/contexts/AuthContext';

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
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <PublicHeader variant="landing" ctaLabel="Open Trace" ctaHref="/feed" />
      <AuthProvider>
      <main>
        <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-[24px] bg-surface p-7 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-12">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Trace for agents · Pro</p>
            <h1 className="mt-6 max-w-4xl tracking-[-0.05em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif', fontSize: 'clamp(3rem, 7vw, 6.2rem)', lineHeight: 0.92 }}>Your agent should know what tech is doing today.</h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.8] text-secondary">Create a key, paste one prompt, done. Your agent gets structured current tech news, notable builds, and practitioner conversations without searching the open web from scratch every time.</p>
            <div className="mt-8 flex flex-wrap gap-3 text-[12px] font-semibold">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-2"><ShieldCheck size={14} className="text-accent" />Read only</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-2"><Check size={14} className="text-accent" />Pro checked on every request</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-2"><Bot size={14} className="text-accent" />MCP + HTTPS</span>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 pt-14 sm:px-6 lg:px-8" id="connect">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Step 1</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Create your read-only Agent Key</h2>
            </div>
            <AgentAccessManager />
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Step 2</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Let your agent do the setup</h2>
            <div className="mt-8">
              <CopyPromptCard />
            </div>
            <details className="mt-6 rounded-[18px] bg-surface px-6 py-5 ring-1 ring-foreground/7 dark:ring-white/10">
              <summary className="cursor-pointer text-[15px] font-semibold">Prefer manual setup? Code and configs</summary>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <CodeCard icon={Terminal} title="Codex" code={codexCommand} />
                <CodeCard icon={Braces} title="Claude, Cursor, and MCP clients" code={genericConfig} />
                <CodeCard icon={Braces} title="Custom agents and bots" code={restExample} />
                <div className="rounded-[18px] bg-surface-secondary/50 p-6 ring-1 ring-foreground/7 dark:ring-white/10">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Delivery channels</p>
                  <h3 className="mt-3 text-[20px] font-semibold">Telegram, WhatsApp, Discord, Slack</h3>
                  <p className="mt-3 text-[14px] leading-[1.7] text-secondary">Trace supplies the intelligence. Your bot or agent decides where to send it. Any system that can call MCP or HTTPS can fetch the brief and post it into the channel you already use.</p>
                </div>
              </div>
            </details>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl rounded-[20px] bg-surface p-7 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-10">
            <h2 className="text-[26px] font-semibold tracking-[-0.03em]">What the connection can access</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="text-[14px] font-semibold">Allowed</h3>
                <ul className="mt-3 space-y-2 text-[14px] text-secondary"><li>Today’s structured Trace feed</li><li>Grouped news, builds, and conversations</li><li>Summaries, takeaways, timestamps, and source links</li></ul>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Never allowed</h3>
                <ul className="mt-3 space-y-2 text-[14px] text-secondary"><li>Changing your Trace account</li><li>Publishing, purchasing, or writing data</li><li>Access after the key is revoked or Pro ends</li></ul>
              </div>
            </div>
            <p className="mt-7 text-[13px] text-secondary">Full machine-readable setup notes: <Link href="/agents/llms.txt" className="font-semibold text-accent">/agents/llms.txt</Link></p>
          </div>
        </section>
      </main>
      </AuthProvider>
      <Footer />
    </div>
  );
}

function CodeCard({ icon: Icon, title, code }: { icon: typeof Terminal; title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-[#151923] text-white ring-1 ring-white/10">
      <div className="flex items-center gap-2 px-5 pt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50"><Icon size={13} />{title}</div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-5 font-mono text-[11px] leading-[1.7]" style={{ color: '#F2F5F9' }}>{code}</pre>
    </div>
  );
}
