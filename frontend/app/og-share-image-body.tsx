import { OG_LOGO_DATA_URL } from './og-assets';

const INK = '#171A20';
const BLUE = '#2557D6';
const MUTED = '#596675';

const sections = [
  ['01', 'AI & models', 'The releases worth knowing'],
  ['02', 'Company moves', 'The story behind the headlines'],
  ['03', 'Products & ideas', 'What comes next'],
];

/** Static, shareable picture of Trace's ten-story daily edition. */
export function OgShareImageBody() {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: '45px 56px', backgroundColor: '#F6F5F0', color: INK,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={OG_LOGO_DATA_URL} alt="" width={34} height={34} />
          <span style={{ marginLeft: 11, fontSize: 27, fontWeight: 700, letterSpacing: '-0.04em' }}>Trace</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.13em', color: BLUE }}>
          THE DAILY EDITION
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 38 }}>
        <div style={{ width: 646, display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: BLUE, fontSize: 17, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 17 }}>
            THE SIGNAL IN THE NOISE
          </div>
          <div style={{ display: 'flex', fontSize: 79, lineHeight: 0.98, fontWeight: 700, letterSpacing: '-0.06em' }}>
            <span style={{ color: BLUE }}>10</span><span style={{ marginLeft: 18 }}>big things</span>
          </div>
          <div style={{ fontSize: 79, lineHeight: 0.98, fontWeight: 700, letterSpacing: '-0.06em' }}>
            in tech &amp; AI.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', color: MUTED, fontSize: 25, lineHeight: 1.35, marginTop: 27 }}>
            <span>What happened. Why it matters.</span>
            <span>All in five minutes.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 36 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} style={{ width: 20, height: 6, borderRadius: 5, backgroundColor: i < 3 ? BLUE : '#CED8F2' }} />
            ))}
          </div>
        </div>

        <div style={{
          width: 370, height: 454, display: 'flex', flexDirection: 'column',
          backgroundColor: '#FFFFFF', border: '1px solid #DCE1E9', borderRadius: 20,
          padding: '26px 28px', boxShadow: '0 20px 50px rgba(26, 39, 76, 0.10)',
        }}>
          <div style={{ color: BLUE, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em' }}>TODAY&apos;S BRIEFING</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', marginTop: 7, marginBottom: 15 }}>
            10 stories. One clear picture.
          </div>
          {sections.map(([number, title, subtitle]) => (
            <div key={number} style={{ display: 'flex', borderTop: '1px solid #E8EBF0', padding: '17px 0' }}>
              <div style={{ width: 46, color: BLUE, fontSize: 22, fontWeight: 700 }}>{number}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{title}</div>
                <div style={{ color: MUTED, fontSize: 14, marginTop: 3 }}>{subtitle}</div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', color: BLUE, fontSize: 16, fontWeight: 700 }}>
            + 7 more things worth your time →
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED, fontSize: 16 }}>
        <span>Less scrolling. More understanding.</span>
        <span style={{ fontWeight: 700, color: INK }}>yourtrace.online</span>
      </div>
    </div>
  );
}
