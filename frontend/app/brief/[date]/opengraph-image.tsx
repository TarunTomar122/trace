import { ImageResponse } from 'next/og';
import { OG_LOGO_DATA_URL } from '../../og-assets';
import { OG_FONT_BOLD_B64, OG_FONT_REGULAR_B64 } from '../../og-fonts';
import { formatEditionDate, getDailyEdition } from '@/lib/daily-editions';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const alt = 'Trace daily brief: the biggest stories in tech today';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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

/** The day's headlines as the share card, so a shared link shows the news. */
export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const edition = await getDailyEdition(date);
  const stories = (edition?.stories || []).slice(0, 4);

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
            {edition ? formatEditionDate(date).toUpperCase() : 'THE DAILY BRIEF'}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, letterSpacing: '-0.05em', marginTop: 34 }}>
          <span style={{ color: BLUE }}>{edition ? edition.stories.length : 10}</span>
          <span style={{ marginLeft: 16 }}>big things in tech today</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26, gap: 14 }}>
          {stories.map((story, index) => (
            <div key={story.url} style={{ display: 'flex', alignItems: 'flex-start', fontSize: 27, lineHeight: 1.25 }}>
              <span style={{ color: BLUE, fontWeight: 700, width: 46, flexShrink: 0 }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span style={{ fontWeight: 400 }}>{clip(story.title, 78)}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', marginTop: 'auto', color: MUTED, fontSize: 21 }}>
          Free daily brief · yourtrace.online/brief
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
