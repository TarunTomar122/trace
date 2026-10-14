import type { NextRequest } from 'next/server';
import { authorizationServerMetadata, oauthOrigin } from '@/lib/oauth-config';
import { corsPreflight, publicMetadataJson } from '@/lib/oauth-http';

// RFC 8414 authorization server metadata for the MCP sign-in.
export function GET(request: NextRequest) {
  return publicMetadataJson(authorizationServerMetadata(oauthOrigin(request.nextUrl.origin)));
}

export function OPTIONS() {
  return corsPreflight();
}
