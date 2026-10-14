import { NextRequest, NextResponse } from 'next/server';
import { buildAgentBrief } from '@/lib/agent-brief';
import { getFeedForUid } from '@/lib/feed-server';
import { authenticateMcpRequest } from '@/lib/mcp-auth';
import { oauthOrigin, protectedResourceMetadataUrl } from '@/lib/oauth-config';
import { corsPreflight, OAUTH_CORS_HEADERS } from '@/lib/oauth-http';

const MCP_PROTOCOL_VERSION = '2025-06-18';

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: {
    name?: string;
    arguments?: { limit?: number; role?: string };
  };
};

const tools = [
  {
    name: 'get_daily_tech_brief',
    description: 'Get one structured briefing containing today’s top tech news, notable builds, and practitioner conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
        role: { type: 'string', description: 'Optional role lens such as developer, founder, designer, or product manager.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_top_tech_news',
    description: 'Get the top current technology and AI stories, grouped across sources with summaries and key takeaways.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
        role: { type: 'string' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_latest_builds',
    description: 'Get current open-source projects, product launches, and developer tools surfaced by Trace.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
        role: { type: 'string' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_tech_conversations',
    description: 'Get current technical discussions and community conversations worth paying attention to.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 8 },
        role: { type: 'string' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
] as const;

function rpc(id: JsonRpcRequest['id'], result: unknown, status = 200) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result }, { status, headers: OAUTH_CORS_HEADERS });
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string, status = 200) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  }, { status, headers: OAUTH_CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const origin = oauthOrigin(request.nextUrl.origin);
    const access = await authenticateMcpRequest(request.headers.get('authorization'), origin);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        {
          status: access.status,
          headers: { ...OAUTH_CORS_HEADERS, 'WWW-Authenticate': access.wwwAuthenticate },
        },
      );
    }

    const message = await request.json().catch(() => null) as JsonRpcRequest | null;
    if (!message || message.jsonrpc !== '2.0' || !message.method) {
      return rpcError(message?.id, -32600, 'Invalid JSON-RPC request', 400);
    }

    if (message.method === 'initialize') {
      return rpc(message.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'Trace', version: '1.0.0' },
        instructions: 'Use Trace for current structured tech news, builds, and conversations. All tools are read-only.',
      });
    }
    if (message.method === 'notifications/initialized') {
      return new NextResponse(null, { status: 202, headers: OAUTH_CORS_HEADERS });
    }
    if (message.method === 'ping') return rpc(message.id, {});
    if (message.method === 'tools/list') return rpc(message.id, { tools });
    if (message.method !== 'tools/call') {
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
    }

    const toolName = message.params?.name || '';
    if (!tools.some((tool) => tool.name === toolName)) {
      return rpcError(message.id, -32602, `Unknown tool: ${toolName}`);
    }
    const args = message.params?.arguments || {};
    const feed = await getFeedForUid(access.uid, typeof args.role === 'string' ? args.role : '');
    if (!feed) return rpcError(message.id, -32004, 'No Trace brief is available yet');
    const brief = buildAgentBrief(feed, Number(args.limit || 8));
    const data = toolName === 'get_top_tech_news'
      ? { feed_date: brief.feed_date, generated_at: brief.generated_at, top_news: brief.top_news }
      : toolName === 'get_latest_builds'
        ? { feed_date: brief.feed_date, generated_at: brief.generated_at, builds: brief.builds }
        : toolName === 'get_tech_conversations'
          ? { feed_date: brief.feed_date, generated_at: brief.generated_at, conversations: brief.conversations }
          : brief;

    return rpc(message.id, {
      content: [{ type: 'text', text: JSON.stringify(data) }],
      structuredContent: data,
      isError: false,
    });
  } catch (error) {
    console.error('[api/mcp] failed:', error);
    return rpcError(null, -32603, 'Trace MCP request failed', 500);
  }
}

export async function GET(request: NextRequest) {
  // Streamable HTTP clients GET for a server-sent event stream; Trace has
  // nothing to push, which the transport spec says to answer with 405.
  if ((request.headers.get('accept') || '').includes('text/event-stream')) {
    return new NextResponse(null, { status: 405, headers: { ...OAUTH_CORS_HEADERS, Allow: 'POST, OPTIONS' } });
  }
  const origin = oauthOrigin(request.nextUrl.origin);
  return NextResponse.json({
    name: 'Trace MCP',
    transport: 'streamable-http',
    authentication: 'OAuth 2.1: your MCP client opens a Trace sign-in page the first time it connects. A Trace Agent Key also works as a Bearer token.',
    resource_metadata: protectedResourceMetadataUrl(origin),
    documentation: `${origin}/agents`,
  }, { headers: OAUTH_CORS_HEADERS });
}

export function OPTIONS() {
  return corsPreflight();
}
