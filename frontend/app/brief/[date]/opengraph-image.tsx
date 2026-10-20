import { ImageResponse } from 'next/og';
import { OG, OgWordmark, clip, ogFonts } from '../../og-style';
import { formatEditionDate, getDailyEdition } from '@/lib/daily-editions';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const alt = 'Trace daily brief: the biggest stories in tech today';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The day's headlines as the share card, so a shared link shows the news. */
export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const edition = await getDailyEdition(date);
  const stories = (edition?.stories || []).slice(0, 4);
  const count = edition ? edition.stories.length : 10;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        padding: '50px 60px 44px 60px', backgroundColor: '#FFFFFF', color: OG.ink, fontFamily: OG.sans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <OgWordmark />
          <span style={{ fontSize: 21, color: OG.muted }}>
            {edition ? `The Daily Brief · ${formatEditionDate(date)}` : 'The Daily Brief'}
          </span>
        </div>

        <div style={{ display: 'flex', marginTop: 34, fontFamily: OG.serif, fontSize: 66, fontWeight: 500, lineHeight: 1.05 }}>
          <span style={{ backgroundColor: OG.highlight, padding: '0 8px', marginLeft: -8 }}>{`${count} big things`}</span>
          <span style={{ marginLeft: 10 }}>in tech today</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
          {stories.map((story, index) => (
            <div key={story.url} style={{
              display: 'flex', alignItems: 'center', padding: '15px 0',
              borderTop: index === 0 ? 'none' : `1px solid ${OG.line}`,
            }}>
              <span style={{ width: 52, flexShrink: 0, fontFamily: OG.serif, fontSize: 30, fontWeight: 500, color: OG.muted }}>
                {index + 1}
              </span>
              {/* One line each: four headlines must fit the card. */}
              <span style={{ fontSize: 27, lineHeight: 1.25, color: OG.ink }}>{clip(story.title, 66)}</span>
            </div>
          ))}
        </div>

        {/* Nothing in the bottom-left: X lays the link's title over that corner. */}
      </div>
    ),
    { ...size, fonts: ogFonts() },
  );
}
