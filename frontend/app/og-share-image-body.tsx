const INK = '#1b1a17';
const CREAM = '#f4f1e8';

const SITE = 'https://www.yourtrace.online';

// og-app-shot.png is 2934x1936; rendered at 980 wide it is 646 tall.
const SHOT_W = 980;
const SHOT_H = 646;

/** Share card in the style of a product launch post: logo, hook, real app shot in a browser frame. */
export function OgShareImageBody({ assetBase = SITE }: { assetBase?: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: CREAM,
        color: INK,
        paddingTop: 30,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${assetBase}/trace-logo.png`} alt="" width={28} height={28} />
        <span style={{ marginLeft: 12, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Trace
        </span>
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 44,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          textAlign: 'center',
        }}
      >
        Stay on top of tech and AI news
      </div>

      <div
        style={{
          marginTop: 18,
          width: SHOT_W,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fff',
          borderRadius: '16px 16px 0 0',
          overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(27, 26, 23, 0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 40,
            backgroundColor: '#f7f5ef',
            borderBottom: '1px solid #e7e2d5',
            padding: '0 18px',
          }}
        >
          <div style={{ display: 'flex', gap: 7 }}>
            <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: 9999, backgroundColor: '#28c840' }} />
          </div>
          <div
            style={{
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              height: 25,
              padding: '0 22px',
              borderRadius: 9999,
              backgroundColor: '#fff',
              border: '1px solid #e7e2d5',
              fontSize: 13,
              color: '#75705f',
            }}
          >
            yourtrace.online/feed
          </div>
          <div style={{ width: 52 }} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <img src={`${assetBase}/og-app-shot.png`} alt="" width={SHOT_W} height={SHOT_H} />
        </div>
      </div>
    </div>
  );
}
