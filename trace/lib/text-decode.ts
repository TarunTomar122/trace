import he from 'he';

export function decodeHtmlEntities(value?: string | null): string {
  const decoded = he.decode(String(value || ''));
  return decoded.replace(/\u00a0/g, ' ');
}

