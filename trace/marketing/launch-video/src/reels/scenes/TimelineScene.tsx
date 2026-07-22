import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { display, sans, serif } from "../../fonts";
import { MOCK_STORIES } from "../../components/mock-stories";
import { REEL_BG } from "../../components/trace-theme";
import { useSpringIn } from "../../components/reel-helpers";

const ACCENT = "#F59E0B";

const EVENTS = [
  { source: "TechCrunch", time: "2h ago", title: "OpenAI ships GPT-5 developer API tier" },
  { source: "The Verge", time: "1h ago", title: "Benchmarks show major coding gains" },
  { source: "Ars Technica", time: "45m ago", title: "Frontier labs race to integrate new stack" },
];

function resolveImage(image: string): string {
  return image.startsWith("http") ? image : staticFile(image);
}

/** Full-bleed topic view — big type, real app timeline styling. */
export const TimelineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headline = useSpringIn(0, 32);
  const hero = useSpringIn(12, 40);
  const story = MOCK_STORIES[0];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: REEL_BG,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Headlines */}
      <div style={{ padding: "56px 48px 28px", ...headline }}>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 88,
            letterSpacing: -3,
            color: "#1a1a1a",
            lineHeight: 1,
          }}
        >
          Every angle.
        </div>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 88,
            letterSpacing: -3,
            color: "#C8622A",
            lineHeight: 1.05,
            marginTop: 4,
          }}
        >
          One timeline.
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          ...hero,
          position: "relative",
          height: 480,
          margin: "0 32px",
          borderRadius: 20,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <Img
          src={resolveImage(story.image)}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 32, right: 32, bottom: 32 }}>
          <div
            style={{
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 20,
              color: "rgba(255,255,255,0.75)",
              marginBottom: 12,
            }}
          >
            {story.metaLine}
          </div>
          <div
            style={{
              fontFamily: serif,
              fontWeight: 600,
              fontSize: 40,
              lineHeight: 1.2,
              color: "#fff",
            }}
          >
            {story.title}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, padding: "36px 40px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontFamily: serif,
            fontWeight: 700,
            fontSize: 36,
            color: ACCENT,
          }}
        >
          Timeline
        </div>

        {EVENTS.map((event, i) => {
          const s = spring({
            frame: frame - 28 - i * 14,
            fps,
            config: { damping: 200, stiffness: 180 },
          });
          const slide = interpolate(s, [0, 1], [48, 0], {
            easing: Easing.out(Easing.cubic),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={event.source}
              style={{
                display: "flex",
                alignItems: "stretch",
                background: "#fff",
                borderRadius: 16,
                padding: "28px 28px 28px 0",
                boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${slide}px)`,
              }}
            >
              <div
                style={{
                  width: 5,
                  background: ACCENT,
                  borderRadius: 3,
                  marginRight: 24,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: sans,
                    fontWeight: 500,
                    fontSize: 22,
                    color: "#9a9a9a",
                    marginBottom: 10,
                  }}
                >
                  {event.source}
                  <span style={{ margin: "0 10px", color: "#d4cfc8" }}>·</span>
                  {event.time}
                </div>
                <div
                  style={{
                    fontFamily: serif,
                    fontWeight: 600,
                    fontSize: 32,
                    color: "#1a1a1a",
                    lineHeight: 1.25,
                  }}
                >
                  {event.title}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingRight: 20,
                  color: "#b8b8b8",
                  fontSize: 32,
                  fontWeight: 300,
                }}
              >
                ›
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};