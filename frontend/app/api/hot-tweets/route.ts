import { NextResponse } from 'next/server';

export const revalidate = 10800;

export type HotTweet = {
  id: string;
  title: string;
  url: string;
  description: string;
  pubDate: string;
  category: string;
};

function extractTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'is').exec(xml);
  return match?.[1]?.trim() || '';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function toIsoDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    if (Number.isNaN(d.getTime())) return pubDate;
    return d.toISOString();
  } catch {
    return pubDate;
  }
}

export async function GET() {
  try {
    const res = await fetch('https://alignednews.com/feed.xml', {
      headers: { 'User-Agent': 'TraceHotTweets/1.0 (+https://trace.app)' },
      next: { revalidate: 10800 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { items: [], error: `Upstream returned ${res.status}` },
        { status: 502 },
      );
    }

    const xml = await res.text();
    const items: HotTweet[] = [];

    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    for (const block of itemBlocks) {
      const title = extractTag(block, 'title');
      const link = extractTag(block, 'link');
      const description = extractTag(block, 'description');
      const pubDate = extractTag(block, 'pubDate');
      const category = extractTag(block, 'category');

      if (!title || !link) continue;

      items.push({
        id: Buffer.from(link).toString('base64url').slice(0, 14),
        title: decodeHtmlEntities(title),
        url: link,
        description: decodeHtmlEntities(description),
        pubDate: toIsoDate(pubDate),
        category,
      });
    }

    items.sort((a, b) => {
      const ta = new Date(a.pubDate).getTime();
      const tb = new Date(b.pubDate).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    return NextResponse.json(
      { items: items.slice(0, 24) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=3600',
        },
      },
    );
  } catch (error) {
    console.error('[api/hot-tweets] Error:', error);
    return NextResponse.json(
      { items: [], error: 'Internal error' },
      { status: 500 },
    );
  }
}
