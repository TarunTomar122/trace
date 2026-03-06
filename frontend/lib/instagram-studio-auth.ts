import { NextRequest } from 'next/server';

export function isInstagramStudioAuthorized(request: NextRequest): boolean {
  const configuredKey = (process.env.INSTAGRAM_STUDIO_ACCESS_KEY || '').trim();

  // Backward-compatible local dev: allow if no key is configured.
  if (!configuredKey) return process.env.NODE_ENV === 'development';

  const headerKey = (request.headers.get('x-studio-key') || '').trim();
  if (headerKey && headerKey === configuredKey) return true;

  const queryKey = (new URL(request.url).searchParams.get('key') || '').trim();
  return !!queryKey && queryKey === configuredKey;
}

