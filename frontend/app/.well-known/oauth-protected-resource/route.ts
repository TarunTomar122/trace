import type { NextRequest } from 'next/server';
import { oauthOrigin, protectedResourceMetadata } from '@/lib/oauth-config';
import { corsPreflight, publicMetadataJson } from '@/lib/oauth-http';

// RFC 9728 protected resource metadata. The MCP endpoint's own path variant
// (/api/mcp) is what its 401 points at; this root copy serves older clients.
export function GET(request: NextRequest) {
  return publicMetadataJson(protectedResourceMetadata(oauthOrigin(request.nextUrl.origin)));
}

export function OPTIONS() {
  return corsPreflight();
}
