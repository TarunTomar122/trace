import { ImageResponse } from 'next/og';
import { OG_LOGO_DATA_URL } from '../../../og-assets';
import { OG_FONT_BOLD_B64, OG_FONT_REGULAR_B64 } from '../../../og-fonts';
import { formatEditionDate, sourceHost } from '@/lib/daily-editions';
import { FEATURED_LABELS, getFeaturedItem } from '@/lib/featured-items';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const alt = 'Featured on Trace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The brief's share card palette (app/brief/[date]/opengraph-image.tsx).
const INK = '#171A20';
const BLUE = '#2557D6';
const MUTED = '#596675';

function fontFromB64(b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function clip(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The featured item as a share card: what it is, where, and that Trace picked it. */
export default async function Image({ params }: { params: Promise<{ date: string; id: string }> }) {
  const { date, id } = await params;
  const item = await getFeaturedItem(date, id);
  const title = clip(item?.title || 'The best tools and reads in tech, picked daily', 110);
  const titleSize = title.length <= 48 ? 64 : title.length <= 80 ? 54 : 46;
  const summary = item?.summary ? clip(item.summary, 150) : '';
  const host = item ? sourceHost(item.url) : '';

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        padding: '48px 60px', backgroundColor: '#F6F5F0', color: INK,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src={OG_LOGO_DATA_URL} alt="" width={34} height={34} />
            <span style={{ marginLeft: 11, fontSize: 27, fontWeight: 700, letterSpacing: '-0.04em' }}>Trace</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.13em', color: BLUE }}>
            {item ? formatEditionDate(date).toUpperCase() : 'FEATURED DAILY'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 46 }}>
          <div style={{
            display: 'flex', alignItems: 'center', backgroundColor: BLUE, color: '#FFFFFF',
            borderRadius: 999, padding: '9px 18px 9px 14px', fontSize: 18, fontWeight: 700, letterSpacing: '0.08em',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 9 }}>
              <path fill="#FFFFFF" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
            </svg>
            FEATURED ON TRACE
          </div>
          {item && (
            <div style={{ marginLeft: 16, fontSize: 20, fontWeight: 700, color: MUTED }}>
              {`in ${FEATURED_LABELS[item.section]}`}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.08,
          letterSpacing: '-0.045em', marginTop: 28,
        }}>
          {title}
        </div>
        {summary && (
          <div style={{ display: 'flex', fontSize: 26, lineHeight: 1.35, color: MUTED, marginTop: 20 }}>
            {summary}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', fontSize: 21 }}>
          <span style={{ color: MUTED }}>{[host, item?.signal].filter(Boolean).join(' · ')}</span>
          <span style={{ fontWeight: 700 }}>yourtrace.online</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: fontFromB64(OG_FONT_REGULAR_B64), weight: 400, style: 'normal' },
        { name: 'Inter', data: fontFromB64(OG_FONT_BOLD_B64), weight: 700, style: 'normal' },
      ],
    },
  );
}
