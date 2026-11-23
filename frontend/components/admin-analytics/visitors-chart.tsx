"use client";

import * as React from "react";

import { fmtCount, pointLabel } from "./format";

type Point = { label: string; visitors: number; pageviews: number };

const PAD = { top: 12, right: 12, bottom: 22, left: 36 };

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => n <= s * 4) ?? magnitude * 10;
  return Math.ceil(n / step) * step;
}

/**
 * Visitors (blue) and pageviews (grey) over the range on one count axis, with
 * a crosshair and the exact numbers for the point under the pointer.
 */
export function VisitorsChart({ points }: { points: Point[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  // Drawn at the box's real width, so labels stay 11px on a phone and on a wide screen alike.
  const [W, setW] = React.useState(720);
  React.useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setW(Math.max(260, Math.round(box.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const H = W < 520 ? 180 : 240;
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.visitors, p.pageviews))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const line = (key: "visitors" | "pageviews") => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `${line("visitors")} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : "";
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(W / 80))));

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const i = points.length <= 1 ? 0 : Math.round(((px - PAD.left) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const active = hover != null ? points[hover] : null;
  return (
    <div ref={boxRef} className="relative min-w-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-pan-y"
        role="img"
        aria-label={`Visitors and pageviews, ${points.length} points`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--oa-border)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-[var(--oa-muted-fg)] text-[11px] tabular-nums">
              {fmtCount(tick)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          (i % labelEvery === 0 && points.length - 1 - i >= labelEvery / 2) || i === points.length - 1 ? (
            <text key={p.label} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-[var(--oa-muted-fg)] text-[11px]">
              {pointLabel(p.label)}
            </text>
          ) : null,
        )}
        {area ? <path d={area} fill="var(--oa-primary)" opacity="0.08" /> : null}
        <path d={line("pageviews")} fill="none" stroke="var(--oa-muted-fg)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line("visitors")} fill="none" stroke="var(--oa-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.length === 1 ? <circle cx={x(0)} cy={y(points[0]!.visitors)} r="4" fill="var(--oa-primary)" /> : null}
        {active && hover != null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--oa-fg)" strokeOpacity="0.25" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(active.pageviews)} r="4" fill="var(--oa-card)" stroke="var(--oa-muted-fg)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(active.visitors)} r="4.5" fill="var(--oa-card)" stroke="var(--oa-primary)" strokeWidth="2" />
          </g>
        ) : null}
      </svg>
      {active && hover != null ? (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[8.5rem] rounded-md border border-oa-border bg-oa-card px-2.5 py-1.5 text-[12.5px] shadow-sm"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > points.length / 2 ? "calc(-100% - 10px)" : "10px"})` }}
        >
          <div className="font-medium text-oa-fg">{pointLabel(active.label)}</div>
          <div className="mt-0.5 flex justify-between gap-3 text-oa-fg">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-oa-primary" />
              Visitors
            </span>
            <span className="oa-mono tabular-nums">{fmtCount(active.visitors)}</span>
          </div>
          <div className="flex justify-between gap-3 text-oa-fg">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-oa-muted-fg" />
              Pageviews
            </span>
            <span className="oa-mono tabular-nums">{fmtCount(active.pageviews)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
