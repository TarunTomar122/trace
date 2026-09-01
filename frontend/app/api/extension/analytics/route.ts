import { NextRequest, NextResponse } from 'next/server';
import { captureServerEvent } from '@/lib/posthog-server';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const EVENT_PROPERTIES: Record<string, Set<string>> = {
  extension_installed: new Set(['extension_version']),
  extension_updated: new Set(['extension_version', 'previous_version']),
  extension_feed_viewed: new Set(['article_count', 'cache_state', 'extension_version', 'has_account', 'has_pro']),
  extension_filter_changed: new Set(['filter']),
  extension_story_opened: new Set(['story_id', 'tag', 'has_pro']),
  extension_story_bookmarked: new Set(['story_id', 'tag', 'action']),
  extension_story_shared: new Set(['story_id', 'tag']),
  extension_source_opened: new Set(['story_id', 'tag']),
  extension_sign_in_clicked: new Set([]),
  extension_checkout_clicked: new Set([]),
};

function cleanProperties(event: string, value: unknown) {
  const allowed = EVENT_PROPERTIES[event];
  if (!allowed || !value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => (
    allowed.has(key)
    && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
    && (typeof item !== 'string' || item.length <= 100)
  )));
}

export async function POST(request: NextRequest) {
  const text = await request.text();
  if (text.length > 2_048) return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: HEADERS });

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Invalid payload');
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: HEADERS });
  }

  const event = typeof body.event === 'string' ? body.event : '';
  const distinctId = typeof body.distinctId === 'string' ? body.distinctId : '';
  if (!EVENT_PROPERTIES[event] || !/^ext_[0-9a-f-]{36}$/.test(distinctId)) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400, headers: HEADERS });
  }

  await captureServerEvent(distinctId, event, {
    product: 'trace_chrome_extension',
    ...cleanProperties(event, body.properties),
  });
  return new NextResponse(null, { status: 202, headers: HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
