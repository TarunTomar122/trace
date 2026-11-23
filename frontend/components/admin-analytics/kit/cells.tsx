import * as React from "react";

/**
 * The kit's smallest pieces (a signed change, a tag, a sparkline, the number
 * class and the day format), with no server imports, so client components can
 * draw table cells from plain data. The kit index re-exports all of them.
 */

export const NUM = "oa-mono tabular-nums";

export function toneText(tone: "up" | "down" | "flat" | undefined): string {
  if (tone === "up") return "text-signal-bullish";
  if (tone === "down") return "text-signal-bearish";
  return tone === "flat" ? "text-oa-muted-fg" : "text-oa-fg";
}

export function toneOf(value: number | null | undefined): "up" | "down" | "flat" {
  if (value == null || !Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

/** A signed change, coloured. Renders an em-free dash when the value is unknown. */
export function Delta({
  value,
  digits = 2,
  suffix = "%",
  className = "",
}: {
  value: number | null | undefined;
  digits?: number;
  suffix?: string;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={`${NUM} text-oa-muted-fg ${className}`}>n/a</span>;
  }
  // A move that rounds to zero is flat: "0.0%", never "−0.0%" in red.
  const shown = Number(value.toFixed(digits));
  const sign = shown > 0 ? "+" : shown < 0 ? "−" : "";
  return (
    <span className={`${NUM} ${toneText(toneOf(shown))}${className ? ` ${className}` : ""}`}>
      {/* One text node, not three: tables print a Delta in every row. */}
      {`${sign}${Math.abs(shown).toFixed(digits)}${suffix}`}
    </span>
  );
}

export type TagTone = "neutral" | "up" | "down" | "primary" | "warn";

// The tag's shape and tones are .oa-tag* in app/globals.css: tables print one on every row.
const TAG_TONES: Record<TagTone, string> = {
  neutral: "oa-tag-neutral",
  up: "oa-tag-up",
  down: "oa-tag-down",
  primary: "oa-tag-primary",
  warn: "oa-tag-warn",
};

/** Small uppercase mono tag: form types, calls, statuses. */
export function Tag({
  children,
  tone = "neutral",
  caps = true,
  className = "",
}: {
  children: React.ReactNode;
  tone?: TagTone;
  /** Small capitals for codes and states; `false` for words a person reads ("Buy more", "We changed our call"). */
  caps?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`oa-tag ${caps ? "oa-mono oa-tag-caps" : "text-[13px]"} ${TAG_TONES[tone]}${className ? ` ${className}` : ""}`}
    >
      {children}
    </span>
  );
}

/** Inline SVG sparkline. Draws nothing with fewer than two points. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone,
  className = "",
}: {
  values: Array<number | null | undefined>;
  width?: number;
  height?: number;
  tone?: "up" | "down" | "flat";
  className?: string;
}) {
  const points = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = (width - 2) / (points.length - 1);
  // One moveto, then bare pairs (SVG reads them as linetos), one decimal without a trailing ".0":
  // the same line in about two thirds of the characters, which adds up down a table of sparklines.
  const short = (n: number) => String(Math.round(n * 10) / 10);
  const d = `M${points.map((v, i) => `${short(1 + i * step)} ${short(1 + (height - 2) * (1 - (v - min) / span))}`).join(" ")}`;
  const resolved = tone ?? toneOf(points[points.length - 1] - points[0]);
  const stroke =
    resolved === "up" ? "var(--signal-bullish)" : resolved === "down" ? "var(--signal-bearish)" : "var(--oa-muted-fg)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-05" -> "Nov 5" (or "Nov 5, 2025" with the year). Parsed by hand so no timezone can shift the day. */
export function fmtDay(iso: string | null | undefined, withYear = false): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return "";
  return withYear ? `${month} ${Number(match[3])}, ${match[1]}` : `${month} ${Number(match[3])}`;
}

