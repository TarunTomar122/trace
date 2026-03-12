/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const headline = (searchParams.get('headline') || 'Top story today').slice(0, 120);
  const rawImageUrl = searchParams.get('imageUrl') || '';
  const articleUrl = searchParams.get('url') || 'yourtrace.online';
  const logoUrl = `${origin}/tc.png`;

  // Use fallback if no valid image URL
  const hasValidImage = rawImageUrl && rawImageUrl.startsWith('http');
  const imageUrl = hasValidImage ? rawImageUrl : `${origin}/feed.webp`;

  // Fixed 1080x1080 square format
  const width = 1080;
  const height = 1080;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: '#0f172a',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Background Image */}
        <img
          src={imageUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '1080px',
            objectFit: 'cover',
          }}
        />

        {/* Dark overlay gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0.95) 100%)',
          }}
        />

        {/* Logo + Brand at top */}
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <img
            src={logoUrl}
            alt=""
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
            }}
          />
          <span
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: 'white',
              letterSpacing: '0.02em',
            }}
          >
            TRACE
          </span>
        </div>

        {/* Content at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 64,
            left: 56,
            right: 56,
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
          }}
        >
          {/* Headline */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: 'white',
              lineHeight: 1.1,
              textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {headline}
          </div>

          {/* CTA */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Read the full story on Trace
            </span>
            <span
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: '#F59E0B',
              }}
            >
              {articleUrl.replace('https://', '').replace('http://', '')}
            </span>
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
