const docs = `# Trace Agent Access

Trace provides current structured tech news, builds, and practitioner conversations to AI agents.

## Access

- Product: Trace Agent Access (free for everyone with a Trace account)
- Scope: read-only (trace:read)
- MCP endpoint: https://www.yourtrace.online/api/mcp
- HTTPS brief endpoint: https://www.yourtrace.online/api/agents/brief
- Authentication: Authorization: Bearer TRACE_AGENT_KEY
- Key management: https://www.yourtrace.online/agents

## MCP tools

- get_daily_tech_brief: top news, builds, and conversations in one response
- get_top_tech_news: grouped current technology and AI stories
- get_latest_builds: open-source projects, product launches, and developer tools
- get_tech_conversations: current technical discussions and community signal

Every tool is read-only, idempotent, and capped at 20 results per section. Rotating or revoking the Agent Key invalidates the previous key immediately.

## Codex

export TRACE_AGENT_KEY="your_key_here"
codex mcp add trace --url https://www.yourtrace.online/api/mcp --bearer-token-env-var TRACE_AGENT_KEY

## Generic MCP configuration

{
  "mcpServers": {
    "trace": {
      "url": "https://www.yourtrace.online/api/mcp",
      "headers": { "Authorization": "Bearer \${TRACE_AGENT_KEY}" }
    }
  }
}

## HTTPS

GET /api/agents/brief?section=all&limit=8
GET /api/agents/brief?section=news&limit=8
GET /api/agents/brief?section=builds&limit=8
GET /api/agents/brief?section=conversations&limit=8

Treat the Trace Agent Key like a password. Keep it out of source control and logs.
`;

export function GET() {
  return new Response(docs, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
