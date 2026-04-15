import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

type FeedItem = {
  id: string;
  type: string;
  title: string;
  url: string;
  description?: string;
  tags?: string[];
  metadata?: {
    why_relevant?: string;
  };
};

// Icon components matching lucide-react
const YoutubeIcon = ({ size = 18, color }: { size?: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </svg>
);

const GithubIcon = ({ size = 18, color }: { size?: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const BookOpenIcon = ({ size = 18, color }: { size?: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const MessageCircleIcon = ({ size = 18, color }: { size?: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

const SparklesIcon = ({ size = 18, color }: { size?: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const sourceConfig: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  video: { icon: YoutubeIcon, color: "#ef4444", label: "VIDEO" },
  repo: { icon: GithubIcon, color: "#8b5cf6", label: "REPO" },
  paper: { icon: BookOpenIcon, color: "#3b82f6", label: "PAPER" },
  blog: { icon: BookOpenIcon, color: "#10b981", label: "ARTICLE" },
  discussion: { icon: MessageCircleIcon, color: "#f59e0b", label: "DISCUSSION" },
  launch: { icon: SparklesIcon, color: "#d946ef", label: "LAUNCH" },
};

export const FeedCard: React.FC<{
  item: FeedItem;
  delay: number;
  showCommentHighlight?: boolean;
  commentButtonScale?: number;
}> = ({ item, delay, showCommentHighlight = false, commentButtonScale = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const config = sourceConfig[item.type] || sourceConfig.blog;
  const IconComponent = config.icon;

  // Slide up animation with stagger - faster and snappier
  const translateY = spring({
    frame: frame - delay,
    fps,
    from: 30,
    to: 0,
    durationInFrames: 18,
    config: {
      damping: 10,
      mass: 0.5,
    },
  });

  const opacity = spring({
    frame: frame - delay,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 18,
  });

  return (
    <article
      style={{
        paddingTop: "32px",
        paddingBottom: "32px",
        borderBottom: "2px solid rgba(176, 176, 176, 0.2)",
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div style={{ display: "flex", gap: "24px", alignItems: "start" }}>
        {/* Source icon - actual icon with colored background */}
        <div
          style={{
            width: "56px",
            height: "56px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${config.color}0D`,
            border: `2px solid ${config.color}1A`,
          }}
        >
          <IconComponent size={26} color={config.color} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Source label */}
          <div style={{ marginBottom: "12px" }}>
            <span
              style={{
                fontFamily: "Geist Mono, monospace",
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: config.color,
                fontWeight: 600,
              }}
            >
              {config.label}
            </span>
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "24px",
              lineHeight: "1.35",
              color: "#0a0a0a",
              margin: "0 0 12px 0",
              fontWeight: 400,
            }}
          >
            {item.title}
          </h3>

          {/* Why relevant */}
          {item.metadata?.why_relevant && (
            <p
              style={{
                fontFamily: "Geist Mono, monospace",
                fontSize: "13px",
                color: "rgba(59, 58, 58, 0.6)",
                margin: "0 0 20px 0",
                lineHeight: "1.6",
              }}
            >
              {item.metadata.why_relevant}
            </p>
          )}

          {/* Action icons row */}
          <div style={{ display: "flex", gap: "8px", marginLeft: "-12px" }}>
            {/* Thumbs up */}
            <div
              style={{
                padding: "12px",
                color: "rgba(59, 58, 58, 0.4)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </div>

            {/* Thumbs down */}
            <div
              style={{
                padding: "12px",
                color: "rgba(59, 58, 58, 0.4)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
            </div>

            {/* Comment */}
            <div
              style={{
                padding: "12px",
                color: showCommentHighlight ? "#3b82f6" : "rgba(59, 58, 58, 0.4)",
                transform: `scale(${commentButtonScale})`,
                backgroundColor: showCommentHighlight ? "rgba(59, 130, 246, 0.1)" : "transparent",
                borderRadius: "6px",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>

            {/* Bookmark */}
            <div
              style={{
                padding: "12px",
                color: "rgba(59, 58, 58, 0.4)",
                marginLeft: "auto",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
