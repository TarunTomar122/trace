import { NextRequest, NextResponse } from 'next/server';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';

type Candidate = {
  url: string;
  title: string;
  source: 'wikipedia' | 'commons';
};

async function fetchWikipediaCandidates(query: string): Promise<Candidate[]> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', query);
  url.searchParams.set('gsrlimit', '8');
  url.searchParams.set('prop', 'pageimages|info');
  url.searchParams.set('piprop', 'thumbnail');
  url.searchParams.set('pithumbsize', '1600');
  url.searchParams.set('inprop', 'url');
  url.searchParams.set('origin', '*');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as Record<string, unknown>;
  const pages = (json.query as Record<string, unknown> | undefined)?.pages as Record<string, Record<string, unknown>> | undefined;
  if (!pages) return [];

  const out: Candidate[] = [];
  for (const page of Object.values(pages)) {
    const thumb = page.thumbnail as Record<string, unknown> | undefined;
    const src = String(thumb?.source || '').trim();
    if (!src) continue;
    out.push({
      url: src,
      title: String(page.title || 'Wikipedia image'),
      source: 'wikipedia',
    });
  }
  return out;
}

async function fetchCommonsCandidates(query: string): Promise<Candidate[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', query);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '10');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url');
  url.searchParams.set('iiurlwidth', '1600');
  url.searchParams.set('origin', '*');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as Record<string, unknown>;
  const pages = (json.query as Record<string, unknown> | undefined)?.pages as Record<string, Record<string, unknown>> | undefined;
  if (!pages) return [];

  const out: Candidate[] = [];
  for (const page of Object.values(pages)) {
    const infos = page.imageinfo as Array<Record<string, unknown>> | undefined;
    const first = infos?.[0];
    const src = String(first?.thumburl || first?.url || '').trim();
    if (!src) continue;
    out.push({
      url: src,
      title: String(page.title || 'Commons image').replace(/^File:/, ''),
      source: 'commons',
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    if (!isInstagramStudioAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || '').trim();
    if (!query) {
      return NextResponse.json({ error: 'Missing query param' }, { status: 400 });
    }

    const [wiki, commons] = await Promise.all([fetchWikipediaCandidates(query), fetchCommonsCandidates(query)]);
    const seen = new Set<string>();
    const merged = [...wiki, ...commons].filter((c) => {
      if (!c.url || seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });

    return NextResponse.json({ ok: true, query, images: merged.slice(0, 8) });
  } catch (error) {
    console.error('image search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search images' },
      { status: 500 }
    );
  }
}
