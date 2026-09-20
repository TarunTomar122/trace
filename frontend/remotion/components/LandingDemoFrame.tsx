import React, { useEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { LANDING_CSS } from "../../lib/landing-css";
import {
  DiscordDemo,
  EmailDemo,
  FeedDemo,
  NewTabDemo,
} from "../../components/feed-v2/landing-demos";
import { LANDING_DEMO_STORIES } from "../../lib/landing-demo-stories";

export type DemoKind = "feed" | "email" | "extension" | "agents";

const DEMOS: Record<
  DemoKind,
  React.FC<{ stories: typeof LANDING_DEMO_STORIES; resolve?: (src: string) => string }>
> = {
  feed: FeedDemo,
  email: EmailDemo,
  extension: NewTabDemo,
  agents: DiscordDemo,
};

/**
 * Renders one of the homepage's product demos inside the launch video using the
 * site's own stylesheet, so the video can never drift from what the page shows.
 *
 * The demo markup sits in a `.lp` wrapper (the landing page's scope) and is
 * scaled to fill the video's demo box. Remote favicons are awaited via
 * delayRender so a frame never captures halfway-loaded art.
 */
export const LandingDemoFrame: React.FC<{
  kind: DemoKind;
  /** Rendered size of the demo box before scaling. */
  width?: number;
  height?: number;
  scale?: number;
  radius?: number;
}> = ({ kind, width = 700, height = 520, scale = 1.2, radius = 22 }) => {
  const Demo = DEMOS[kind];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender(`landing demo ${kind}`));

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) {
      continueRender(handle);
      return;
    }
    const images = Array.from(node.querySelectorAll("img"));
    if (images.length === 0) {
      continueRender(handle);
      return;
    }
    let remaining = images.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) continueRender(handle);
    };
    images.forEach((img) => {
      if (img.complete) return done();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  }, [handle, kind]);

  return (
    <>
      <style>{LANDING_CSS}</style>
      <div
        style={{
          width: width * scale,
          height: height * scale,
          borderRadius: radius,
          overflow: "hidden",
          position: "relative",
          // A light ring keeps dark demos (Discord, Android) from melting into the
          // black stage.
          boxShadow: "0 0 0 1px rgba(255,255,255,0.14), 0 60px 140px rgba(0,0,0,0.85)",
        }}
      >
        <div
          className="lp trace-demo"
          ref={wrapRef}
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "transparent",
            minHeight: "auto",
          }}
        >
          {/* local assets resolve through staticFile in the renderer */}
          <Demo
            resolve={(src) => (src.startsWith("/") ? staticFile(src.slice(1)) : src)}
            stories={LANDING_DEMO_STORIES.map((story) => ({
              ...story,
              image: story.image.startsWith("/") ? staticFile(story.image.slice(1)) : story.image,
            }))}
          />
        </div>
      </div>
    </>
  );
};
