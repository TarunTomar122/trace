import { interpolate, useCurrentFrame } from "remotion";
import { display, sans } from "../../fonts";
import { DeckStoryCard } from "../../components/DeckStoryCard";
import { MOCK_STORIES } from "../../components/mock-stories";
import { LAND_ACCENT, LAND_BG, LAND_CARD_H, LAND_CARD_W, LAND_PAD_LEFT, LAND_PAD_RIGHT } from "../landscape-layout";
import { useSpringIn } from "../../components/reel-helpers";

export const LandscapeHook: React.FC = () => {
  const frame = useCurrentFrame();
  const text = useSpringIn(0, 24);
  const card = useSpringIn(14, 36);

  const strike = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
      <div style={{ flex: "0 0 620px", ...text }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <div
            style={{
              fontFamily: display,
              fontWeight: 800,
              fontSize: 72,
              letterSpacing: -3,
              color: "#c4bdb5",
              lineHeight: 1.1,
              textDecoration: strike > 0 ? "line-through" : "none",
              textDecorationColor: LAND_ACCENT,
              textDecorationThickness: 4,
            }}
          >
            Doomscrolling
          </div>
        </div>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 96,
            letterSpacing: -4,
            color: "#1a1a1a",
            lineHeight: 0.95,
            marginTop: 8,
          }}
        >
          → Staying
        </div>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: 96,
            letterSpacing: -4,
            color: LAND_ACCENT,
            lineHeight: 0.95,
          }}
        >
          informed.
        </div>
        <div
          style={{
            fontFamily: sans,
            fontSize: 26,
            color: "#6b6460",
            marginTop: 24,
            maxWidth: 460,
            lineHeight: 1.4,
          }}
        >
          Trace is the AI news app built for developers, founders, and PMs.
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", ...card }}>
        <DeckStoryCard story={MOCK_STORIES[0]} width={LAND_CARD_W} height={LAND_CARD_H} />
      </div>
    </div>
  );
};