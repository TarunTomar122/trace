import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';

type CarouselRequest = {
  topic?: string;
  slides?: number;
};

type StudioSlide = {
  id: string;
  slideType: 'cover' | 'story';
  style: 'editorial' | 'signal' | 'spotlight';
  headline: string;
  kicker: string;
  body: string;
  imageUrl: string;
  sourceNames: string[];
};

type StudioDeck = {
  ok: boolean;
  date: string;
  category: 'all' | 'ai' | 'tech' | 'world';
  style: 'mixed' | 'editorial' | 'signal' | 'spotlight';
  title: string;
  tagline: string;
  count: number;
  caption: string;
  slides: StudioSlide[];
};

function normalizeSecret(value?: string | null): string {
  return (value || '').replace(/^["']|["']$/g, '').replace(/\r?\n/g, '').trim();
}

function isAuthorized(request: NextRequest): boolean {
  const configured = normalizeSecret(process.env.OPENCLAW_CAROUSEL_API_KEY || process.env.CAROUSEL_API_KEY || '');
  if (!configured) return true;

  const headerKey = normalizeSecret(request.headers.get('x-api-key'));
  if (headerKey && headerKey === configured) return true;

  const auth = normalizeSecret(request.headers.get('authorization'));
  if (auth.toLowerCase().startsWith('bearer ')) {
    return normalizeSecret(auth.slice(7)) === configured;
  }

  return false;
}

function clampSlides(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 5;
  return Math.max(4, Math.min(8, Math.round(num)));
}

function inferCategoryFromTopic(topic: string): 'all' | 'ai' | 'tech' | 'world' {
  const text = topic.toLowerCase();
  if (/(ai|openai|anthropic|claude|gemini|llm|model|agent)/.test(text)) return 'ai';
  if (/(world|war|policy|government|tariff|election|global|country|countries)/.test(text)) return 'world';
  if (/(tech|apple|google|meta|microsoft|startup|software|hardware|chip)/.test(text)) return 'tech';
  return 'all';
}

function buildCaption(topic: string, deck: StudioDeck): string {
  const cleanTopic = topic.trim();
  if (!cleanTopic) return deck.caption;
  return `${cleanTopic}\n\n${deck.caption}`.trim();
}

function baseUrlFromRequest(request: NextRequest): string {
  const forcedBaseUrl = (process.env.INSTAGRAM_RENDER_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
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
  const objectPath = `instagram-posts/openclaw/${fileKey}.png`;
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
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });

  return signedUrl;
}

async function loadDeck(request: NextRequest, slides: number, category: 'all' | 'ai' | 'tech' | 'world'): Promise<StudioDeck> {
  const baseUrl = baseUrlFromRequest(request);
  const params = new URLSearchParams({
    category,
    style: 'mixed',
    slides: String(slides),
  });

  const headers = new Headers();
  const studioKey = normalizeSecret(process.env.INSTAGRAM_STUDIO_ACCESS_KEY || '');
  if (studioKey) headers.set('x-studio-key', studioKey);

  const res = await fetch(`${baseUrl}/api/dev/instagram/studio/carousel?${params.toString()}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Carousel generator failed (${res.status})`);
  }

  return (await res.json()) as StudioDeck;
}

function buildRenderUrl(request: NextRequest, deck: StudioDeck, slide: StudioSlide, index: number): string {
  const baseUrl = baseUrlFromRequest(request);
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
    total: String(deck.slides.length),
    t: String(Date.now()),
  });
  const studioKey = normalizeSecret(process.env.INSTAGRAM_STUDIO_ACCESS_KEY || '');
  if (studioKey) params.set('key', studioKey);
  return `${baseUrl}/api/dev/instagram/studio/render?${params.toString()}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CarouselRequest;
    const topic = String(body.topic || '').trim();
    const slides = clampSlides(body.slides);
    const category = inferCategoryFromTopic(topic);
    const deck = await loadDeck(request, slides, category);

    const uploadPromises = deck.slides.map(async (slide, index) => {
      const renderUrl = buildRenderUrl(request, deck, slide, index);
      const fileKey = `${deck.date}-${index + 1}-${randomUUID().slice(0, 8)}`;
      return renderAndUploadToFirebase(renderUrl, fileKey);
    });

    const images = await Promise.all(uploadPromises);

    return NextResponse.json({
      success: true,
      caption: buildCaption(topic, deck),
      images,
    });
  } catch (error) {
    console.error('carousel api error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create carousel',
      },
      { status: 500 },
    );
  }
}
