import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { display, sans, serif } from "../../fonts";
import { MOCK_STORIES } from "../../components/mock-stories";
import { LAND_ACCENT, LAND_BG, LAND_PAD_LEFT, LAND_PAD_RIGHT } from "../landscape-layout";
import { useSpringIn } from "../../components/reel-helpers";

const EVENTS = [
  { source: "TechCrunch", time: "2h ago", title: "OpenAI ships GPT-5 developer API" },
  { source: "The Verge", time: "1h ago", title: "Benchmarks show major coding gains" },
  { source: "Hacker News", time: "20m ago", title: "Waitlist opens for production agents" },
];

export const LandscapeTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = useSpringIn(0, 20);
  const story = MOCK_STORIES[0];
  const image = story.image.startsWith("http") ? story.image : staticFile(story.image);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: LAND_BG,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: LAND_PAD_LEFT,
        paddingRight: LAND_PAD_RIGHT,
        gap: 56,
      }}
    >
      <div style={{ flex: "0 0 520px", ...text }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: "#1a1a1a", lineHeight: 0.95 }}>
          100+ sources.
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: "#1a1a1a", lineHeight: 0.95 }}>
          Every angle.
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, letterSpacing: -4, color: LAND_ACCENT, lineHeight: 0.95 }}>
          One story.
        </div>
      </div>

      <div
        style={{
          flex: 1,
          height: 780,
          background: "#fff",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "relative", height: 280, flexShrink: 0 }}>
          <Img src={image} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 1 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)",
            }}
          />
          <div style={{ position: "absolute", left: 28, right: 28, bottom: 24 }}>
            <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 26, color: "#fff", lineHeight: 1.25 }}>
              {story.title}
            </div>
          </div>
        </div>

        <div style={{ padding: "24px 28px", flex: 1 }}>
          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 22, color: "#F59E0B", marginBottom: 16 }}>
            Timeline
          </div>
          {EVENTS.map((event, i) => {
            const s = spring({ frame: frame - 18 - i * 10, fps, config: { damping: 200 } });
            return (
              <div
                key={event.source}
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: 20,
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `translateX(${interpolate(s, [0, 1], [24, 0], {
                    easing: Easing.out(Easing.cubic),
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <div style={{ width: 4, background: "#F59E0B", borderRadius: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: sans, fontSize: 15, color: "#9a9a9a", marginBottom: 4 }}>
                    {event.source} · {event.time}
                  </div>
                  <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, color: "#1a1a1a", lineHeight: 1.3 }}>
                    {event.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};