import type { NextRequest } from 'next/server';
import { oauthOrigin, protectedResourceMetadata } from '@/lib/oauth-config';
import { corsPreflight, publicMetadataJson } from '@/lib/oauth-http';

// RFC 9728 §3.1: metadata for https://www.yourtrace.online/api/mcp lives at
// the well-known path with the resource path appended.
export function GET(request: NextRequest) {
  return publicMetadataJson(protectedResourceMetadata(oauthOrigin(request.nextUrl.origin)));
}

export function OPTIONS() {
  return corsPreflight();
}
