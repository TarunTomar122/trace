import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { fontGrotesk, fontMono } from "../fonts";

const BG = "#f4efe7";

// ─────────────────────────────────────────────────────────────────────────────
// Phase A: Number Slam  (frames 0–130)
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { number: "47",      label: "unread newsletters",  sub: "this week alone." },
  { number: "12",      label: "browser tabs open",   sub: "right now." },
  { number: "2 hours", label: "lost scrolling",      sub: "to find 3 useful things." },
];
const STAT_START    = [0, 42, 84];
const STAT_DURATION = 44;

function StatSlam({ number, label, sub, startFrame }: {
  number: string; label: string; sub: string; startFrame: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterP = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, stiffness: 260, mass: 0.7 },
    durationInFrames: 12,
  });

  const opacity =
    interpolate(enterP, [0, 1], [0, 1]) *
    interpolate(frame, [startFrame + 30, startFrame + STAT_DURATION], [1, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity }}>
      <div style={{
        fontFamily: fontGrotesk, fontSize: 148, fontWeight: 700,
        color: "#1a1a1a", letterSpacing: "-0.05em", lineHeight: 1,
        transform: `scale(${interpolate(enterP, [0, 1], [1.28, 1])})`,
      }}>
        {number}
      </div>
      <div style={{
        marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        transform: `translateY(${interpolate(enterP, [0, 1], [18, 0])}px)`,
      }}>
        <span style={{ fontFamily: fontGrotesk, fontSize: 32, fontWeight: 600, color: "rgba(0,0,0,0.45)", letterSpacing: "-0.01em" }}>
          {label}
        </span>
        <span style={{ fontFamily: fontMono, fontSize: 15, color: "rgba(0,0,0,0.28)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
          {sub}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase B: Notification flood + fall  (frames 128–265)
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATIONS = [
  { source: "TechCrunch",   dot: "#0AE448", headline: "Google turns Maps into a conversational AI product",         ago: "2m ago",  x: 2,  y: 2,  slideFrom: "top"    },
  { source: "The Verge",    dot: "#FF3B30", headline: "Apple is redesigning Siri from the ground up",               ago: "4m ago",  x: 57, y: 1,  slideFrom: "top"    },
  { source: "Bloomberg",    dot: "#2464F6", headline: "Meta cutting 20% of workforce in major restructuring",       ago: "6m ago",  x: 28, y: 8,  slideFrom: "top"    },
  { source: "Reuters",      dot: "#FF7300", headline: "OpenAI closes $40B funding round at $300B valuation",        ago: "9m ago",  x: 68, y: 12, slideFrom: "right"  },
  { source: "Wired",        dot: "#6b6b6b", headline: "Nvidia announces next-gen Blackwell Ultra GPU",              ago: "11m ago", x: 5,  y: 18, slideFrom: "left"   },
  { source: "Hacker News",  dot: "#FF6600", headline: "Ask HN: How are you using AI in your daily workflow?",      ago: "13m ago", x: 44, y: 20, slideFrom: "top"    },
  { source: "Ars Technica", dot: "#DD4814", headline: "Microsoft Copilot now embedded in every Windows feature",    ago: "15m ago", x: 74, y: 26, slideFrom: "right"  },
  { source: "9to5Google",   dot: "#4285F4", headline: "Pixel 9a spotted in FCC filings ahead of May reveal",       ago: "17m ago", x: 1,  y: 34, slideFrom: "left"   },
  { source: "The Verge",    dot: "#FF3B30", headline: "Tesla FSD 13.2 rolling out with major highway improvements", ago: "19m ago", x: 38, y: 35, slideFrom: "bottom" },
  { source: "TechCrunch",   dot: "#0AE448", headline: "Stripe processes $1T in payments for the first time",       ago: "21m ago", x: 62, y: 40, slideFrom: "right"  },
  { source: "Bloomberg",    dot: "#2464F6", headline: "Amazon AWS revenue grows 37% — cloud wars intensify",        ago: "23m ago", x: 16, y: 47, slideFrom: "left"   },
  { source: "Wired",        dot: "#6b6b6b", headline: "The AI energy crisis: data centers now use more than France",ago: "25m ago", x: 48, y: 51, slideFrom: "top"    },
  { source: "Reuters",      dot: "#FF7300", headline: "ByteDance TikTok ban appeal heads to Supreme Court",         ago: "27m ago", x: 76, y: 54, slideFrom: "right"  },
  { source: "Ars Technica", dot: "#DD4814", headline: "GitHub Copilot passes 1.3 million paying developers",        ago: "28m ago", x: 3,  y: 60, slideFrom: "left"   },
  { source: "Hacker News",  dot: "#FF6600", headline: "DeepSeek-V3 beats GPT-4o on most benchmarks — paper",       ago: "30m ago", x: 32, y: 63, slideFrom: "bottom" },
  { source: "9to5Google",   dot: "#4285F4", headline: "Android 16 developer preview 3 drops with new APIs",         ago: "31m ago", x: 60, y: 67, slideFrom: "bottom" },
  { source: "TechCrunch",   dot: "#0AE448", headline: "Perplexity AI raises $500M at $9B valuation",                ago: "33m ago", x: 10, y: 74, slideFrom: "left"   },
  { source: "The Verge",    dot: "#FF3B30", headline: "EU fines Apple €1.8B over App Store antitrust violations",   ago: "35m ago", x: 42, y: 76, slideFrom: "bottom" },
  { source: "Bloomberg",    dot: "#2464F6", headline: "Sequoia closes $9B fund focused entirely on AI bets",        ago: "36m ago", x: 70, y: 80, slideFrom: "right"  },
  { source: "Reuters",      dot: "#FF7300", headline: "Reddit IPO surges 48% on first day of trading",              ago: "38m ago", x: 20, y: 85, slideFrom: "bottom" },
  { source: "Wired",        dot: "#6b6b6b", headline: "Inside OpenAI's plan to charge $2,000/month for agents",    ago: "40m ago", x: 50, y: 88, slideFrom: "bottom" },
  { source: "Hacker News",  dot: "#FF6600", headline: "Show HN: I built a 10ms full-text search engine in Rust",   ago: "42m ago", x: 78, y: 91, slideFrom: "bottom" },
];

const FLOOD_START   = 128;
const FLOOD_STAGGER = 4;
const FALL_START    = 218;
const FALL_DUR      = 48;

function slideOffset(dir: string) {
  if (dir === "top")   return { dx: 0,    dy: -90 };
  if (dir === "left")  return { dx: -120, dy: 0   };
  if (dir === "right") return { dx: 120,  dy: 0   };
  return                      { dx: 0,    dy: 90  };
}

function NotificationCard({
  source, dot, headline, ago, x, y, slideFrom, appearFrame,
}: (typeof NOTIFICATIONS)[0] & { appearFrame: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { dx: sdx, dy: sdy } = slideOffset(slideFrom);

  const enterP = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 18, stiffness: 220, mass: 0.6 },
    durationInFrames: 14,
  });

  const fallDelay = FALL_START + (x / 100) * 8;
  const fallP = interpolate(frame, [fallDelay, fallDelay + FALL_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const fallY   = fallP * 1400;
  const fallRot = interpolate(fallP, [0, 1], [0, (x > 50 ? 1 : -1) * 12]);
  const fallOp  = interpolate(fallP, [0.55, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (frame < appearFrame) return null;

  return (
    <div style={{
      position: "absolute",
      left: `${x}%`, top: `${y}%`,
      width: 338,
      transform: `translate(${interpolate(enterP, [0, 1], [sdx, 0])}px, ${interpolate(enterP, [0, 1], [sdy, 0]) + fallY}px) rotate(${fallRot}deg)`,
      opacity: interpolate(enterP, [0, 1], [0, 1]) * fallOp,
      borderRadius: 14,
      backgroundColor: "#ffffff",
      border: "1px solid rgba(0,0,0,0.07)",
      padding: "11px 14px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: dot, flexShrink: 0 }} />
        <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.38)", letterSpacing: "0.08em", textTransform: "uppercase" as const, flex: 1 }}>
          {source}
        </span>
        <span style={{ fontFamily: fontMono, fontSize: 10, color: "rgba(0,0,0,0.25)" }}>{ago}</span>
      </div>
      <p style={{
        fontFamily: fontGrotesk, fontSize: 13, fontWeight: 500, color: "rgba(0,0,0,0.78)",
        lineHeight: 1.45, margin: 0,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
      }}>
        {headline}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase C: Introducing Trace  (frames 272–440)
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_START = 272;

function IntroText() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introP  = spring({ frame: frame - TEXT_START,        fps, config: { damping: 200 }, durationInFrames: 22 });
  const traceP  = spring({ frame: frame - (TEXT_START + 20), fps, config: { damping: 200 }, durationInFrames: 22 });

  const dividerW = interpolate(frame, [TEXT_START + 48, TEXT_START + 68], [0, 200], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const tag1P = interpolate(frame, [TEXT_START + 72, TEXT_START + 96], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });
  const tag2P = interpolate(frame, [TEXT_START + 100, TEXT_START + 124], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });

  const blockOpacity = interpolate(frame, [TEXT_START + 148, TEXT_START + 168], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: blockOpacity,
    }}>
      {/* "Introducing" */}
      <div style={{
        fontFamily: fontMono, fontSize: 15, fontWeight: 400,
        color: "rgba(0,0,0,0.32)", letterSpacing: "0.22em", textTransform: "uppercase" as const,
        marginBottom: 20,
        opacity: interpolate(introP, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(introP, [0, 1], [14, 0])}px)`,
      }}>
        Introducing
      </div>

      {/* Logo + "Trace" — perfectly centered row */}
      <div style={{
        display: "flex", flexDirection: "row", alignItems: "center",
        justifyContent: "center", gap: 20,
        opacity: interpolate(traceP, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(traceP, [0, 1], [20, 0])}px)`,
        marginBottom: 30,
      }}>
        <Img
          src={staticFile("trace.webp")}
          style={{ width: 64, height: 64, objectFit: "contain", display: "block", flexShrink: 0 }}
        />
        <span style={{
          fontFamily: fontGrotesk, fontSize: 80, fontWeight: 700,
          color: "#1a1a1a", letterSpacing: "-0.04em", lineHeight: 1,
        }}>
          Trace
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: dividerW, height: 1, backgroundColor: "rgba(0,0,0,0.12)", marginBottom: 28 }} />

      {/* Taglines */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: fontGrotesk, fontSize: 28, fontWeight: 600,
          color: "rgba(0,0,0,0.65)", letterSpacing: "-0.02em",
          opacity: tag1P, transform: `translateY(${interpolate(tag1P, [0, 1], [12, 0])}px)`,
          display: "block",
        }}>
          It reads the internet.
        </span>
        <span style={{
          fontFamily: fontGrotesk, fontSize: 28, fontWeight: 600,
          color: "rgba(0,0,0,0.32)", letterSpacing: "-0.02em",
          opacity: tag2P, transform: `translateY(${interpolate(tag2P, [0, 1], [12, 0])}px)`,
          display: "block",
        }}>
          So you read what matters.
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export const ProblemScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {STATS.map((stat, i) => (
        <StatSlam key={i} {...stat} startFrame={STAT_START[i]} />
      ))}

      {NOTIFICATIONS.map((n, i) => (
        <NotificationCard key={i} {...n} appearFrame={FLOOD_START + i * FLOOD_STAGGER} />
      ))}

      <IntroText />
    </AbsoluteFill>
  );
};
