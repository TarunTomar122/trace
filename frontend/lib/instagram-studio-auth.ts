import { NextRequest } from 'next/server';

function normalizeKey(value: string): string {
  return value
    .replace(/^["']+|["']+$/g, '')
    .replace(/\r?\n/g, '')
    .trim();
}

export function isInstagramStudioAuthorized(request: NextRequest): boolean {
  const configuredKey = normalizeKey(process.env.INSTAGRAM_STUDIO_ACCESS_KEY || '');

  // Backward-compatible local dev: allow if no key is configured.
  if (!configuredKey) return process.env.NODE_ENV === 'development';

  const headerKey = normalizeKey(request.headers.get('x-studio-key') || '');
  if (headerKey && headerKey === configuredKey) return true;

  const queryKey = normalizeKey(new URL(request.url).searchParams.get('key') || '');
  return !!queryKey && queryKey === configuredKey;
}
