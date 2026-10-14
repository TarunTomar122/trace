const docs = `# Trace for AI agents

Trace provides current structured tech news, builds, and practitioner conversations to AI agents through a read-only MCP server.

## Connect

- MCP endpoint: https://www.yourtrace.online/api/mcp (Streamable HTTP)
- Authentication: OAuth 2.1 with PKCE. No API key: the first time a client connects, it opens a Trace sign-in page; the reader signs in with Google and clicks Allow.
- The approval page also offers Trace's daily brief email (ticked by default; unsubscribe any time; agent access continues). If the reader's daily email is off, connecting leaves it off.
- Scope: read-only (trace:read). Free for everyone.
- Setup guide for each client: https://www.yourtrace.online/agents

## Client setup

- Claude (web and desktop): Customize > Connectors > + Add > Add custom connector, paste the URL.
- ChatGPT (developer mode): Settings > Security and login > Developer mode on, then Plugins > +, paste the URL.
- Claude Code: claude mcp add --transport http trace https://www.yourtrace.online/api/mcp (then /mcp to sign in)
- Codex: codex mcp add trace --url https://www.yourtrace.online/api/mcp (codex mcp login trace if no browser opens)
- Gemini CLI: gemini mcp add --transport http trace https://www.yourtrace.online/api/mcp
- Cursor and most other clients:

{
  "mcpServers": {
    "trace": { "url": "https://www.yourtrace.online/api/mcp" }
  }
}

## MCP tools

- get_daily_tech_brief: top news, builds, and conversations in one response
- get_top_tech_news: grouped current technology and AI stories
- get_latest_builds: open-source projects, product launches, and developer tools
- get_tech_conversations: current technical discussions and community signal

Every tool is read-only, idempotent, and capped at 20 results per section. Arguments: limit (1-20, default 8), role (optional lens such as developer, founder, designer, product manager).

## For client developers

- Protected resource metadata (RFC 9728): https://www.yourtrace.online/.well-known/oauth-protected-resource/api/mcp
- Authorization server metadata (RFC 8414): https://www.yourtrace.online/.well-known/oauth-authorization-server
- Client registration: Client ID Metadata Documents (https client_id URLs) or Dynamic Client Registration (RFC 7591) at /api/oauth/register. Public clients only (token_endpoint_auth_method "none").
- Redirect URIs: https, http on 127.0.0.1 / [::1] / localhost (any port), or a private-use scheme.
- PKCE S256 is required. Access tokens last one hour and are bound to https://www.yourtrace.online/api/mcp; refresh tokens rotate on every use. Revocation (RFC 7009): /api/oauth/revoke.
- Unauthenticated requests get 401 with WWW-Authenticate: Bearer resource_metadata="...".

## Advanced: header-based access (Trace Agent Key)

For bots and scripts that can't open a browser sign-in. Create a key at https://www.yourtrace.online/agents#agent-key and send it as Authorization: Bearer TRACE_AGENT_KEY. Rotating or revoking the key invalidates the previous one immediately.

Codex with a key:
export TRACE_AGENT_KEY="your_key_here"
codex mcp add trace --url https://www.yourtrace.online/api/mcp --bearer-token-env-var TRACE_AGENT_KEY

MCP clients with headers:
{
  "mcpServers": {
    "trace": {
      "url": "https://www.yourtrace.online/api/mcp",
      "headers": { "Authorization": "Bearer \${TRACE_AGENT_KEY}" }
    }
  }
}

HTTPS brief endpoint (Agent Key only):
GET /api/agents/brief?section=all&limit=8
GET /api/agents/brief?section=news&limit=8
GET /api/agents/brief?section=builds&limit=8
GET /api/agents/brief?section=conversations&limit=8

Treat the Trace Agent Key like a password. Keep it out of source control and logs.

## Skill

A SKILL.md for personal agents: https://www.yourtrace.online/agents/skill.md
`;

export function GET() {
  return new Response(docs, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
