import { ImageResponse } from 'next/og';
import { OG, OgWordmark, clip, ogFonts } from '../../../og-style';
import { formatEditionDate, sourceHost } from '@/lib/daily-editions';
import { FEATURED_LABELS, getFeaturedItem } from '@/lib/featured-items';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const alt = 'Featured on Trace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The featured item as a share card: what it is, where, and that Trace picked it. */
export default async function Image({ params }: { params: Promise<{ date: string; id: string }> }) {
  const { date, id } = await params;
  const item = await getFeaturedItem(date, id);
  const title = clip(item?.title || 'The best tools and reads in tech, picked daily', 110);
  const titleSize = title.length <= 48 ? 76 : title.length <= 80 ? 64 : 54;
  const summary = item?.summary ? clip(item.summary, 150) : '';
  const host = item ? sourceHost(item.url) : '';

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        padding: '50px 60px 44px 60px', backgroundColor: '#FFFFFF', color: OG.ink, fontFamily: OG.sans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <OgWordmark />
          <span style={{ fontSize: 21, color: OG.muted }}>{item ? formatEditionDate(date) : 'Featured daily'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 44 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
            <path fill={OG.ink} d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
          </svg>
          <span style={{
            fontFamily: OG.serif, fontSize: 28, fontWeight: 500, lineHeight: 1.3,
            backgroundColor: OG.highlight, padding: '0 7px',
          }}>
            Featured on Trace
          </span>
          {item && (
            <span style={{ marginLeft: 14, fontSize: 22, color: OG.muted }}>{`in ${FEATURED_LABELS[item.section]}`}</span>
          )}
        </div>

        <div style={{
          display: 'flex', marginTop: 26, fontFamily: OG.serif, fontSize: titleSize, fontWeight: 500,
          lineHeight: 1.06, letterSpacing: '-0.005em',
        }}>
          {title}
        </div>

        {summary && (
          <div style={{ display: 'flex', marginTop: 20, fontSize: 26, lineHeight: 1.4, color: OG.text }}>
            {summary}
          </div>
        )}

        {/* Up here, not in the bottom-left: X lays the link's title over that corner. */}
        {(host || item?.signal) && (
          <div style={{ display: 'flex', marginTop: 18, fontSize: 21, color: OG.muted }}>
            {[host, item?.signal].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    ),
    { ...size, fonts: ogFonts() },
  );
}
