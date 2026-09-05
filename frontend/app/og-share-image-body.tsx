const INK = '#1b1a17';
const CREAM = '#f4f1e8';
const BLUE = '#2557d6';

const SITE = 'https://www.yourtrace.online';

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
        paddingTop: 32,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${assetBase}/trace-logo.png`} alt="" width={30} height={30} />
        <span style={{ marginLeft: 12, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Trace
        </span>
      </div>

      <div
        style={{
          marginTop: 14,
          maxWidth: 1020,
          fontSize: 54,
          fontWeight: 800,
          lineHeight: 1.04,
          letterSpacing: '-0.03em',
          textAlign: 'center',
        }}
      >
        Stay on top of tech and AI news
      </div>

      <div
        style={{
          marginTop: 22,
          width: 980,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(27, 26, 23, 0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 42,
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
              height: 26,
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
        <img src={`${assetBase}/og-app-shot.png`} alt="" width={980} height={358} />
      </div>
    </div>
  );
}
