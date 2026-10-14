"use client";

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { TRACE_MCP_URL } from '@/lib/oauth-config';

const cursorConfig = `{
  "mcpServers": {
    "trace": {
      "url": "${TRACE_MCP_URL}"
    }
  }
}`;

// Cursor's one-click install link: the server config, base64-encoded.
const cursorInstallLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=trace&config=${encodeURIComponent(btoa(JSON.stringify({ url: TRACE_MCP_URL })))}`;

type ClientGuide = {
  name: string;
  note?: string;
  steps?: string[];
  code?: string;
  after?: string;
  link?: { href: string; label: string };
};

const guides: ClientGuide[] = [
  {
    name: 'Claude',
    note: 'Web and desktop',
    steps: [
      'Open Connectors: Customize in the sidebar, or Settings → Connectors on some versions.',
      'Click + Add, then “Add custom connector”.',
      'Name it Trace, paste the URL and click Continue.',
    ],
    code: TRACE_MCP_URL,
  },
  {
    name: 'ChatGPT',
    note: 'Paid plans, developer mode',
    steps: [
      'Turn on Developer mode: Settings → Security and login (older versions: Settings → Apps → Advanced settings).',
      'Open Plugins (or Apps) and click + or Create.',
      'Name it Trace, paste the URL and click Create.',
    ],
    code: TRACE_MCP_URL,
  },
  {
    name: 'Claude Code',
    code: `claude mcp add --transport http trace ${TRACE_MCP_URL}`,
    after: 'Then run /mcp, pick trace and sign in.',
  },
  {
    name: 'Cursor',
    note: '~/.cursor/mcp.json',
    code: cursorConfig,
    link: { href: cursorInstallLink, label: 'Or add to Cursor in one click' },
  },
  {
    name: 'Codex',
    code: `codex mcp add trace --url ${TRACE_MCP_URL}`,
    after: 'If no browser opens, run codex mcp login trace.',
  },
  {
    name: 'Gemini CLI',
    code: `gemini mcp add --transport http trace ${TRACE_MCP_URL}`,
    after: 'If it asks, run /mcp auth trace inside Gemini CLI.',
  },
];

function CopyButton({ value, label = 'Copy', dark = false }: { value: string; label?: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-85 ${dark ? 'bg-white/10 text-white' : 'bg-foreground text-background'}`}
      aria-label={`${label}: ${value.length > 60 ? `${value.slice(0, 60)}…` : value}`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** The one thing to copy: the MCP server URL. */
export function McpUrlBox() {
  return (
    <div className="flex max-w-2xl flex-wrap items-center gap-3 rounded-[16px] bg-background px-4 py-3 ring-1 ring-foreground/10 dark:ring-white/15">
      <code className="min-w-0 flex-1 break-all font-mono text-[14px] font-semibold sm:text-[15px]">{TRACE_MCP_URL}</code>
      <CopyButton value={TRACE_MCP_URL} label="Copy URL" />
    </div>
  );
}

export default function AgentConnectGuide() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {guides.map((guide) => (
        <div key={guide.name} className="flex flex-col rounded-[18px] bg-surface p-6 ring-1 ring-foreground/7 dark:ring-white/10">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[18px] font-semibold tracking-[-0.02em]">{guide.name}</h3>
            {guide.note ? <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">{guide.note}</span> : null}
          </div>
          {guide.steps ? (
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[14px] leading-[1.6] text-secondary">
              {guide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          ) : null}
          {guide.code ? (
            <div className="mt-4 overflow-hidden rounded-[12px] bg-[#151923] ring-1 ring-white/10">
              <div className="flex justify-end px-3 pt-3"><CopyButton value={guide.code} dark /></div>
              <pre className="overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere] px-4 pb-4 pt-2 font-mono text-[11.5px] leading-[1.7]" style={{ color: '#F2F5F9' }}>{guide.code}</pre>
            </div>
          ) : null}
          {guide.after ? <p className="mt-3 text-[13px] leading-[1.6] text-secondary">{guide.after}</p> : null}
          {guide.link ? <a href={guide.link.href} className="mt-3 text-[13px] font-semibold text-accent">{guide.link.label}</a> : null}
        </div>
      ))}
    </div>
  );
}
