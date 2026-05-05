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
  overlay: string;
  kickerBg: string | null;
};

const THEMES: Record<CarouselStyle, Theme> = {
  editorial: {
    bg: '#FAF7F2',
    text: '#1C1917',
    muted: '#A8A29E',
    accent: '#78716C',
    overlay: 'rgba(250,247,242,',
    kickerBg: null,
  },
  signal: {
    bg: '#0A0A0A',
    text: '#FFFFFF',
    muted: '#A1A1AA',
    accent: '#F59E0B',
    overlay: 'rgba(10,10,10,',
    kickerBg: null,
  },
  spotlight: {
    bg: '#FFFFFF',
    text: '#0A0A0A',
    muted: '#A1A1AA',
    accent: '#EA580C',
    overlay: 'rgba(255,255,255,',
    kickerBg: '#EA580C',
  },
};

const serifFontPromise = fetch(
  new URL('./DMSerifDisplay-Regular.woff', import.meta.url),
).then((r) => r.arrayBuffer());

function clean(value: string): string {
  return (value || '')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    .slice(0, 2);
}

function resolveFormat(requested: string | null): Format {
  const key = (requested || 'portrait').toLowerCase();
  return key in FORMATS ? (key as Format) : 'portrait';
}

async function isImageReachable(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-511' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok && res.status !== 206) return false;
    const ct = res.headers.get('content-type') || '';
    if (ct.startsWith('image/')) return true;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 4) return false;
    const b = new Uint8Array(buf);
    return (
      (b[0] === 0xff && b[1] === 0xd8) ||
      (b[0] === 0x89 && b[1] === 0x50) ||
      (b[0] === 0x47 && b[1] === 0x49) ||
      (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45)
    );
  } catch {
    return false;
  }
}

function renderCarouselSlide({
  style,
  slideType,
  kicker,
  headline,
  body,
  imageUrl,
  indexLabel,
  width,
  height,
  logoUrl,
}: {
  style: CarouselStyle;
  slideType: 'cover' | 'story' | 'detail';
  kicker: string;
  headline: string;
  body: string;
  imageUrl: string;
  indexLabel: string;
  width: number;
  height: number;
  logoUrl: string;
}) {
  const theme = THEMES[style] || THEMES.editorial;
  const bodyParts = paragraphs(body);
  const hasImage = !!imageUrl;
  const tagline =
    bodyParts[0] || 'The strongest stories, grouped and explained.';
  const PAD = 56;

  if (slideType === 'cover') {
    const total = indexLabel.split('/')[1] || '5';
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          background: theme.bg,
          color: theme.text,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Decorative accent bar at very top */}
        <div
          style={{
            width: '100%',
            height: 6,
            background: theme.accent,
            flexShrink: 0,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `36px ${PAD}px 0`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={logoUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 10 }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: theme.text,
              color: theme.bg,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 20,
            }}
          >
            {total} STORIES
          </div>
        </div>

        <div
          style={{
            height: 1,
            background: theme.muted,
            opacity: 0.2,
            marginLeft: PAD,
            marginRight: PAD,
            marginTop: 20,
            flexShrink: 0,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            paddingLeft: PAD,
            paddingRight: PAD,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: theme.accent,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 88,
              lineHeight: 1.04,
              fontFamily: 'Serif',
              color: theme.text,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              marginTop: 36,
              fontSize: 26,
              lineHeight: 1.5,
              color: theme.muted,
              maxWidth: 820,
            }}
          >
            {tagline}
          </div>
        </div>

        {/* Bottom bar — swipe CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: `0 ${PAD}px 88px`,
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: theme.accent,
            }}
          >
            Swipe to read
          </div>
          <div
            style={{
              fontSize: 28,
              color: theme.accent,
              lineHeight: 1,
            }}
          >
            →
          </div>
        </div>
      </div>
    );
  }

  if (slideType === 'detail') {
    const bullets = bodyParts.slice(0, 3);
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAF9',
          color: '#111827',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `44px ${PAD}px 0`,
          }}
        >
          <img
            src={logoUrl}
            alt=""
            style={{ width: 40, height: 40, borderRadius: 10 }}
          />
          <div style={{ fontSize: 17, color: '#78716C', fontWeight: 500 }}>{indexLabel}</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            paddingLeft: PAD,
            paddingRight: PAD,
            paddingBottom: 52,
          }}
        >
          <div
            style={{
              fontSize: 36,
              lineHeight: 1.18,
              color: '#78716C',
              fontFamily: 'Serif',
              marginBottom: 54,
            }}
          >
            {headline}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
            {bullets.map((point, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 22 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: '#78716C',
                    marginTop: 20,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: 48,
                    lineHeight: 1.16,
                    letterSpacing: -0.8,
                    fontFamily: 'Serif',
                    color: '#111827',
                  }}
                >
                  {point}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: `0 ${PAD}px 96px`,
            fontSize: 17,
            color: '#78716C',
            letterSpacing: 0.4,
          }}
        >
          read full story at yourtrace.online
        </div>
      </div>
    );
  }

  if (hasImage) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {/* Full-bleed image */}
        <img
          src={imageUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Heavy gradient — transparent top, opaque bottom */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(180deg, ${theme.overlay}0) 0%, ${theme.overlay}0) 30%, ${theme.overlay}0.25) 48%, ${theme.overlay}0.7) 60%, ${theme.overlay}0.92) 72%, ${theme.overlay}1) 80%)`,
          }}
        />

        {/* Header — logo + index */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: PAD,
            right: PAD,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={logoUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 10 }}
            />
          </div>
          <div style={{ fontSize: 17, color: theme.muted }}>{indexLabel}</div>
        </div>

        {/* Text anchored at bottom */}
        <div
          style={{
            position: 'absolute',
            left: PAD,
            right: PAD,
            bottom: 112,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize: 88,
              lineHeight: 1.03,
              fontFamily: 'Serif',
              color: theme.text,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontSize: 17,
              color: theme.muted,
              marginTop: 24,
              letterSpacing: 0.4,
            }}
          >
            read full story at yourtrace.online
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        background: theme.bg,
        color: theme.text,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `44px ${PAD}px 0`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={logoUrl}
            alt=""
            style={{ width: 40, height: 40, borderRadius: 10 }}
          />
        </div>
        <div style={{ fontSize: 17, color: theme.muted }}>{indexLabel}</div>
      </div>

      <div
        style={{
          height: 1,
          background: theme.muted,
          opacity: 0.25,
          marginLeft: PAD,
          marginRight: PAD,
          marginTop: 16,
          flexShrink: 0,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          paddingLeft: PAD,
          paddingRight: PAD,
          paddingBottom: 96,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 108,
            lineHeight: 1.02,
            fontFamily: 'Serif',
            color: theme.text,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontSize: 17,
            color: theme.muted,
            marginTop: 34,
            letterSpacing: 0.4,
          }}
        >
          read full story at yourtrace.online
        </div>
      </div>
    </div>
  );
}

function renderLegacySingle(
  headline: string,
  imageUrl: string,
  logoUrl: string,
  format: Format,
) {
  const { width, height } = FORMATS[format];
  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: '#000',
        color: 'white',
      }}
    >
      <img
        src={imageUrl}
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.75) 68%, rgba(0,0,0,0.95) 82%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <img
          src={logoUrl}
          alt=""
          style={{ width: 40, height: 40, borderRadius: 10 }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          bottom: 112,
          fontSize: 84,
          lineHeight: 1.03,
          fontFamily: 'Serif',
        }}
      >
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

  type FontDef = { name: string; data: ArrayBuffer; weight: 400; style: 'normal' };
  let fonts: FontDef[] = [];
  try {
    const serifData = await serifFontPromise;
    fonts = [{ name: 'Serif', data: serifData, weight: 400, style: 'normal' }];
  } catch (e) {
    console.error('Font load failed, using defaults:', e);
  }

  const mode = (searchParams.get('mode') || 'single').toLowerCase();

  if (mode === 'carousel') {
    const rawStyle = (searchParams.get('style') || 'editorial').toLowerCase();
    const style: CarouselStyle = (['editorial', 'signal', 'spotlight'] as const).includes(
      rawStyle as CarouselStyle,
    )
      ? (rawStyle as CarouselStyle)
      : 'editorial';
    const slideType = (searchParams.get('slideType') || 'story').toLowerCase() as
      | 'cover'
      | 'story'
      | 'detail';
    const headline = clean(
      searchParams.get('headline') || 'Top stories shaping today',
    );
    const kicker = clean(searchParams.get('kicker') || 'Trace');
    const body = String(searchParams.get('body') || '');
    const rawImageUrl = searchParams.get('imageUrl') || '';
    const imageUrl = rawImageUrl && (await isImageReachable(rawImageUrl)) ? rawImageUrl : '';
    const index = searchParams.get('index') || '1';
    const total = searchParams.get('total') || '6';

    return new ImageResponse(
      renderCarouselSlide({
        style,
        slideType,
        kicker,
        headline,
        body,
        imageUrl,
        indexLabel: `${index}/${total}`,
        width,
        height,
        logoUrl,
      }),
      { width, height, ...(fonts.length ? { fonts } : {}) },
    );
  }

  const headline = clean(
    searchParams.get('headline') || 'Top story today',
  ).slice(0, 180);
  const rawImg = searchParams.get('imageUrl') || `${origin}/feed.webp`;
  const imageUrl = await isImageReachable(rawImg) ? rawImg : `${origin}/feed.webp`;
  return new ImageResponse(
    renderLegacySingle(headline, imageUrl, logoUrl, format),
    { width, height, ...(fonts.length ? { fonts } : {}) },
  );
}
