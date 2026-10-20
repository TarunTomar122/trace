import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontGrotesk, fontMono } from "../fonts";

// ── Data ──────────────────────────────────────────────────────────────────────

const FILTER_PILLS = ["All", "AI", "Robotics", "Tech", "Startups", "Markets"];

const SIDEBAR_TOPICS = [
  { title: "Google turns Maps into an AI navigation product", sources: 5, tag: "AI" },
  { title: "Meta confirms 20% workforce reduction",           sources: 3, tag: "Tech" },
  { title: "Apple is redesigning Siri from scratch",         sources: 4, tag: "AI" },
  { title: "Stripe launches AI-powered revenue tools",       sources: 2, tag: "Startups" },
];

// Story 1 — Google Maps
const S1_PILLS    = ["TechCrunch", "The Verge", "9to5Google", "Ars Technica", "Wired"];
const S1_SUMMARY  = "Google is turning Maps into a conversational AI product. \"Ask Maps\" lets you type natural-language questions and get Gemini-powered answers instead of pin lists. Immersive View is expanding to 150+ cities, and Live View AR now shows real-time crowd levels pulled from Search.";
const S1_POINTS   = [
  "\"Ask Maps\" replaces pin-browsing with Gemini-powered conversational search.",
  "Immersive View for routes expands to 150+ cities with live traffic overlays.",
  "Live View AR now surfaces crowd levels and wait times in the camera feed.",
];
const S1_TRAIL = [
  { source: "TechCrunch", text: "Google unveils Ask Maps at I/O — Gemini replaces the traditional search-and-scroll loop." },
  { source: "The Verge",  text: "Hands-on: Ask Maps handles vague queries well, still struggles with hyperlocal context." },
];

// Story 2 — Meta
const S2_PILLS   = ["Bloomberg", "Reuters", "The Verge"];
const S2_SUMMARY = "Meta is cutting roughly 20% of its workforce as part of a restructuring aimed at accelerating AI development and flattening management. Engineering roles are protected; the cuts target middle management and non-technical functions.";
const S2_POINTS  = [
  "Zuckerberg frames this as removing low performers, not a cost reduction.",
  "Engineering roles protected; management layers targeted for elimination.",
  "Severance packages more generous than the 2022 round of layoffs.",
];

// Thumbnail gradients (SVG-based, abstract but recognisable)
function ThumbnailGoogle({ wide = false }: { wide?: boolean }) {
  const w = 260;
  const h = 150;
  const cx = w / 2, cy = h / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", width: w }}>
      <defs>
        <linearGradient id="gmap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#34d399" />
          <stop offset="50%"  stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#gmap)" />
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((t, i) => (
        <line key={`h${i}`} x1={0} y1={h * t} x2={w} y2={h * t} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      ))}
      {[0.2, 0.4, 0.6, 0.8].map((t, i) => (
        <line key={`v${i}`} x1={w * t} y1={0} x2={w * t} y2={h} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      ))}
      {/* Road lines */}
      <line x1={w * 0.15} y1={h * 0.5} x2={cx - 20} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
      <line x1={cx + 20} y1={cy} x2={w * 0.85} y2={h * 0.35} stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
      {/* Pin */}
      <circle cx={cx} cy={cy - 8} r={14} fill="white" opacity={0.95} />
      <circle cx={cx} cy={cy - 8} r={6}  fill="#3b82f6" />
      <line   x1={cx} y1={cy + 6} x2={cx} y2={cy + 18} stroke="white" strokeWidth="3" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

function ThumbnailMeta({ wide = false }: { wide?: boolean }) {
  const w = 260;
  const h = 150;
  const cx = w / 2, cy = h / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", width: w }}>
      <defs>
        <linearGradient id="meta2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#1877f2" />
          <stop offset="100%" stopColor="#0a3d8f" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#meta2)" />
      {/* Three people silhouettes */}
      <circle cx={cx - 60} cy={cy - 10} r={16} fill="rgba(255,255,255,0.22)" />
      <circle cx={cx}      cy={cy - 16} r={20} fill="rgba(255,255,255,0.32)" />
      <circle cx={cx + 60} cy={cy - 10} r={16} fill="rgba(255,255,255,0.22)" />
      {/* Down arrow — layoff signal */}
      <polyline points={`${cx - 12},${cy + 28} ${cx},${cy + 44} ${cx + 12},${cy + 28}`}
        stroke="rgba(255,255,255,0.65)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1={cx} y1={cy + 14} x2={cx} y2={cy + 44} stroke="rgba(255,255,255,0.65)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Timing constants ──────────────────────────────────────────────────────────
// Content builds FAST — all within ~160 frames
const T_TOOLBAR   = 0;
const T_FILTERS   = 8;   // filter pills stagger start
const T_SIDEBAR   = 10;  // sidebar topics stagger start
const T_PILLS     = 45;  // source pills
const T_HEADLINE  = 55;  // headline + thumbnail
const T_SUMMARY   = 72;
const T_POINTS    = 88;  // all key points land together
const T_TRAIL     = 120;
// Filter switch All→AI, story switch
const T_FILTER_SWITCH = 185; // AI pill click
const T_STORY2        = 320; // sidebar story 2 click
// Click pulse moments (slightly before the switch fires)
const T_CLICK_PILL    = T_FILTER_SWITCH - 6;
const T_CLICK_TOPIC   = T_STORY2 - 6;

// ── Component ─────────────────────────────────────────────────────────────────
export const AppMockup: React.FC<{ buildFrame: number }> = ({ buildFrame: f }) => {
  const { fps } = useVideoConfig();

  // Active filter: 0=All → 1=AI at T_FILTER_SWITCH
  const filterSwitchP = interpolate(f, [T_FILTER_SWITCH, T_FILTER_SWITCH + 18], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const activeFilter = filterSwitchP > 0.5 ? 1 : 0; // 0=All, 1=AI

  const activeTopic  = f >= T_STORY2 ? 1 : 0;

  // Toolbar
  const toolbarOp = interpolate(f, [T_TOOLBAR, T_TOOLBAR + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Filter pills
  const filterOps = FILTER_PILLS.map((_, i) =>
    interpolate(f, [T_FILTERS + i * 6, T_FILTERS + i * 6 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  // Sidebar topics
  const topicOps = SIDEBAR_TOPICS.map((_, i) => spring({
    frame: f - (T_SIDEBAR + i * 10), fps, config: { damping: 200 }, durationInFrames: 14,
  }));

  // Source pills
  const pillOps = S1_PILLS.map((_, i) =>
    interpolate(f, [T_PILLS + i * 6, T_PILLS + i * 6 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  // Headline
  const headlineP = spring({ frame: f - T_HEADLINE, fps, config: { damping: 200 }, durationInFrames: 18 });

  // Thumbnail
  const thumbP = spring({ frame: f - (T_HEADLINE + 4), fps, config: { damping: 200 }, durationInFrames: 18 });

  // Summary
  const summaryOp = interpolate(f, [T_SUMMARY, T_SUMMARY + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Key points — all land together with a tiny stagger
  const pointOps = S1_POINTS.map((_, i) =>
    interpolate(f, [T_POINTS + i * 14, T_POINTS + i * 14 + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  // Source trail
  const trailOp = interpolate(f, [T_TRAIL, T_TRAIL + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const trailItemOps = S1_TRAIL.map((_, i) =>
    interpolate(f, [T_TRAIL + 14 + i * 20, T_TRAIL + 30 + i * 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  // Click pulse on AI filter pill
  const pillClickP = spring({ frame: f - T_CLICK_PILL, fps, config: { damping: 10, stiffness: 380, mass: 0.5 }, durationInFrames: 10 });
  const pillClickScale = 1 + interpolate(pillClickP, [0, 0.4, 1], [0, 0.12, 0]);

  // Click pulse on sidebar topic 1 (index=1 = Meta story)
  const topicClickP = spring({ frame: f - T_CLICK_TOPIC, fps, config: { damping: 10, stiffness: 380, mass: 0.5 }, durationInFrames: 10 });
  const topicClickScale = 1 + interpolate(topicClickP, [0, 0.4, 1], [0, 0.06, 0]);

  // Story 2 transition
  const story2Op  = interpolate(f, [T_STORY2, T_STORY2 + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const story1Out = interpolate(f, [T_STORY2 - 5, T_STORY2 + 15], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: 1100, borderRadius: 20, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 40px 100px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)" }}>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "12px 20px", opacity: toolbarOp }}>
        <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map(c => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: c }} />
          ))}
        </div>
        <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#34d399", display: "inline-block" }} />
        <span style={{ fontFamily: fontMono, fontSize: 12, color: "rgba(0,0,0,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginLeft: 6 }}>
          Your briefing
        </span>
        <span style={{ marginLeft: "auto", fontFamily: fontMono, fontSize: 11, color: "rgba(0,0,0,0.25)" }}>Just now</span>
      </div>

      {/* ── Filter pills row ── */}
      <div style={{ display: "flex", gap: 6, padding: "10px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)", opacity: toolbarOp }}>
        {FILTER_PILLS.map((pill, i) => {
          const isActive = i === activeFilter;
          // pill index 1 = "AI"
          const clickScale = i === 1 ? pillClickScale : 1;
          return (
            <div
              key={pill}
              style={{
                fontFamily: fontGrotesk,
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#ffffff" : "rgba(0,0,0,0.45)",
                backgroundColor: isActive ? "#1a1a1a" : "rgba(0,0,0,0.05)",
                borderRadius: 100,
                padding: "5px 14px",
                opacity: filterOps[i],
                transform: `translateY(${interpolate(filterOps[i], [0, 1], [8, 0])}px) scale(${clickScale})`,
                transformOrigin: "center center",
              }}
            >
              {pill}
            </div>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex" }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 220, borderRight: "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
          {SIDEBAR_TOPICS.map((topic, i) => {
            const isActive = i === activeTopic;
            const op = topicOps[i];
            // Dim non-AI topics when AI filter is active
            const filterDim = activeFilter === 1 && topic.tag !== "AI"
              ? interpolate(f, [T_FILTER_SWITCH, T_FILTER_SWITCH + 18], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
              : 1;
            const tClickScale = i === 1 ? topicClickScale : 1;
            return (
              <div key={i} style={{
                padding: "13px 16px",
                borderBottom: i < SIDEBAR_TOPICS.length - 1 ? "1px solid rgba(0,0,0,0.07)" : "none",
                backgroundColor: isActive ? "#f7f3eb" : "transparent",
                opacity: op * filterDim,
                transform: `translateX(${interpolate(op, [0, 1], [-12, 0])}px) scale(${tClickScale})`,
                transformOrigin: "left center",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                  <p style={{ fontFamily: fontGrotesk, fontSize: 12, lineHeight: 1.45, fontWeight: isActive ? 600 : 400, color: isActive ? "#1a1a1a" : "rgba(0,0,0,0.4)", margin: 0, flex: 1,
                    overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                    {topic.title}
                  </p>
                  <span style={{ fontFamily: fontMono, fontSize: 9, color: "rgba(0,0,0,0.25)", backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 4, padding: "2px 5px", flexShrink: 0, marginTop: 1 }}>
                    {topic.tag}
                  </span>
                </div>
                <p style={{ fontFamily: fontMono, fontSize: 10, color: "rgba(0,0,0,0.22)", margin: 0 }}>
                  {topic.sources} sources
                </p>
              </div>
            );
          })}
        </div>

        {/* ── Main panel ── */}
        <div style={{ flex: 1, padding: "20px 24px", minHeight: 520, position: "relative", overflow: "hidden" }}>

          {/* ── Story 1 ── */}
          <div style={{ opacity: story1Out }}>
            {/* Source pills */}
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginBottom: 14 }}>
              {S1_PILLS.map((pill, i) => (
                <span key={pill} style={{ fontFamily: fontGrotesk, fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.4)", backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 100, padding: "3px 10px", opacity: pillOps[i] }}>
                  {pill}
                </span>
              ))}
            </div>

            {/* Headline */}
            <h2 style={{ fontFamily: fontGrotesk, fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 12px 0",
              opacity: interpolate(headlineP, [0, 1], [0, 1]), transform: `translateY(${interpolate(headlineP, [0, 1], [12, 0])}px)` }}>
              Google turns Maps into an AI navigation product
            </h2>

            {/* Thumbnail — below title, left-aligned */}
            <div style={{ width: 260, height: 150, borderRadius: 10, overflow: "hidden", marginBottom: 14,
              opacity: interpolate(thumbP, [0, 1], [0, 1]),
              transform: `scale(${interpolate(thumbP, [0, 1], [0.94, 1])}) translateY(${interpolate(thumbP, [0, 1], [8, 0])}px)` }}>
              <ThumbnailGoogle />
            </div>

            {/* Summary */}
            <p style={{ fontFamily: fontGrotesk, fontSize: 13, lineHeight: 1.7, color: "rgba(0,0,0,0.55)", margin: "0 0 16px 0", opacity: summaryOp }}>
              {S1_SUMMARY}
            </p>

            {/* Key points */}
            <div style={{ marginBottom: 18 }}>
              {S1_POINTS.map((point, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 9,
                  opacity: pointOps[i], transform: `translateX(${interpolate(pointOps[i], [0, 1], [-8, 0])}px)` }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 8, fontWeight: 700, color: "#059669" }}>{i + 1}</span>
                  </span>
                  <p style={{ fontFamily: fontGrotesk, fontSize: 12, lineHeight: 1.6, color: "rgba(0,0,0,0.55)", margin: 0 }}>{point}</p>
                </div>
              ))}
            </div>

            {/* Source trail */}
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 14, opacity: trailOp }}>
              <p style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, color: "rgba(0,0,0,0.25)", textTransform: "uppercase" as const, letterSpacing: "0.12em", margin: "0 0 10px 0" }}>
                Source highlights
              </p>
              {S1_TRAIL.map((entry, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, opacity: trailItemOps[i] }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: i === 0 ? "#34d399" : "rgba(0,0,0,0.12)", flexShrink: 0 }} />
                    {i < S1_TRAIL.length - 1 && <span style={{ width: 1, flex: 1, backgroundColor: "rgba(0,0,0,0.08)", marginTop: 2 }} />}
                  </div>
                  <div style={{ paddingBottom: 6 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.35)" }}>{entry.source}</span>
                    <p style={{ fontFamily: fontGrotesk, fontSize: 12, lineHeight: 1.5, color: "rgba(0,0,0,0.5)", margin: "2px 0 0 0" }}>{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Story 2 ── */}
          {f >= T_STORY2 - 5 && (
            <div style={{ position: "absolute", top: 20, left: 24, right: 24,
              opacity: story2Op, transform: `translateY(${interpolate(story2Op, [0, 1], [20, 0])}px)` }}>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginBottom: 14 }}>
                {S2_PILLS.map(pill => (
                  <span key={pill} style={{ fontFamily: fontGrotesk, fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.4)", backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 100, padding: "3px 10px" }}>{pill}</span>
                ))}
              </div>
              <h2 style={{ fontFamily: fontGrotesk, fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: "#1a1a1a", letterSpacing: "-0.025em", margin: "0 0 12px 0" }}>
                Meta confirms 20% workforce reduction
              </h2>
              <div style={{ width: 260, height: 150, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                <ThumbnailMeta />
              </div>
              <p style={{ fontFamily: fontGrotesk, fontSize: 13, lineHeight: 1.7, color: "rgba(0,0,0,0.55)", margin: "0 0 16px 0" }}>
                {S2_SUMMARY}
              </p>
              {S2_POINTS.map((point, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 9 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 8, fontWeight: 700, color: "#059669" }}>{i + 1}</span>
                  </span>
                  <p style={{ fontFamily: fontGrotesk, fontSize: 12, lineHeight: 1.6, color: "rgba(0,0,0,0.55)", margin: 0 }}>{point}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
