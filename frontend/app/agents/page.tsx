import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, Braces, Check, KeyRound, Mail, ShieldCheck, Terminal } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import AgentAccessManager from '@/components/AgentAccessManager';
import AgentConnectGuide, { McpUrlBox } from '@/components/AgentConnectGuide';
import CopyPromptCard from '@/components/CopyPromptCard';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Trace for AI Agents | Live Tech News MCP Server',
  description: 'Paste one URL into Claude, ChatGPT, Cursor, Claude Code, Codex or Gemini CLI and your agent reads today’s tech news, builds and conversations. Sign in with Google; no key to copy.',
  alternates: { canonical: 'https://www.yourtrace.online/agents' },
  openGraph: {
    title: 'Give your AI agent a live read on tech',
    description: 'One URL, one sign-in: structured tech news, builds, and conversations through a read-only Trace MCP server.',
    url: 'https://www.yourtrace.online/agents',
    type: 'website',
    images: [
      {
        url: 'https://www.yourtrace.online/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Trace live tech news for AI agents',
      },
    ],
  },
};

const tools = [
  ['get_daily_tech_brief', 'Top news, builds and conversations in one answer'],
  ['get_top_tech_news', 'The biggest technology and AI stories, grouped across sources'],
  ['get_latest_builds', 'Open-source projects, launches and developer tools'],
  ['get_tech_conversations', 'Technical discussions worth paying attention to'],
] as const;

const codexKeyCommand = `export TRACE_AGENT_KEY="your_key_here"
codex mcp add trace \\
  --url https://www.yourtrace.online/api/mcp \\
  --bearer-token-env-var TRACE_AGENT_KEY`;

const headerConfig = `{
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

const skillInstall = `mkdir -p ~/.claude/skills/trace
curl -o ~/.claude/skills/trace/SKILL.md \\
  https://www.yourtrace.online/agents/skill.md`;

export default function AgentsPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Connect an AI agent to Trace',
    description: 'Setup guide for the Trace read-only MCP server: paste the URL, sign in with Google, click Allow.',
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
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Trace for agents · Free</p>
            <h1 className="mt-6 max-w-4xl tracking-[-0.05em]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif', fontSize: 'clamp(3rem, 7vw, 6.2rem)', lineHeight: 0.92 }}>Your agent should know what tech is doing today.</h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.8] text-secondary">Paste one URL into Claude, ChatGPT, Cursor, Claude Code, Codex or Gemini CLI. Sign in with Google, click Allow, and your agent reads today’s top tech stories, notable builds and practitioner conversations. No key to copy.</p>
            <div className="mt-8">
              <McpUrlBox />
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-[12px] font-semibold">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-2"><ShieldCheck size={14} className="text-accent" />Read only</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-2"><Check size={14} className="text-accent" />Free for everyone</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-2"><Bot size={14} className="text-accent" />MCP with Google sign-in</span>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 pt-6 sm:px-6 lg:px-8" id="connect">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Step 1</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Paste the URL into your app</h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-[1.7] text-secondary">Any MCP client that supports remote servers works. Most take just the URL: <code className="font-mono text-[13px]">https://www.yourtrace.online/api/mcp</code></p>
            </div>
            <AgentConnectGuide />
            <div className="mt-6">
              <CopyPromptCard />
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8" id="sign-in">
          <div className="mx-auto max-w-6xl rounded-[20px] bg-surface p-7 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-10">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Step 2</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Sign in once</h2>
            <ol className="mt-6 grid gap-5 md:grid-cols-3">
              <li className="rounded-[16px] bg-surface-secondary/50 p-5">
                <p className="font-mono text-[11px] font-semibold text-accent">1</p>
                <p className="mt-2 text-[15px] font-semibold">Your app opens a Trace page</p>
                <p className="mt-1 text-[14px] leading-[1.6] text-secondary">The first time it connects, in your browser.</p>
              </li>
              <li className="rounded-[16px] bg-surface-secondary/50 p-5">
                <p className="font-mono text-[11px] font-semibold text-accent">2</p>
                <p className="mt-2 text-[15px] font-semibold">Sign in with Google</p>
                <p className="mt-1 text-[14px] leading-[1.6] text-secondary">New to Trace? That creates your free account.</p>
              </li>
              <li className="rounded-[16px] bg-surface-secondary/50 p-5">
                <p className="font-mono text-[11px] font-semibold text-accent">3</p>
                <p className="mt-2 text-[15px] font-semibold">Click Allow</p>
                <p className="mt-1 text-[14px] leading-[1.6] text-secondary">Your agent can read your Trace brief. It can’t change anything, and it refreshes its access on its own.</p>
              </li>
            </ol>
            <div className="mt-6 flex gap-3 rounded-[16px] p-5 ring-1 ring-accent/30">
              <Mail size={18} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[14px] leading-[1.7] text-secondary"><strong className="text-foreground">You also get the daily brief by email.</strong> Connecting sends you Trace’s morning brief around 9:30am UK time. Unsubscribe from any email and your agent keeps access. If you unsubscribed before, connecting doesn’t sign you up again.</p>
            </div>
            <p className="mt-5 text-[13px] text-secondary">To disconnect, remove Trace from your app.</p>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8" id="tools">
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
            <div className="rounded-[20px] bg-surface p-7 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-8">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Then just ask</h2>
              <p className="mt-2 text-[14px] leading-[1.7] text-secondary">“What happened in tech today?” “Any new open-source tools worth a look?” Your agent picks the tool. All four are read-only and return up to 20 items.</p>
              <ul className="mt-5 space-y-3">
                {tools.map(([name, description]) => (
                  <li key={name} className="text-[14px] leading-[1.6]">
                    <code className="font-mono text-[12.5px] font-semibold">{name}</code>
                    <span className="block text-secondary">{description}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[20px] bg-surface p-7 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-8" id="skill">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">A skill for personal agents</h2>
              <p className="mt-2 text-[14px] leading-[1.7] text-secondary">Teach a personal agent when and how to fetch your brief. The skill works in Claude Code and any agent that reads <code className="font-mono text-[12.5px]">SKILL.md</code> files.</p>
              <div className="mt-5 overflow-hidden rounded-[12px] bg-[#151923] ring-1 ring-white/10">
                <pre className="overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere] p-4 font-mono text-[11.5px] leading-[1.7]" style={{ color: '#F2F5F9' }}>{skillInstall}</pre>
              </div>
              <p className="mt-3 text-[13px]"><Link href="/agents/skill.md" className="font-semibold text-accent">Read the skill file</Link></p>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8" id="agent-key">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent"><KeyRound size={13} />Advanced</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.03em]">Header-based access with an Agent Key</h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-[1.7] text-secondary">For bots, scripts and clients that can’t open a sign-in page. Send the key as <code className="font-mono text-[13px]">Authorization: Bearer …</code> to the MCP server or the HTTPS brief endpoint. The URL above doesn’t need one.</p>
            </div>
            <AgentAccessManager />
            <details className="mt-6 rounded-[18px] bg-surface px-6 py-5 ring-1 ring-foreground/7 dark:ring-white/10">
              <summary className="cursor-pointer text-[15px] font-semibold">Configs that use an Agent Key</summary>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <CodeCard icon={Terminal} title="Codex" code={codexKeyCommand} />
                <CodeCard icon={Braces} title="MCP clients with headers" code={headerConfig} />
                <CodeCard icon={Braces} title="Custom agents and bots (HTTPS)" code={restExample} />
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
                <ul className="mt-3 space-y-2 text-[14px] text-secondary"><li>Changing your Trace account</li><li>Publishing, purchasing, or writing data</li><li>Access after the key is revoked</li></ul>
              </div>
            </div>
            <p className="mt-7 text-[13px] text-secondary">Machine-readable setup notes: <Link href="/agents/llms.txt" className="font-semibold text-accent">/agents/llms.txt</Link> · <Link href="/privacy-policy" className="font-semibold text-accent">Privacy policy</Link></p>
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
