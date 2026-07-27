/** Shared JSX for opengraph-image + twitter-image (next/og subset) */
export function OgShareImageBody() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f4efe7',
        padding: 72,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          maxWidth: 980,
        }}
      >
        <p
          style={{
            margin: 0,
            marginBottom: 36,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.28em',
            color: '#78716c',
          }}
        >
          TRACE
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              color: '#151515',
            }}
          >
            A feed for builders.
          </span>
        </div>
        <p
          style={{
            margin: 0,
            marginTop: 40,
            fontSize: 26,
            lineHeight: 1.45,
            color: '#57534e',
            maxWidth: 820,
          }}
        >
          Tech news, build logs, architecture, open source, design, and product in one place.
        </p>
      </div>
    </div>
  );
}
