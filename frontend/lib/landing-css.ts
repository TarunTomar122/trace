/**
 * Product-demo stylesheet: the homepage injects it for the yg-* mockups it
 * shows (feed, new tab, Discord), and the launch video injects the same
 * string so those demos render identically there. Kept dependency-free so
 * Remotion's bundler can import it. The homepage's own look is lib/home-css.ts.
 *
 * Scales: type --fs-*, spacing --s1..--s8 (4/8/16/24/32/48/64/96).
 * Keep the yg-* block stable: the video depends on it.
 */
export const LANDING_CSS = `
.lp {
  /* colour */
  /* the feed's palette (FeedApp .xw): one look across landing, feed, brief */
  --ink: #0f1419;
  --text-2: #536471;
  --text-3: #71767b;
  --line: #eff3f4;
  --blue: #1d9bf0;
  --blue-hover: #1a8cd8;
  --pink: #f91880;
  --hover: #f7f9f9;
  --paper: #ffffff;
  --footer-bg: #ffffff;
  --footer-line: #eff3f4;
  /* type scale */
  --fs-xs: 12px; --fs-sm: 14px; --fs-md: 16px; --fs-lg: 18px; --fs-xl: 20px;
  --fs-h2: clamp(2rem, 4.2vw, 2.75rem); --fs-h1: clamp(2.5rem, 6.4vw, 4.25rem);
  --serif: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
  /* spacing scale (4 / 8 / 16 / 24 / 32 / 48 / 64 / 96) */
  --s1: 4px; --s2: 8px; --s3: 16px; --s4: 24px; --s5: 32px; --s6: 48px; --s7: 64px; --s8: 96px;
  background: var(--paper); color: var(--ink); min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: var(--fs-md); line-height: 1.5;
  overflow-x: clip;
}
.lp a:focus-visible, .lp button:focus-visible, .lp summary:focus-visible, .lp input:focus-visible {
  outline: 2px solid var(--blue); outline-offset: 3px; border-radius: 6px;
}

/* demo components (shared with the launch video) */
.lp .yg-frame {
  border: 1px solid var(--line); border-radius: 24px; overflow: hidden;
  background: #fff; box-shadow: 0 24px 60px rgba(15, 20, 25, 0.08), 0 2px 8px rgba(15, 20, 25, 0.04);
  height: 100%; width: 100%;
  display: flex; flex-direction: column; min-height: 0;
}
.lp .yg-frame-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 16px; border-bottom: 1px solid var(--line); background: #f7f9f9;
  flex-shrink: 0;
}
.lp .yg-feed-title { display: inline-flex; align-items: baseline; gap: 7px; font-size: 15px; font-weight: 800; letter-spacing: -0.02em; }
.lp .yg-feed-count { font-size: 12px; font-weight: 600; color: var(--text-3); }
.lp .yg-feed-tabs { display: inline-flex; gap: 6px; }
.lp .yg-feed-tab {
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line);
  font-size: 12px; font-weight: 650; color: var(--text-2);
}
.lp .yg-feed-tab.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.lp .yg-streak {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 999px; margin-left: 6px;
  background: #ffede4; font-size: 11px; font-weight: 750; color: #d93a0a;
}

.lp .yg-feed-row {
  display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 14px;
  padding: 14px 16px; border-top: 1px solid var(--line);
}
.lp .yg-feed-thumb { width: 92px; height: 92px; border-radius: 14px; object-fit: cover; background: #eee; display: block; }
.lp .yg-feed-row-title {
  margin: 0; font-size: 14.5px; font-weight: 800; letter-spacing: -0.015em; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lp .yg-feed-row .yg-why { -webkit-line-clamp: 2; margin: 5px 0 0; font-size: 12.5px; }
.lp .yg-feed-row .yg-meta { margin: 8px 0 0; }
.lp .yg-feed-src { font-weight: 700; color: var(--ink); }
.lp .yg-feed-side { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; padding: 2px 0 4px; }
.lp .yg-feed-rank { font-size: 11px; font-weight: 700; color: var(--text-3); }
.lp .yg-feed-actions { display: inline-flex; gap: 10px; color: var(--text-3); }
.lp .yg-follow {
  padding: 3px 10px; border: 1px solid var(--line); border-radius: 999px;
  font-size: 11px; font-weight: 700; color: var(--ink);
}
.lp .yg-stitle { margin: 0; font-size: 13.5px; font-weight: 700; line-height: 1.32; letter-spacing: -0.02em; }
.lp .yg-why {
  margin: 6px 0 0; font-size: 13px; line-height: 1.4; color: var(--text-2);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lp .yg-meta {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px;
  margin: 8px 0 0; font-size: 12px; font-weight: 600; color: var(--text-2);
}
.lp .yg-faves { display: inline-flex; align-items: center; }
.lp .yg-faves img {
  width: 16px; height: 16px; border-radius: 9999px; background: #fff;
  box-shadow: 0 0 0 1px var(--line); object-fit: contain;
}
.lp .yg-faves img + img { margin-left: -5px; }

.lp .yg-hero { padding: 8px 16px 8px; flex-shrink: 0; }
.lp .yg-hero-kicker {
  margin: 0 0 8px; font-size: 11px; font-weight: 800;
  letter-spacing: 0.1em; text-transform: uppercase; color: #e5484d;
}
.lp .yg-shot {
  position: relative; height: 158px; border-radius: 14px; margin: 0 0 12px;
  overflow: hidden; background: #111;
}
.lp .yg-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lp .yg-shot span {
  position: absolute; right: 10px; bottom: 10px;
  padding: 4px 8px; border-radius: 8px;
  background: rgba(0,0,0,0.55); color: #fff;
  font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
  backdrop-filter: blur(8px);
}
.lp .yg-hero-title {
  margin: 0; font-size: 16.5px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.22;
}
.lp .yg-hero .yg-why { -webkit-line-clamp: 2; }

.lp .yg-dots {
  width: 42px; height: 8px; border-radius: 99px; flex-shrink: 0;
  background: linear-gradient(90deg, #ff5f57 8px, transparent 8px, transparent 12px, #ffbd2e 12px, #ffbd2e 20px, transparent 20px, transparent 24px, #28c840 24px, #28c840 32px);
}

.lp .yg-nt { background: #f2efe9; border-color: #e8e4dc; }
.lp .yg-chrome-strip {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 7px 12px 0; background: #dee1e6; flex-shrink: 0;
}
.lp .yg-chrome-strip .yg-dots { margin-bottom: 10px; }
.lp .yg-chrome-tab {
  display: inline-flex; align-items: center; gap: 7px;
  width: 150px; padding: 8px 11px;
  background: #f2efe9; border-radius: 10px 10px 0 0;
  font-size: 11px; font-weight: 650; color: #3c4043;
}
.lp .yg-chrome-tab img { height: 13px; width: 13px; display: block; }
.lp .yg-chrome-tab i { margin-left: auto; font-style: normal; color: #5f6368; font-size: 12px; line-height: 1; }
.lp .yg-chrome-plus { color: #5f6368; font-size: 14px; padding: 0 2px 7px; line-height: 1; }
.lp .yg-chrome-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 12px; background: #f8f9fa; border-bottom: 1px solid #e8e4dc; flex-shrink: 0;
}
.lp .yg-chrome-nav { display: inline-flex; gap: 9px; color: #3c4043; font-size: 12px; }
.lp .yg-chrome-nav i { font-style: normal; line-height: 1; }
.lp .yg-chrome-nav .dim { color: #b6bcc2; }
.lp .yg-chrome-url {
  flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0;
  background: #fff; border: 1px solid #e8e4dc; border-radius: 999px;
  padding: 5px 12px; font-size: 11px; font-weight: 550; color: #3c4043;
}
.lp .yg-chrome-kebab { color: #5f6368; font-size: 13px; line-height: 1; }
.lp .yg-nt-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 14px; background: #fbfaf7; border-bottom: 1px solid #e8e4dc; flex-shrink: 0;
}
.lp .yg-nt-brand {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; color: #18181b;
}
.lp .yg-nt-brand img { height: 18px; width: auto; display: block; }
.lp .yg-nt-pills { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
.lp .yg-nt-pill { font-size: 11px; font-weight: 650; color: #52525b; padding: 5px 11px; border-radius: 999px; }
.lp .yg-nt-pill.on { background: #18181b; color: #fff; }
.lp .yg-nt-signin { font-size: 11.5px; font-weight: 650; color: #52525b; flex-shrink: 0; }
.lp .yg-nt-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;
  padding: 12px 14px; flex: 1; min-height: 0; overflow: hidden;
}
.lp .yg-nt-card {
  background: #fff; border-radius: 12px; overflow: hidden;
  display: flex; flex-direction: column; min-height: 0;
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.06);
}
.lp .yg-nt-shot {
  width: 100%; flex: 1 1 auto; aspect-ratio: 16 / 10;
  object-fit: cover; display: block; background: #eee;
}
.lp .yg-nt-body { padding: 10px 10px 12px; }
.lp .yg-nt-title {
  margin: 0; font-size: 11.5px; font-weight: 650; line-height: 1.4;
  letter-spacing: -0.01em; color: #18181b;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
@media (max-width: 899px) {
  .lp .yg-nt-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .lp .yg-frame-bar { flex-direction: column; align-items: stretch; gap: 8px; }
  .lp .yg-feed-title { white-space: nowrap; }
  .lp .yg-feed-tabs { align-self: flex-end; flex-wrap: nowrap; }
  .lp .yg-feed-tab { white-space: nowrap; }
  .lp .yg-nt-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto; row-gap: 8px; }
  .lp .yg-nt-brand { grid-column: 1; grid-row: 1; }
  .lp .yg-nt-signin { grid-column: 2; grid-row: 1; }
  .lp .yg-nt-pills {
    grid-column: 1 / -1; grid-row: 2; flex-wrap: nowrap; justify-content: space-between; gap: 0; min-width: 0;
  }
  .lp .yg-nt-pill { flex: 0 0 auto; white-space: nowrap; padding-inline: 8px; }
}
.lp .yg-mail { background: #eef0f3; }
.lp .yg-mail-chrome {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  padding: 10px 14px; background: #fff; border-bottom: 1px solid #e4e7eb; flex-shrink: 0;
}
.lp .yg-mail-chrome p {
  margin: 0; font-size: 13px; font-weight: 650; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lp .yg-letter {
  margin: 10px; background: #fff; border-radius: 12px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  flex: 1; min-height: 0; display: flex; flex-direction: column;
}
.lp .yg-letter-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px; background: #18181b; color: #fff;
  font-size: 12px; font-weight: 800; letter-spacing: 0.12em; flex-shrink: 0;
}
.lp .yg-letter-head span:last-child { color: #a1a1aa; font-weight: 500; letter-spacing: 0; }
.lp .yg-letter-hi {
  margin: 10px 14px 2px; font-family: Georgia, "Times New Roman", serif;
  font-size: 16px; font-weight: 700; letter-spacing: -0.02em; flex-shrink: 0;
}
.lp .yg-letter-lead { margin: 0 14px 2px; font-size: 12.5px; line-height: 1.45; color: #52525b; flex-shrink: 0; }
.lp .yg-letter-list { list-style: none; margin: 0; padding: 0 14px; flex: 1; min-height: 0; overflow: hidden; }
.lp .yg-letter-list li {
  display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 9px;
  align-items: start; padding: 9px 0; border-top: 1px solid #e4e4e7;
}
.lp .yg-letter-list li:first-child { border-top: none; }
.lp .yg-letter-num {
  margin-top: 2px; font-size: 12.5px; font-weight: 700; color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.lp .yg-letter-list .yg-stitle { font-family: Georgia, "Times New Roman", serif; font-size: 14.5px; }
.lp .yg-letter-list .yg-why { -webkit-line-clamp: 2; }
.lp .yg-letter-list .yg-meta { margin: 5px 0 0; }
.lp .yg-letter-more {
  display: block; margin: 10px 14px 0; padding-top: 9px;
  border-top: 1px dashed #e4e4e7;
  font-size: 12px; font-weight: 650; color: var(--text-3);
}
.lp .yg-letter-tag {
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-3);
}
.lp .yg-letter-cta {
  display: inline-flex; align-items: center; justify-content: center;
  margin: 8px 14px 14px; padding: 9px 14px;
  background: #18181b; color: #fff; border-radius: 10px;
  font-size: 12.5px; font-weight: 650; flex-shrink: 0; width: max-content;
}

.lp .yg-discord {
  display: grid; grid-template-columns: 46px minmax(0, 1fr);
  background: #2b2d31; color: #dbdee1; border-color: #1e1f22;
}
.lp .yg-dc-rail {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 12px 0; background: #1e1f22;
}
.lp .yg-dc-rail span {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: #313338; color: #dbdee1; font-size: 11px; font-weight: 800;
}
.lp .yg-dc-rail .on { background: #5865f2; color: #fff; border-radius: 12px; }
.lp .yg-dc-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; height: 100%; }
.lp .yg-dc-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid #3f4147;
  font-size: 12px; color: #b5bac1; flex-shrink: 0;
}
.lp .yg-dc-head strong { color: #f2f3f5; font-size: 14px; }
.lp .yg-dc-log { padding: 12px 14px 8px; display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow: hidden; }
.lp .yg-dc-msg { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 10px; font-size: 13.5px; line-height: 1.45; }
.lp .yg-dc-av {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800;
}
.lp .yg-dc-av.you { background: #5865f2; color: #fff; }
.lp .yg-dc-av.bot { background: #f97316; font-size: 15px; }
.lp .yg-dc-name { margin: 0 0 4px; font-size: 13.5px; font-weight: 700; color: #f2f3f5; }
.lp .yg-dc-name time { margin-left: 6px; font-size: 11px; font-weight: 500; color: #949ba4; }
.lp .yg-dc-name em {
  display: inline-block; margin-left: 6px; padding: 0 4px;
  background: #5865f2; color: #fff; border-radius: 3px;
  font-size: 9px; font-style: normal; font-weight: 800; letter-spacing: 0.04em; vertical-align: 1px;
}
.lp .yg-dc-ping { color: #c9cdfb; background: rgba(88,101,242,0.24); border-radius: 4px; padding: 0 4px; font-weight: 700; }
.lp .yg-dc-tool { margin: 0 0 8px; font-size: 11.5px; color: #949ba4; }
.lp .yg-dc-tool code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #dbdee1; }
.lp .yg-dc-msg p { margin: 0; }
.lp .yg-dc-embed {
  display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 10px; align-items: center;
  margin: 10px 0 8px; padding: 8px; border-radius: 8px;
  background: #1e1f22; border-left: 4px solid #5865f2;
}
.lp .yg-dc-embed img {
  width: 76px; height: 76px; object-fit: cover; border-radius: 6px; display: block;
}
.lp .yg-dc-embed-k { margin: 0 0 4px !important; font-size: 11px; font-weight: 700; color: #949ba4; }
.lp .yg-dc-embed-t {
  margin: 0 !important; font-size: 13.5px; font-weight: 700; color: #f2f3f5; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.lp .yg-dc-msg ol { margin: 8px 0 0; padding-left: 18px; }
.lp .yg-dc-msg li {
  margin: 0 0 5px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lp .yg-dc-msg li span { color: #949ba4; }
.lp .yg-dc-compose {
  margin: 4px 12px 12px; padding: 9px 12px; border-radius: 8px;
  background: #383a40; color: #949ba4; font-size: 13px; flex-shrink: 0;
}

@media (max-width: 899px) {
  .lp .yg-frame { height: auto; min-width: 0; }
  .lp .yg-nt-grid .yg-nt-card:nth-child(n+5) { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .lp * { transition: none !important; animation: none !important; }
}

`;
