/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { isInstagramStudioAuthorized } from '@/lib/instagram-studio-auth';

export const runtime = 'edge';

/** Instagram-friendly sizes: feed square 1:1, feed portrait 4:5, story/reels 9:16 */
const FORMATS = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;

type Format = keyof typeof FORMATS;
type CarouselStyle = 'editorial' | 'signal' | 'spotlight';

type Theme = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  cardBg: string;
};

const THEMES: Record<CarouselStyle, Theme> = {
  editorial: {
    bg: '#FAF7F2',
    text: '#1C1917',
    muted: '#A8A29E',
    accent: '#C2410C',   // stronger orange-red for editorial
    cardBg: '#F0EBE3',
  },
  signal: {
    bg: '#0A0A0A',
    text: '#FFFFFF',
    muted: '#71717A',
    accent: '#F59E0B',
    cardBg: '#18181B',
  },
  spotlight: {
    bg: '#0F0F0F',
    text: '#FFFFFF',
    muted: '#71717A',
    accent: '#EA580C',
    cardBg: '#1A1A1A',
  },
};

// Load serif font for cover headlines
const serifFontPromise = fetch(
  new URL('./DMSerifDisplay-Regular.woff', import.meta.url),
).then((r) => r.arrayBuffer()).catch(() => null);

// Load Inter Bold from CDN for story slide headlines (punchy sans-serif like Rundown)
const sansFontPromise: Promise<ArrayBuffer | null> = fetch(
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/files/inter-latin-700-normal.woff',
  { cache: 'force-cache' },
).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);

// Pre-fetch an image and return it as a data URL so Satori never makes
// its own outbound fetches (which can fail in edge runtime).
async function toDataUrl(url: string): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return '';
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // btoa works in both Node.js and edge runtimes
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return `data:${ct};base64,${btoa(binary)}`;
  } catch {
    return '';
  }
}

function clean(value: string): string {
  return (value || '')
    .replace(/&#8217;/g, '\u2019').replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripSlidePrefixes(text: string): string {
  let line = String(text || '').trim();
  for (let i = 0; i < 5; i++) {
    const next = line
      .replace(/^slide\s*\d+\s*:\s*/i, '')
      .replace(/^slide\s*\d+\s*[-–—.)]\s*/i, '')
      .trim();
    if (next === line) break;
    line = next;
  }
  return line;
}

function paragraphs(value: string): string[] {
  return String(value || '')
    .split(/\n{2,}/)
    .map((part) => clean(stripSlidePrefixes(part)))
    .filter(Boolean)
    .slice(0, 3);
}

function resolveFormat(requested: string | null): Format {
  const key = (requested || 'portrait').toLowerCase();
  return key in FORMATS ? (key as Format) : 'portrait';
}


// ─── Cover Slide ──────────────────────────────────────────────────────────────
function renderCoverSlide({
  style, headline, kicker, tagline, storyCount,
  coverImage1, coverImage2,
  width, height, logoUrl, hasSans,
}: {
  style: CarouselStyle;
  headline: string;
  kicker: string;
  tagline: string;
  storyCount: string;
  coverImage1: string;
  coverImage2: string;
  width: number;
  height: number;
  logoUrl: string;
  hasSans: boolean;
}) {
  const theme = THEMES[style] || THEMES.editorial;
  const PAD = 56;
  const heroImage = coverImage1 || coverImage2;

  if (heroImage) {
    // ── Two-zone cover: image top half fading to black, text on solid black bottom ──
    const imageZoneH = Math.round(height * 0.52);
    const textZoneH = height - imageZoneH;
    return (
      <div style={{
        width, height, display: 'flex', flexDirection: 'column',
        background: '#000', overflow: 'hidden',
      }}>
        {/* ── Image zone (top 52%) ── */}
        <div style={{ width, height: imageZoneH, position: 'relative', flexShrink: 0, display: 'flex' }}>
          <img src={heroImage} alt="" width={width} height={imageZoneH} style={{
            position: 'absolute', top: 0, left: 0, objectFit: 'cover',
          }} />
          {/* Fade image to black at the bottom */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: Math.round(imageZoneH * 0.6),
            background: 'linear-gradient(to bottom, transparent, #000)',
          }} />
          {/* Top bar over image */}
          <div style={{
            position: 'absolute', top: 44, left: PAD, right: PAD,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={logoUrl} alt="" width={40} height={40} style={{ borderRadius: 10 }} />
            </div>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.75)',
              textTransform: 'uppercase',
            }}>
              {kicker}
            </div>
          </div>
        </div>

        {/* ── Text zone (bottom 48%) — solid black, always readable ── */}
        <div style={{
          width, height: textZoneH, background: '#000',
          display: 'flex', flexDirection: 'column',
          paddingLeft: PAD, paddingRight: PAD, paddingBottom: 88,
          justifyContent: 'flex-end',
        }}>
          {/* Story count pill */}
          <div style={{ display: 'flex', marginBottom: 22 }}>
            <div style={{
              background: theme.accent,
              color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 2,
              paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: 20,
              textTransform: 'uppercase',
            }}>
              {`${storyCount} STORIES`}
            </div>
          </div>

          {/* Main headline */}
          <div style={{
            fontSize: 80, lineHeight: 1.03,
            fontFamily: hasSans ? 'Sans' : 'sans-serif',
            fontWeight: 700, color: '#fff',
          }}>
            {headline}
          </div>

          {/* Tagline + swipe CTA */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            marginTop: 22,
          }}>
            <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, maxWidth: 580 }}>
              {tagline}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
              color: theme.accent, textTransform: 'uppercase',
            }}>
              <div>Swipe</div>
              <div style={{ fontSize: 20 }}>→</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── No-image fallback: bold dark typographic cover ──────────────────────────
  return (
    <div style={{
      width, height, display: 'flex', flexDirection: 'column',
      background: '#0A0A0A', color: '#fff',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Top accent line */}
      <div style={{ width: '100%', height: 4, background: theme.accent, flexShrink: 0 }} />

      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `40px ${PAD}px 0`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl} alt="" width={40} height={40} style={{ borderRadius: 10 }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
          {kicker}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginLeft: PAD, marginRight: PAD, marginTop: 32, flexShrink: 0 }} />

      {/* Main content */}
      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1,
        paddingLeft: PAD, paddingRight: PAD, paddingBottom: 88,
        justifyContent: 'flex-end',
      }}>
        {/* Story count pill */}
        <div style={{ display: 'flex', marginBottom: 28 }}>
          <div style={{
            background: theme.accent,
            color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 2,
            paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, borderRadius: 20,
            textTransform: 'uppercase',
          }}>
            {`${storyCount} STORIES`}
          </div>
        </div>

        <div style={{
          fontSize: 96, lineHeight: 1.02,
          fontFamily: hasSans ? 'Sans' : 'sans-serif',
          fontWeight: 700, color: '#fff',
        }}>
          {headline}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginTop: 28,
        }}>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, maxWidth: 600 }}>
            {tagline}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
            color: theme.accent, textTransform: 'uppercase',
          }}>
            <div>Swipe</div>
            <div style={{ fontSize: 20 }}>→</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Story Slide with Image ────────────────────────────────────────────────────
function renderImageStorySlide({
  headline,
  indexLabel, imageUrl, width, height, logoUrl, hasSans,
}: {
  headline: string;
  indexLabel: string;
  imageUrl: string;
  width: number;
  height: number;
  logoUrl: string;
  hasSans: boolean;
}) {
  const PAD = 52;

  return (
    <div style={{
      width, height, display: 'flex', position: 'relative',
      overflow: 'hidden', background: '#111',
    }}>
      {/* Full-bleed image — only rendered when imageUrl is non-empty */}
      {imageUrl ? (
        <img src={imageUrl} alt="" width={width} height={height} style={{
          position: 'absolute', top: 0, left: 0,
          objectFit: 'cover',
        }} />
      ) : null}

      {/* Dark overlay — solid black from 58% down so text is always readable */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        background: imageUrl
          ? 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.6) 58%, rgba(0,0,0,0.95) 70%, rgba(0,0,0,1) 78%)'
          : 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,1) 70%)',
      }} />

      {/* Header: logo + index */}
      <div style={{
        position: 'absolute', top: 40, left: PAD, right: PAD,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl} alt="" width={38} height={38} style={{ borderRadius: 9 }} />
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{indexLabel}</div>
      </div>

      {/* Bottom text block */}
      <div style={{
        position: 'absolute', left: PAD, right: PAD, bottom: 112,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 84, lineHeight: 1.03,
          fontFamily: hasSans ? 'Sans' : 'Serif',
          fontWeight: hasSans ? 700 : 400,
          color: '#fff',
        }}>
          {headline}
        </div>
        <div style={{
          fontSize: 16, color: 'rgba(255,255,255,0.62)',
          marginTop: 24, letterSpacing: 0.4,
        }}>
          read full story at yourtrace.online
        </div>
      </div>
    </div>
  );
}

function renderDetailSlide({
  headline, body,
  indexLabel, width, height, logoUrl, hasSans,
}: {
  headline: string;
  body: string;
  indexLabel: string;
  width: number;
  height: number;
  logoUrl: string;
  hasSans: boolean;
}) {
  const PAD = 64;
  const bullets = paragraphs(body).slice(0, 3);

  return (
    <div style={{
      width, height, display: 'flex', flexDirection: 'column',
      background: '#FAFAF9', color: '#111827', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `44px ${PAD}px 0`,
      }}>
        <img src={logoUrl} alt="" width={40} height={40} style={{ borderRadius: 10 }} />
        <div style={{ fontSize: 17, color: '#78716C', fontWeight: 500 }}>{indexLabel}</div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1,
        justifyContent: 'center', paddingLeft: PAD, paddingRight: PAD,
        paddingBottom: 52,
      }}>
        <div style={{
          fontSize: 36, lineHeight: 1.18, color: '#78716C',
          fontFamily: hasSans ? 'Sans' : 'sans-serif', fontWeight: 700,
          marginBottom: 54,
        }}>
          {headline}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
          {bullets.map((point, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 22 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 999, background: '#78716C',
                marginTop: 20, flexShrink: 0,
              }} />
              <div style={{
                fontSize: 48, lineHeight: 1.16, letterSpacing: -0.8,
                fontFamily: hasSans ? 'Sans' : 'sans-serif', fontWeight: 700,
                color: '#111827',
              }}>
                {point}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: `0 ${PAD}px 96px`,
        fontSize: 17, color: '#78716C', letterSpacing: 0.4,
      }}>
        read full story at yourtrace.online
      </div>
    </div>
  );
}

// ─── Legacy single image slide ─────────────────────────────────────────────────
function renderLegacySingle(headline: string, imageUrl: string, logoUrl: string, format: Format) {
  const { width, height } = FORMATS[format];
  return (
    <div style={{
      width, height, display: 'flex', position: 'relative',
      overflow: 'hidden', background: '#000', color: 'white',
    }}>
      <img src={imageUrl} alt="" width={width} height={height} style={{
        position: 'absolute', top: 0, left: 0, objectFit: 'cover',
      }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.75) 68%, rgba(0,0,0,0.95) 82%)',
      }} />
      <div style={{ position: 'absolute', top: 48, left: 56, display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logoUrl} alt="" width={40} height={40} style={{ borderRadius: 10 }} />
      </div>
      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 112, fontSize: 84, lineHeight: 1.03, fontFamily: 'Serif' }}>
        {headline}
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.62)', marginTop: 24, letterSpacing: 0.4 }}>
          read full story at yourtrace.online
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  if (!isInstagramStudioAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams, origin } = new URL(request.url);
  const logoUrl = `${origin}/tc.png`;
  const format = resolveFormat(searchParams.get('format'));
  const { width, height } = FORMATS[format];

  type FontDef = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' };
  const fonts: FontDef[] = [];

  const [serifData, sansData] = await Promise.all([serifFontPromise, sansFontPromise]);
  if (serifData) fonts.push({ name: 'Serif', data: serifData, weight: 400, style: 'normal' });
  if (sansData) fonts.push({ name: 'Sans', data: sansData, weight: 700, style: 'normal' });

  const hasSans = !!sansData;

  // Pre-fetch logo once for all slide types
  const logoData = await toDataUrl(logoUrl);

  const mode = (searchParams.get('mode') || 'single').toLowerCase();

  if (mode === 'carousel') {
    const rawStyle = (searchParams.get('style') || 'editorial').toLowerCase();
    const style: CarouselStyle = (['editorial', 'signal', 'spotlight'] as const).includes(rawStyle as CarouselStyle)
      ? (rawStyle as CarouselStyle) : 'editorial';

    const slideType = (searchParams.get('slideType') || 'story') as 'cover' | 'story' | 'detail';
    const headline = clean(searchParams.get('headline') || 'Top stories shaping today');
    const kicker = clean(searchParams.get('kicker') || 'Trace');
    const body = String(searchParams.get('body') || '');
    const rawImageUrl = searchParams.get('imageUrl') || '';
    const index = searchParams.get('index') || '1';
    const total = searchParams.get('total') || '6';
    const indexLabel = `${index}/${total}`;

    if (slideType === 'cover') {
      const rawCi1 = searchParams.get('ci1') || '';
      const rawCi2 = searchParams.get('ci2') || '';
      // Pre-fetch cover collage images as data URLs
      const [ci1, ci2] = await Promise.all([
        rawCi1 ? toDataUrl(rawCi1) : Promise.resolve(''),
        rawCi2 ? toDataUrl(rawCi2) : Promise.resolve(''),
      ]);
      const tagline = body.split('\n\n')[0] || 'The biggest stories in AI, tech, and the world.';

      return new ImageResponse(
        renderCoverSlide({
          style, headline, kicker, tagline,
          storyCount: total,
          coverImage1: ci1, coverImage2: ci2,
          width, height, logoUrl: logoData, hasSans,
        }),
        { width, height, ...(fonts.length ? { fonts } : {}) },
      );
    }

    // Pre-fetch story image as data URL
    const imageData = rawImageUrl ? await toDataUrl(rawImageUrl) : '';

    if (slideType === 'detail') {
      return new ImageResponse(
        renderDetailSlide({
          headline,
          body,
          indexLabel,
          width,
          height,
          logoUrl: logoData,
          hasSans,
        }),
        { width, height, ...(fonts.length ? { fonts } : {}) },
      );
    }

    return new ImageResponse(
      renderImageStorySlide({
        headline,
        indexLabel, imageUrl: imageData, width, height, logoUrl: logoData, hasSans,
      }),
      { width, height, ...(fonts.length ? { fonts } : {}) },
    );
  }

  // Legacy single mode
  const headline = clean(searchParams.get('headline') || 'Top story today').slice(0, 180);
  const rawImg = searchParams.get('imageUrl') || `${origin}/feed.webp`;
  const imageData = await toDataUrl(rawImg) || await toDataUrl(`${origin}/feed.webp`);
  return new ImageResponse(
    renderLegacySingle(headline, imageData, logoData, format),
    { width, height, ...(fonts.length ? { fonts } : {}) },
  );
}
