import type { Metadata } from 'next';
import Link from 'next/link';
import { Bot, Braces, Check, Clipboard, KeyRound, LogIn, Mail, MessageSquareText, ShieldCheck, Terminal, Wrench, X } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import HpJoinBox from '@/components/HpJoinBox';
import AgentAccessManager from '@/components/AgentAccessManager';
import AgentConnectGuide, { McpUrlBox } from '@/components/AgentConnectGuide';
import CopyPromptCard from '@/components/CopyPromptCard';
import { HandArrow } from '@/components/feed-v2/home-art';
import { AuthProvider } from '@/contexts/AuthContext';
import { HOME_CSS } from '@/lib/home-css';
import { AGENTS_CSS } from '@/lib/agents-css';
import { HOME_FONT_VARS } from '@/lib/home-fonts';

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

const skillInstall = `mkdir -p ~/.claude/skills/trace-tech-brief
curl -fsSL -o ~/.claude/skills/trace-tech-brief/SKILL.md \\
  https://www.yourtrace.online/agents/skill.md`;

const IN_SHORT = [
  { title: 'Paste the URL', body: 'Into any MCP client that supports remote servers.' },
  { title: 'Sign in once', body: 'With Google, then click Allow. No key to copy.' },
  { title: 'Just ask', body: '“What happened in tech today?” Your agent picks the tool.' },
];

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
    <div className={`hp ag ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{AGENTS_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <PublicHeader subscribeHref="#join" />
      <AuthProvider>
      <main>
        <div className="hp-top">
          <section className="hp-hero">
            <p className="ag-eyebrow"><Bot size={17} strokeWidth={2} aria-hidden="true" /> Trace for agents · Free</p>
            <h1 className="hp-h1">Your agent should know what tech is doing today.</h1>
            <p className="hp-hero-p">
              Paste one URL into Claude, ChatGPT, Cursor, Claude Code, Codex or Gemini CLI. Sign in with Google, click Allow, and your agent
              reads <strong>today’s top tech stories, notable builds and practitioner conversations</strong>. No key to copy.
            </p>
            <div className="ag-url"><McpUrlBox /></div>
            <ul className="ag-badges">
              <li><ShieldCheck size={16} strokeWidth={2.2} aria-hidden="true" /> Read only</li>
              <li><Check size={16} strokeWidth={2.4} aria-hidden="true" /> Free for everyone</li>
              <li><Bot size={16} strokeWidth={2.2} aria-hidden="true" /> MCP with Google sign-in</li>
            </ul>
          </section>
        </div>

        <section className="hp-how-wrap" aria-labelledby="in-short-title">
          <div className="hp-how">
            <h2 className="hp-hand" id="in-short-title">How it <br />works</h2>
            <HandArrow variant="in" />
            <ol className="hp-how-steps">
              {IN_SHORT.map((step) => (
                <li key={step.title}>
                  <h3 className="hp-how-title">{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <HandArrow variant="down" />
          </div>
        </section>

        <section className="ag-section" id="connect" aria-labelledby="connect-title">
          <div className="ag-head">
            <p className="hp-kicker"><Clipboard size={17} strokeWidth={2} aria-hidden="true" /> Step 1</p>
            <h2 className="hp-h3" id="connect-title">Paste the URL into your app</h2>
            <p>Any MCP client that supports remote servers works. Most take just the URL: <code>https://www.yourtrace.online/api/mcp</code></p>
          </div>
          <div className="ag-panel ag-panel-cyan">
            <AgentConnectGuide />
            <CopyPromptCard />
          </div>
        </section>

        <section className="ag-section" id="sign-in" aria-labelledby="sign-in-title">
          <div className="ag-head">
            <p className="hp-kicker"><LogIn size={17} strokeWidth={2} aria-hidden="true" /> Step 2</p>
            <h2 className="hp-h3" id="sign-in-title">Sign in once</h2>
          </div>
          <ol className="ag-signin">
            <li>
              <p className="ag-step-num" aria-hidden="true">1</p>
              <p className="ag-step-title">Your app opens a Trace page</p>
              <p className="ag-step-body">The first time it connects, in your browser.</p>
            </li>
            <li>
              <p className="ag-step-num" aria-hidden="true">2</p>
              <p className="ag-step-title">Sign in with Google</p>
              <p className="ag-step-body">New to Trace? That creates your free account.</p>
            </li>
            <li>
              <p className="ag-step-num" aria-hidden="true">3</p>
              <p className="ag-step-title">Click Allow</p>
              <p className="ag-step-body">Your agent can read your Trace brief. It can’t change anything, and it refreshes its access on its own.</p>
            </li>
          </ol>
          <div className="ag-mail">
            <Mail size={18} aria-hidden="true" />
            <p><strong>You can also get the daily brief by email.</strong> The Allow page has a box, ticked by default, that sends you Trace’s morning brief around 9:30am UK time. Unsubscribe from any email and your agent keeps access. If your daily email is off, connecting leaves it off.</p>
          </div>
          <p className="ag-fine">To disconnect, remove Trace from your app, which deletes its sign-in there. Access tokens last an hour, and a sign-in that goes unused for 90 days stops working.</p>
        </section>

        <section className="ag-section" id="tools" aria-labelledby="tools-title">
          <div className="ag-row">
            <div>
              <p className="hp-kicker"><MessageSquareText size={17} strokeWidth={2} aria-hidden="true" /> Tools</p>
              <h2 className="hp-h3" id="tools-title">Then just ask</h2>
              <p className="ag-lede">
                “What happened in tech today?” “Any new open-source tools worth a look?” Your agent picks the tool. All four are read-only and return up to 20 items.
              </p>
              <ul className="ag-tools">
                {tools.map(([name, description]) => (
                  <li key={name}>
                    <code>{name}</code>
                    <span>{description}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ag-panel ag-panel-green">
              <div className="ag-card" id="skill">
                <h3>A skill for personal agents</h3>
                <p>Teach a personal agent when and how to fetch your brief. The skill works in Claude Code and any agent that reads <code>SKILL.md</code> files.</p>
                <div className="ag-code"><pre>{skillInstall}</pre></div>
                <Link href="/agents/skill.md" className="ag-link">Read the skill file</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="ag-section" id="agent-key" aria-labelledby="agent-key-title">
          <div className="ag-head">
            <p className="hp-kicker"><KeyRound size={17} strokeWidth={2} aria-hidden="true" /> Advanced</p>
            <h2 className="hp-h3" id="agent-key-title">Header-based access with an Agent Key</h2>
            <p>For bots, scripts and clients that can’t open a sign-in page. Send the key as <code>Authorization: Bearer …</code> to the MCP server or the HTTPS brief endpoint. The URL above doesn’t need one.</p>
          </div>
          <div className="ag-panel ag-panel-gray">
            <AgentAccessManager />
          </div>
          <details className="ag-configs">
            <summary>Configs that use an Agent Key</summary>
            <div className="ag-configs-grid">
              <CodeCard icon={Terminal} title="Codex" code={codexKeyCommand} />
              <CodeCard icon={Braces} title="MCP clients with headers" code={headerConfig} />
              <CodeCard icon={Braces} title="Custom agents and bots (HTTPS)" code={restExample} />
              <div className="ag-channels">
                <p className="hp-kicker"><Wrench size={16} strokeWidth={2} aria-hidden="true" /> Delivery channels</p>
                <h3>Telegram, WhatsApp, Discord, Slack</h3>
                <p>Trace supplies the intelligence. Your bot or agent decides where to send it. Any system that can call MCP or HTTPS can fetch the brief and post it into the channel you already use.</p>
              </div>
            </div>
          </details>
        </section>

        <section className="ag-section" aria-labelledby="access-title">
          <div className="ag-head">
            <p className="hp-kicker"><ShieldCheck size={17} strokeWidth={2} aria-hidden="true" /> Permissions</p>
            <h2 className="hp-h3" id="access-title">What the connection can access</h2>
          </div>
          <div className="ag-access">
            <div>
              <h3>Allowed</h3>
              <ul>
                <li><Check size={17} strokeWidth={2.4} className="ag-yes" aria-hidden="true" />Today’s structured Trace feed</li>
                <li><Check size={17} strokeWidth={2.4} className="ag-yes" aria-hidden="true" />Grouped news, builds, and conversations</li>
                <li><Check size={17} strokeWidth={2.4} className="ag-yes" aria-hidden="true" />Summaries, takeaways, timestamps, and source links</li>
              </ul>
            </div>
            <div>
              <h3>Never allowed</h3>
              <ul>
                <li><X size={17} strokeWidth={2.4} className="ag-no" aria-hidden="true" />Changing your Trace account</li>
                <li><X size={17} strokeWidth={2.4} className="ag-no" aria-hidden="true" />Publishing, purchasing, or writing data</li>
                <li><X size={17} strokeWidth={2.4} className="ag-no" aria-hidden="true" />Access after the key is revoked</li>
              </ul>
            </div>
          </div>
          <p className="ag-text">Machine-readable setup notes: <Link href="/agents/llms.txt">/agents/llms.txt</Link> · <Link href="/privacy-policy">Privacy policy</Link></p>
        </section>

        <HpJoinBox heading="Want the brief in your inbox too?" source="agents" />
      </main>
      </AuthProvider>
      <Footer variant="landing" />
    </div>
  );
}

function CodeCard({ icon: Icon, title, code }: { icon: typeof Terminal; title: string; code: string }) {
  return (
    <div className="ag-codecard">
      <p><Icon size={13} aria-hidden="true" />{title}</p>
      <pre>{code}</pre>
    </div>
  );
}
