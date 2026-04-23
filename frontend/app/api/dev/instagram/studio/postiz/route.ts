import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';

// ── Token cache ────────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours

function getPostizBaseUrl(): string {
  return (process.env.POSTIZ_API_URL || 'https://postiz.yourtrace.online/api').replace(/\/+$/, '');
}

function normalizeSecret(value?: string | null): string {
  return (value || '').replace(/^["']|["']$/g, '').replace(/\r?\n/g, '').trim();
}

async function getPostizToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const baseUrl = getPostizBaseUrl();
  const email = normalizeSecret(process.env.POSTIZ_EMAIL);
  const password = normalizeSecret(process.env.POSTIZ_PASSWORD);

  if (!email || !password) throw new Error('POSTIZ_EMAIL / POSTIZ_PASSWORD env vars not set');

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, provider: 'LOCAL' }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Postiz login failed (${res.status}): ${text}`);
  }

  // JWT is in the `auth` response header
  const token = res.headers.get('auth') || '';
  if (!token) throw new Error('Postiz login returned no auth token');

  cachedToken = token;
  tokenFetchedAt = now;
  console.log('[postiz] logged in, token starts:', token.slice(0, 20));
  return token;
}

type Slide = {
  id: string;
  slideType: 'cover' | 'story';
  style: string;
  headline: string;
  kicker: string;
  body: string;
  imageUrl: string;
  sourceNames: string[];
};

type PostizBody = {
  slides: Slide[];
  caption: string;
  total: number;
  scheduledAt?: string;
};

function baseUrlFromRequest(request: NextRequest): string {
  const forced = normalizeSecret(process.env.INSTAGRAM_RENDER_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '');
  if (forced) return forced.replace(/\/+$/, '');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function buildRenderUrl(baseUrl: string, studioKey: string, slide: Slide, index: number, total: number): string {
  const params = new URLSearchParams({
    mode: 'carousel',
    format: 'portrait',
    style: slide.style,
    slideType: slide.slideType,
    headline: slide.headline,
    kicker: slide.kicker,
    body: slide.body,
    imageUrl: slide.imageUrl || '',
    sources: slide.sourceNames.slice(0, 4).join(' · '),
    index: String(index + 1),
    total: String(total),
    t: String(Date.now()),
  });
  if (studioKey) params.set('key', studioKey);
  return `${baseUrl}/api/dev/instagram/studio/render?${params.toString()}`;
}

async function renderAndUploadToFirebase(renderUrl: string, fileKey: string): Promise<string> {
  if (!adminStorage) throw new Error('Firebase Storage is not configured');
  const res = await fetch(renderUrl, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`Render failed (${res.status})`);
  const contentType = res.headers.get('content-type') || 'image/png';
  const bytes = Buffer.from(await res.arrayBuffer());
  const bucket = adminStorage.bucket();
  const file = bucket.file(`instagram-posts/postiz/${fileKey}.png`);
  await file.save(bytes, { contentType, resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    version: 'v4',
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });
  return signedUrl;
}

async function postizUploadMedia(imageUrl: string, token: string): Promise<{ id: string; path: string }> {
  const baseUrl = getPostizBaseUrl();

  // Download the image bytes first
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image for Postiz upload (${imgRes.status})`);
  const imgBytes = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';

  const form = new FormData();
  form.append('file', new Blob([imgBytes], { type: contentType }), `slide.${ext}`);

  const res = await fetch(`${baseUrl}/media/upload-simple`, {
    method: 'POST',
    headers: { auth: token },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Postiz media upload failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  console.log('[postiz] upload response:', JSON.stringify(data).slice(0, 200));
  const id = data?.id || data?.mediaId || data?.data?.id;
  const path = data?.path || data?.url || data?.cdnUrl || data?.data?.path || imageUrl;
  if (!id) throw new Error('Postiz media upload returned no ID');
  return { id: String(id), path: String(path) };
}

async function postizCreatePost(
  medias: Array<{ id: string; path: string }>,
  caption: string,
  token: string,
  scheduledAt?: string,
): Promise<{ postId: string; url?: string }> {
  const baseUrl = getPostizBaseUrl();
  const integrationId = process.env.POSTIZ_INSTAGRAM_INTEGRATION_ID || 'cmnbf96dp0008kb7gp0rgonxp';
  const date = scheduledAt || new Date().toISOString();

  const body = {
    type: scheduledAt ? 'schedule' : 'now',
    date,
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: integrationId },
        value: [{ content: caption, image: medias.map((m) => ({ id: m.id, path: m.path })) }],
        settings: { __type: 'instagram', post_type: 'post' },
      },
    ],
  };

  console.log('[postiz] create post body:', JSON.stringify(body).slice(0, 300));

  const res = await fetch(`${baseUrl}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', auth: token },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Postiz post creation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const postId = data?.id || data?.postId || data?.data?.id || 'unknown';
  const url = data?.url || data?.shortLink || undefined;
  return { postId: String(postId), url };
}

export async function POST(request: NextRequest) {
  try {
    if (!isInstagramStudioAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as PostizBody;
    const { slides, caption, scheduledAt } = body;

    if (!slides?.length) {
      return NextResponse.json({ error: 'No slides provided' }, { status: 400 });
    }

    const baseUrl = baseUrlFromRequest(request);
    const studioKey = normalizeSecret(process.env.INSTAGRAM_STUDIO_ACCESS_KEY || '');
    const runId = randomUUID().slice(0, 8);

    // Step 1: render each slide + upload to Firebase in parallel
    const firebaseUrls = await Promise.all(
      slides.map((slide, i) => {
        const renderUrl = buildRenderUrl(baseUrl, studioKey, slide, i, slides.length);
        const fileKey = `${Date.now()}-${i + 1}-${runId}`;
        return renderAndUploadToFirebase(renderUrl, fileKey);
      }),
    );

    // Step 2: login to Postiz (cached) and upload media sequentially
    let token = await getPostizToken();
    const medias: Array<{ id: string; path: string }> = [];
    for (const url of firebaseUrls) {
      try {
        const media = await postizUploadMedia(url, token);
        medias.push(media);
      } catch (err) {
        // On 401, refresh token once and retry
        if (err instanceof Error && err.message.includes('401')) {
          token = await getPostizToken(true);
          const media = await postizUploadMedia(url, token);
          medias.push(media);
        } else {
          throw err;
        }
      }
    }

    // Step 3: create the post
    const result = await postizCreatePost(medias, caption, token, scheduledAt);

    return NextResponse.json({
      ok: true,
      postId: result.postId,
      url: result.url,
      slideCount: slides.length,
      scheduled: !!scheduledAt,
      scheduledAt: scheduledAt || null,
    });
  } catch (error) {
    console.error('postiz post error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post to Instagram' },
      { status: 500 },
    );
  }
}
