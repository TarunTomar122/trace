const INK = '#1b1a17';
const MUTED = '#75705f';
const PAPER = '#faf9f5';
const PANEL = '#f5f3ed';
const RULE = '#e4e1d8';
const BLUE = '#2557d6';

const signalRows = [
  {
    number: '01',
    label: 'BRIEFINGS',
    title: 'Claude 7 replaces the president',
    detail: 'Cabinet cites the larger context window',
  },
  {
    number: '02',
    label: 'BUILDS',
    title: 'A toaster gets 12k GitHub stars',
    detail: 'README says “works on my kitchen”',
  },
  {
    number: '03',
    label: 'CONVERSATIONS',
    title: 'Tabs vs. spaces is finally settled',
    detail: 'It absolutely is not',
  },
] as const;

/** Shared JSX for opengraph-image + twitter-image (next/og subset). */
export function OgShareImageBody() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: PAPER,
        color: INK,
        padding: 32,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          border: `1px solid ${RULE}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '55%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '46px 52px 42px',
            borderRight: `1px solid ${RULE}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '0.28em',
                color: BLUE,
              }}
            >
              TRACE
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: MUTED,
              }}
            >
              UPDATED HOURLY
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'serif',
                fontSize: 70,
                lineHeight: 0.97,
                letterSpacing: '-0.035em',
              }}
            >
              <span>A daily feed</span>
              <span>for builders.</span>
            </div>
            <p
              style={{
                margin: '30px 0 0',
                maxWidth: 520,
                fontSize: 22,
                lineHeight: 1.45,
                color: MUTED,
              }}
            >
              AI and developer news, open-source projects, technical discussions, videos, and articles.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: BLUE,
            }}
          >
            YOURTRACE.ONLINE
            <span style={{ marginLeft: 12, fontSize: 20 }}>→</span>
          </div>
        </div>

        <div
          style={{
            width: '45%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 38,
            backgroundColor: PANEL,
          }}
        >
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: PAPER,
              border: `1px solid ${INK}`,
              boxShadow: `12px 12px 0 ${BLUE}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px',
                borderBottom: `1px solid ${RULE}`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: BLUE }}>
                TODAY&apos;S FEED
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: MUTED }}>
                5 MIN READ
              </span>
            </div>

            {signalRows.map((row) => (
              <div
                key={row.number}
                style={{
                  display: 'flex',
                  padding: '22px 20px',
                  borderBottom: row.number === '03' ? 'none' : `1px solid ${RULE}`,
                }}
              >
                <span
                  style={{
                    width: 42,
                    flexShrink: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: BLUE,
                  }}
                >
                  {row.number}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.16em',
                      color: MUTED,
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      marginTop: 8,
                      fontFamily: 'serif',
                      fontSize: 27,
                      lineHeight: 1.08,
                    }}
                  >
                    {row.title}
                  </span>
                  <span style={{ marginTop: 7, fontSize: 13, color: MUTED }}>{row.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
