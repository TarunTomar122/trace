import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';

const DEFAULT_GRAPH_VERSION = 'v23.0';

type PublishBody = {
  uid?: string;
  tag?: string;
  headline?: string;
  caption?: string;
  imageUrl?: string;
  format?: 'square' | 'portrait' | 'story';
  accessToken?: string;
  igUserId?: string;
  pageId?: string;
};

function baseUrlFromRequest(request: NextRequest): string {
  const forcedBaseUrl = (process.env.INSTAGRAM_RENDER_BASE_URL || '').trim();
  if (forcedBaseUrl) return forcedBaseUrl.replace(/\/+$/, '');

  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

async function renderAndUploadToFirebase(imageRenderUrl: string, fileKey: string): Promise<string> {
  if (!adminStorage) {
    throw new Error('Firebase Storage is not configured');
  }

  const renderRes = await fetch(imageRenderUrl, { method: 'GET', cache: 'no-store' });
  if (!renderRes.ok) {
    throw new Error(`Failed to render image (${renderRes.status})`);
  }
  const contentType = renderRes.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await renderRes.arrayBuffer());

  const bucket = adminStorage.bucket();
  const objectPath = `instagram-posts/devstudio/${fileKey}.png`;
  const file = bucket.file(objectPath);
  await file.save(bytes, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    version: 'v4',
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  return signedUrl;
}

async function resolveInstagramIds(accessToken: string, pageIdHint?: string | null): Promise<{ igUserId: string; pageId?: string }> {
  const version = process.env.INSTAGRAM_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;

  if (pageIdHint) {
    const pageUrl = `https://graph.facebook.com/${version}/${encodeURIComponent(pageIdHint)}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`;
    const pageRes = await fetch(pageUrl, { method: 'GET', cache: 'no-store' });
    const pageJson = await pageRes.json();
    const igId = pageJson?.instagram_business_account?.id;
    if (pageRes.ok && igId) {
      return { igUserId: String(igId), pageId: String(pageIdHint) };
    }
  }

  const pagesUrl = `https://graph.facebook.com/${version}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`;
  const pagesRes = await fetch(pagesUrl, { method: 'GET', cache: 'no-store' });
  const pagesJson = await pagesRes.json();
  if (!pagesRes.ok) {
    throw new Error(pagesJson?.error?.message || 'Failed to fetch Facebook pages');
  }

  const page = (pagesJson?.data || []).find((p: Record<string, unknown>) => {
    const ig = p?.instagram_business_account as Record<string, unknown> | undefined;
    return !!ig?.id;
  });

  if (!page?.instagram_business_account?.id) {
    throw new Error('No instagram_business_account found for this token');
  }

  return {
    igUserId: String(page.instagram_business_account.id),
    pageId: String(page.id || ''),
  };
}

async function createContainer(igUserId: string, accessToken: string, caption: string, imageUrl: string): Promise<string> {
  const version = process.env.INSTAGRAM_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(igUserId)}/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }).toString(),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json?.id) {
    throw new Error(json?.error?.message || 'Failed to create media container');
  }
  return String(json.id);
}

async function publishContainer(igUserId: string, accessToken: string, creationId: string): Promise<string> {
  const version = process.env.INSTAGRAM_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(igUserId)}/media_publish`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    }).toString(),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json?.id) {
    throw new Error(json?.error?.message || 'Failed to publish media');
  }
  return String(json.id);
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = (await request.json()) as PublishBody;
    const headline = (body.headline || '').trim();
    const caption = (body.caption || '').trim();
    const tag = (body.tag || 'AI NEWS').trim().toUpperCase();
    const sourceImageUrl = (body.imageUrl || '').trim();
    const format = (body.format || 'square').trim().toLowerCase();
    const fallbackAccessToken = (process.env.INSTAGRAM_ACCESS_TOKEN_DEV || '').trim();
    const fallbackIgUserId = (process.env.INSTAGRAM_IG_USER_ID_DEV || '').trim();
    const fallbackPageId = (process.env.INSTAGRAM_PAGE_ID_DEV || '').trim();
    const accessToken = (body.accessToken || fallbackAccessToken).trim();
    const providedIgUserId = (body.igUserId || fallbackIgUserId).trim();
    const providedPageId = (body.pageId || fallbackPageId).trim();

    if (!headline || !caption || !accessToken) {
      return NextResponse.json(
        {
          error:
            'headline and caption are required, plus access token. Set INSTAGRAM_ACCESS_TOKEN_DEV in env (or pass accessToken explicitly).',
        },
        { status: 400 }
      );
    }

    const ids = providedIgUserId
      ? { igUserId: providedIgUserId, pageId: providedPageId || undefined }
      : await resolveInstagramIds(accessToken, providedPageId || null);
    const baseUrl = baseUrlFromRequest(request);
    const renderParams = new URLSearchParams({
      tag,
      headline,
      imageUrl: sourceImageUrl,
      format,
      t: String(Date.now()),
    });
    const renderSecret = (process.env.INSTAGRAM_RENDER_SECRET || '').trim();
    if (renderSecret) {
      renderParams.set('key', renderSecret);
    }

    const renderUrl = `${baseUrl}/api/dev/instagram/studio/render?${renderParams.toString()}`;
    const fileKey = `${Date.now()}_${format}_${Math.random().toString(36).slice(2, 8)}`;
    const finalImageUrl = await renderAndUploadToFirebase(renderUrl, fileKey);

    const creationId = await createContainer(ids.igUserId, accessToken, caption, finalImageUrl);
    const mediaId = await publishContainer(ids.igUserId, accessToken, creationId);

    return NextResponse.json({
      ok: true,
      creationId,
      mediaId,
      igUserId: ids.igUserId,
      imageUrl: finalImageUrl,
    });
  } catch (error) {
    console.error('instagram studio publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish to Instagram' },
      { status: 500 }
    );
  }
}
