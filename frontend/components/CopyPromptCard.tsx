'use client';

import { useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';

const AGENT_PROMPT = `Add the Trace MCP server for me.

1. Add a remote MCP server named "trace" with URL https://www.yourtrace.online/api/mcp (Streamable HTTP), using my client's native MCP setup.
2. There is no API key: Trace uses OAuth. When the connection needs it, I'll sign in with Google in my browser and click Allow.
3. Verify it works by fetching today's top 3 tech stories from Trace and summarizing each in one line.

Notes: the server is read-only. Machine-readable setup docs: https://www.yourtrace.online/agents/llms.txt`;

export default function CopyPromptCard() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = AGENT_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-[18px] bg-surface p-6 ring-1 ring-foreground/7 dark:ring-white/10 sm:p-8">
      <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        <Sparkles size={13} /> Coding agents
      </p>
      <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.02em]">
        Or let your agent add Trace itself.
      </h3>
      <p className="mt-2 text-[14px] leading-[1.7] text-secondary">
        Paste this into Claude Code, Codex, Cursor or Gemini CLI. It adds the server; you sign in once when it connects.
      </p>
      <pre
        className="mt-5 overflow-x-auto whitespace-pre-wrap rounded-[12px] bg-[#151923] p-5 font-mono text-[12.5px] leading-[1.75]"
        style={{ color: '#F2F5F9' }}
      >
        {AGENT_PROMPT}
      </pre>
      <button
        onClick={copy}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[14px] font-semibold text-background transition-opacity hover:opacity-85"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? 'Copied' : 'Copy prompt'}
      </button>
    </div>
  );
}
