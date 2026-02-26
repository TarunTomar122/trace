/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const FORMATS = {
  square: { width: 1080, height: 1080, label: 'Square' },
  portrait: { width: 1080, height: 1350, label: 'Portrait' },
  story: { width: 1080, height: 1920, label: 'Story' },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const renderSecret = process.env.INSTAGRAM_RENDER_SECRET || '';
  const providedKey = (searchParams.get('key') || '').trim();
  const isAuthorizedProdAccess = !!renderSecret && providedKey === renderSecret;
  if (process.env.NODE_ENV !== 'development' && !isAuthorizedProdAccess) {
    return new Response('Not found', { status: 404 });
  }

  const { origin } = new URL(request.url);
  const headline = (searchParams.get('headline') || 'Top story today').slice(0, 180);
  const imageUrl = searchParams.get('imageUrl') || `${origin}/feed.webp`;
  const logoUrl = `${origin}/tc.png`;
  const requestedFormat = (searchParams.get('format') || 'square').toLowerCase();
  const format = requestedFormat in FORMATS ? (requestedFormat as keyof typeof FORMATS) : 'square';
  const { width, height } = FORMATS[format];
  const scale = Math.min(width / 1080, height / 1080);

  const topPad = Math.round(56 * scale);
  const leftPad = Math.round(56 * scale);
  const logoSize = Math.round(56 * scale);
  const logoRadius = Math.round(12 * scale);
  const brandFont = Math.max(24, Math.round(42 * scale));
  const brandGap = Math.round(14 * scale);

  const textSidePad = Math.round(72 * scale);
  const textBottom = Math.round((format === 'story' ? 130 : format === 'portrait' ? 108 : 88) * scale);
  const headlineFont = Math.max(46, Math.round((format === 'story' ? 82 : format === 'portrait' ? 76 : 72) * scale));
  const approxCharsPerLine = format === 'story' ? 22 : format === 'portrait' ? 23 : 24;
  const estimatedLines = Math.max(2, Math.ceil(headline.length / approxCharsPerLine));
  const textBlockHeight = Math.round(estimatedLines * headlineFont * 1.05);
  const textTopPx = Math.max(0, height - textBottom - textBlockHeight);
  const textBandTopPx = Math.max(0, textTopPx - Math.round(92 * scale));
  const featherTopPx = Math.max(0, textTopPx - Math.round(120 * scale));
  const featherStartPct = Math.max(32, Math.min(82, Math.round((featherTopPx / height) * 100)));
  const radialCenterYPct = Math.max(66, Math.min(94, Math.round(((height - textBottom - textBlockHeight * 0.1) / height) * 100)));

  return new ImageResponse(
    (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: 'relative',
          display: 'flex',
          overflow: 'hidden',
          background: '#111827',
          color: 'white',
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 34%, rgba(0,0,0,0.14) 56%, rgba(0,0,0,0.34) 75%, rgba(0,0,0,0.62) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: textBandTopPx,
            bottom: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 20%, rgba(0,0,0,0.72) 58%, rgba(0,0,0,0.9) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) ${Math.max(
              0,
              featherStartPct - 12
            )}%, rgba(0,0,0,0.28) ${featherStartPct}%, rgba(0,0,0,0.62) ${Math.min(
              95,
              featherStartPct + 16
            )}%, rgba(0,0,0,0.9) 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(132% 84% at 50% ${radialCenterYPct}%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.66) 33%, rgba(0,0,0,0.3) 58%, rgba(0,0,0,0.0) 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.12) 64%, rgba(0,0,0,0.35) 78%, rgba(0,0,0,0.66) 100%)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: topPad,
            left: leftPad,
            display: 'flex',
            alignItems: 'center',
            gap: brandGap,
          }}
        >
          <img
            src={logoUrl}
            alt=""
            style={{
              width: logoSize,
              height: logoSize,
              objectFit: 'cover',
              borderRadius: logoRadius,
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.45))',
            }}
          />
          <div style={{ fontSize: brandFont, fontWeight: 700, letterSpacing: 0.3, textShadow: '0 2px 8px rgba(0,0,0,0.45)' }}>
            TRACE
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: textSidePad,
            right: textSidePad,
            bottom: textBottom,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            zIndex: 3,
          }}
        >
          <div
            style={{
              fontSize: headlineFont,
              lineHeight: 1.05,
              fontWeight: 800,
              textShadow: '0 6px 24px rgba(0,0,0,0.78)',
            }}
          >
            {headline}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );
}
