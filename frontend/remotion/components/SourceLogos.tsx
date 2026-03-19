import React from "react";
import { fontGrotesk } from "../fonts";

// Each logo is an icon SVG + wordmark span, side by side.
// Inline SVG geometry only — no SVG text nodes (fonts don't apply there).

const t = (s: TemplateStringsArray) => s[0]; // noop tag for readability

// ── TechCrunch ──────────────────────────────────────────────────────────────
export const TechCrunchLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Green circle with TC */}
    <svg width={38 * size} height={38 * size} viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="19" fill="#0AE448" />
      {/* T */}
      <rect x="8" y="11" width="10" height="2.5" rx="1" fill="#fff" />
      <rect x="12" y="11" width="2.5" height="16" rx="1" fill="#fff" />
      {/* C */}
      <path d="M22 14 a6 6 0 0 1 6 -3" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M28 27 a6 6 0 0 1 -6 -3" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M22 11 Q16 11 16 19 Q16 27 22 27" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#0AE448", letterSpacing: "-0.02em" }}>
      TechCrunch
    </span>
  </div>
);

// ── The Verge ────────────────────────────────────────────────────────────────
export const VergeLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Verge "V" chevron — their actual mark */}
    <svg width={32 * size} height={36 * size} viewBox="0 0 32 36">
      <polygon points="0,0 16,36 32,0 26,0 16,22 6,0" fill="#FF3B30" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#FF3B30", letterSpacing: "-0.02em" }}>
      The Verge
    </span>
  </div>
);

// ── Bloomberg ────────────────────────────────────────────────────────────────
export const BloombergLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Bloomberg "B" — bold terminal-style */}
    <svg width={32 * size} height={38 * size} viewBox="0 0 32 38">
      <rect x="4" y="3" width="5" height="32" fill="#2464F6" />
      {/* Top bump */}
      <path d="M9 3 Q24 3 24 12 Q24 19 9 19" stroke="#2464F6" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Bottom bump — bigger */}
      <path d="M9 19 Q26 19 26 29 Q26 38 9 38" stroke="#2464F6" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#2464F6", letterSpacing: "-0.02em" }}>
      Bloomberg
    </span>
  </div>
);

// ── Hacker News ──────────────────────────────────────────────────────────────
export const HackerNewsLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Orange square with Y — exactly the HN favicon */}
    <svg width={34 * size} height={34 * size} viewBox="0 0 34 34">
      <rect width="34" height="34" fill="#FF6600" />
      {/* Y shape */}
      <line x1="10" y1="7" x2="17" y2="19" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="24" y1="7" x2="17" y2="19" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="17" y1="19" x2="17" y2="29" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#FF6600", letterSpacing: "-0.02em" }}>
      Hacker News
    </span>
  </div>
);

// ── Reuters ──────────────────────────────────────────────────────────────────
export const ReutersLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Reuters "R" — bold geometric */}
    <svg width={28 * size} height={36 * size} viewBox="0 0 28 36">
      <rect x="4" y="2" width="5" height="32" fill="#FF7300" />
      <path d="M9 2 Q24 2 24 11 Q24 19 9 19" stroke="#FF7300" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Leg of R */}
      <line x1="16" y1="19" x2="26" y2="34" stroke="#FF7300" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#FF7300", letterSpacing: "-0.02em" }}>
      Reuters
    </span>
  </div>
);

// ── Wired ─────────────────────────────────────────────────────────────────────
export const WiredLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Wired W — bold angular */}
    <svg width={40 * size} height={30 * size} viewBox="0 0 40 30">
      <polyline points="2,3 8,27 14,12 20,27 26,3 32,27 38,3"
        stroke="#ffffff" strokeWidth="4" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
      WIRED
    </span>
  </div>
);

// ── Ars Technica ─────────────────────────────────────────────────────────────
export const ArsTechnicaLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Ars gear/circuit icon */}
    <svg width={34 * size} height={34 * size} viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="15" fill="none" stroke="#DD4814" strokeWidth="3" />
      <circle cx="17" cy="17" r="6" fill="#DD4814" />
      {/* Gear teeth */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 17 + 10 * Math.cos(rad);
        const y1 = 17 + 10 * Math.sin(rad);
        const x2 = 17 + 15 * Math.cos(rad);
        const y2 = 17 + 15 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#DD4814" strokeWidth="3" strokeLinecap="round" />;
      })}
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#DD4814", letterSpacing: "-0.02em" }}>
      Ars Technica
    </span>
  </div>
);

// ── 9to5Google ────────────────────────────────────────────────────────────────
export const NineToFiveGoogleLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* Google G — multicolor */}
    <svg width={34 * size} height={34 * size} viewBox="0 0 34 34">
      <path d="M17 8 Q8 8 8 17 Q8 26 17 26 Q24 26 26 21 L18 21 L18 14 L33 14 Q33.5 15.5 33.5 17 Q33.5 26.5 17 26.5 Q7.5 26.5 7.5 17 Q7.5 7.5 17 7.5 Q22 7.5 25 10 Z" fill="none" />
      {/* Simplified colorful G */}
      <path d="M31 14 L18 14 L18 21 L26 21" stroke="#4285F4" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 21 Q26 26 17 26 Q8 26 8 17" stroke="#34A853" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M8 17 Q8 8 17 8 Q22 8 25 11" stroke="#EA4335" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M25 11 L31 14" stroke="#FBBC05" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#4285F4", letterSpacing: "-0.02em" }}>
      9to5Google
    </span>
  </div>
);

// ── The New York Times ────────────────────────────────────────────────────────
export const NYTLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* NYT "T" — iconic serif top bar */}
    <svg width={28 * size} height={34 * size} viewBox="0 0 28 34">
      {/* Crossbar */}
      <rect x="0" y="2" width="28" height="4" rx="1" fill="#E2E8F0" />
      {/* Stem */}
      <rect x="11" y="2" width="6" height="30" rx="1" fill="#E2E8F0" />
      {/* Serifs on crossbar ends */}
      <rect x="0" y="0" width="6" height="3" rx="1" fill="#E2E8F0" />
      <rect x="22" y="0" width="6" height="3" rx="1" fill="#E2E8F0" />
      {/* Serifs at base */}
      <rect x="8" y="31" width="12" height="3" rx="1" fill="#E2E8F0" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#E2E8F0", letterSpacing: "-0.02em" }}>
      The New York Times
    </span>
  </div>
);

// ── The Information ────────────────────────────────────────────────────────────
export const TheInformationLogo: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 * size }}>
    {/* i dot + stem */}
    <svg width={18 * size} height={34 * size} viewBox="0 0 18 34">
      <circle cx="9" cy="5" r="4" fill="#C084FC" />
      <rect x="5.5" y="13" width="7" height="18" rx="3" fill="#C084FC" />
      {/* Base serif */}
      <rect x="1" y="29" width="16" height="3" rx="1.5" fill="#C084FC" />
    </svg>
    <span style={{ fontFamily: fontGrotesk, fontSize: 26 * size, fontWeight: 700, color: "#C084FC", letterSpacing: "-0.02em" }}>
      The Information
    </span>
  </div>
);

export const ALL_SOURCE_LOGOS = [
  TechCrunchLogo,
  VergeLogo,
  BloombergLogo,
  HackerNewsLogo,
  ReutersLogo,
  WiredLogo,
  ArsTechnicaLogo,
  NineToFiveGoogleLogo,
  NYTLogo,
  TheInformationLogo,
] as const;
