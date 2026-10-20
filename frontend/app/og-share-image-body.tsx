import { OG, OgMark, OgWordmark } from './og-style';

// The email mock's sections; grey bars stand in for the stories so the static
// card never shows a stale headline.
const SECTIONS = ['Model releases', 'Top in AI', 'Top in Markets'];

/** Static share card for the site: the homepage line and the morning email beside it. */
export function OgShareImageBody() {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: '50px 60px 0 60px', backgroundColor: '#FFFFFF', color: OG.ink, fontFamily: OG.sans,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgWordmark />
        <span style={{ fontSize: 21, color: OG.muted }}>yourtrace.online</span>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 44 }}>
        <div style={{ width: 590, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: OG.serif, fontSize: 80, fontWeight: 500, lineHeight: 1.02 }}>
            <span>Fastest way to</span>
            <span>catch up on</span>
            <div style={{ display: 'flex' }}>
              <span style={{ backgroundColor: OG.highlight, padding: '0 8px', marginLeft: -8 }}>tech &amp; AI news</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, fontSize: 26, lineHeight: 1.4, color: OG.text }}>
            <span>The 10 stories that matter, grouped and</span>
            <span>summed up. Every morning, free.</span>
          </div>
        </div>

        {/* The morning email, running off the bottom edge. */}
        <div style={{
          width: 446, marginTop: 40, display: 'flex', flexDirection: 'column',
          backgroundColor: '#FFFFFF', border: `1px solid ${OG.line}`, borderBottom: 'none', borderRadius: '18px 18px 0 0',
          boxShadow: '0 24px 60px rgba(10, 10, 10, 0.10)', padding: '24px 28px 0 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${OG.line}` }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Trace Daily Brief</span>
              <span style={{ fontSize: 15, color: OG.muted, marginTop: 2 }}>Every morning</span>
            </div>
          </div>
          <span style={{ fontFamily: OG.serif, fontSize: 36, fontWeight: 500, marginTop: 18, marginBottom: 6 }}>10 big things today</span>
          {SECTIONS.map((label, index) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
              <OgMark size={21}>{label}</OgMark>
              <div style={{ width: index === 1 ? 300 : 340, height: 13, borderRadius: 3, backgroundColor: '#2B2B2B', marginTop: 14 }} />
              <div style={{ width: 360, height: 9, borderRadius: 3, backgroundColor: '#DCDCDC', marginTop: 11 }} />
              <div style={{ width: 290, height: 9, borderRadius: 3, backgroundColor: '#DCDCDC', marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
