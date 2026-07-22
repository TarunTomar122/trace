import { Img, staticFile } from "remotion";
import { sans } from "../fonts";
import { TraceColors } from "./trace-theme";
import type { MockStory } from "./mock-stories";

const BASE_WIDTH = 332;

type DeckStoryCardProps = {
  story: MockStory;
  colorScheme?: "light" | "dark";
  width: number;
  height: number;
  swipeHint?: string;
};

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text;
  return words.slice(0, limit).join(" ") + "...";
}

function resolveImage(image: string): string {
  return image.startsWith("http") ? image : staticFile(image);
}

/** Web mirror of trace/components/DeckStoryCard.tsx — scales with width for reels. */
export const DeckStoryCard: React.FC<DeckStoryCardProps> = ({
  story,
  colorScheme = "light",
  width,
  height,
  swipeHint = "Swipe up for next story",
}) => {
  const ins = TraceColors[colorScheme];
  const s = width / BASE_WIDTH;
  const radius = Math.round(12 * s);
  const imageHeight = Math.min(320 * s, Math.max(200 * s, Math.round(height * 0.44)));

  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: ins.canvas,
        display: "flex",
        flexDirection: "column",
        boxShadow: `0 ${18 * s}px ${48 * s}px rgba(0,0,0,0.14)`,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: imageHeight, background: "#1C1C1E" }}>
        <Img
          src={resolveImage(story.image)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 1,
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "42%",
            background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14 * s,
            right: 14 * s,
            bottom: 14 * s,
            display: "flex",
            alignItems: "center",
            gap: 6 * s,
            fontFamily: sans,
          }}
        >
          <span
            style={{
              flex: 1,
              fontWeight: 600,
              fontSize: 12 * s,
              color: "rgba(255,255,255,0.92)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {story.sourceName}
          </span>
          <span style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.45)" }}>·</span>
          <span style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.55)", fontWeight: 400 }}>
            {story.timeAgo}
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            top: 12 * s,
            right: 12 * s,
            width: 34 * s,
            height: 34 * s,
            borderRadius: 17 * s,
            background: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={16 * s}
            height={16 * s}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1B1B1B"
            strokeWidth="2"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: `${10 * s}px ${18 * s}px ${8 * s}px`,
          display: "flex",
          flexDirection: "column",
          gap: 6 * s,
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontWeight: 500,
            fontSize: 9 * s,
            lineHeight: `${11 * s}px`,
            letterSpacing: 0.15,
            color: ins.sub,
          }}
        >
          {story.metaLine}
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 400,
            fontSize: 19 * s,
            lineHeight: `${25 * s}px`,
            color: ins.textHead,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {story.title}
        </div>
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            fontFamily: sans,
            fontWeight: 400,
            fontSize: 15 * s,
            lineHeight: `${23 * s}px`,
            letterSpacing: 0.06,
            color: ins.textBody,
          }}
        >
          {truncateWords(story.overview, 62)}
        </div>
        {swipeHint ? (
          <div
            style={{
              fontFamily: sans,
              fontWeight: 500,
              fontSize: 9 * s,
              lineHeight: `${11 * s}px`,
              letterSpacing: 0.25,
              color: ins.sub,
            }}
          >
            {swipeHint}
          </div>
        ) : null}
      </div>
    </div>
  );
};