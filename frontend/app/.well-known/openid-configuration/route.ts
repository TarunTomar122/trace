import type { NextRequest } from 'next/server';
import { authorizationServerMetadata, oauthOrigin } from '@/lib/oauth-config';
import { corsPreflight, publicMetadataJson } from '@/lib/oauth-http';

// Some MCP clients look for OpenID discovery when OAuth metadata is missing.
// Trace issues no ID tokens; this is the same OAuth metadata for them.
export function GET(request: NextRequest) {
  return publicMetadataJson(authorizationServerMetadata(oauthOrigin(request.nextUrl.origin)));
}

export function OPTIONS() {
  return corsPreflight();
}
