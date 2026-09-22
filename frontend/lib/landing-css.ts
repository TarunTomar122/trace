/**
 * Landing stylesheet: the page injects it, and the launch video injects the
 * same string so the homepage's demo components render identically there.
 * Kept dependency-free so Remotion's bundler can import it.
 */
export const LANDING_CSS = `
.lp {
  --ink: #0f1419;
  --text-2: #536471;
  --text-3: #71767b;
  --line: #eff3f4;
  --blue: #1d9bf0;
  --hover: #f7f9f9;
  background: #fff; color: var(--ink); min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px; line-height: 20px;
  overflow-x: clip;
}
.lp .nav { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); z-index: 100; }
.lp .nav-in { max-width: 1100px; margin: 0 auto; padding: 0 20px; min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.lp .brand { display: flex; align-items: center; gap: 9px; text-decoration: none; color: var(--ink); }
.lp .brand-logo { height: 28px; width: auto; }
.lp .wordmark { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
.lp .nav-links { display: flex; align-items: center; gap: 20px; }
.lp .nav-links a { color: var(--text-2); text-decoration: none; font-size: 14px; font-weight: 550; }
.lp .nav-links a:hover { color: var(--ink); }
.lp .nav-cta { height: 38px; padding: 0 20px; font-size: 14px; margin-left: 6px; }
@media (max-width: 860px) {
  .lp .nav-in { height: auto; padding: 10px 14px; flex-wrap: wrap; }
  .lp .nav-links { gap: 12px; overflow-x: auto; scrollbar-width: none; }
  .lp .nav-links::-webkit-scrollbar { display: none; }
  .lp .nav-links a { white-space: nowrap; }
}

@media (max-width: 760px) {
  .lp .section { padding: 64px 20px; }
  .lp .hero { padding: 72px 16px 48px; }
  .lp .hero-title { font-size: clamp(2rem, 8.5vw, 2.6rem); }
  .lp .section .founder { max-width: none; margin: 0 -20px; border-radius: 0; padding: 32px 16px; }
  .lp .final-cta { margin: 0 16px 24px; padding: 56px 24px 28px; }
}

.lp .hero { position: relative; max-width: 1150px; margin: 0 auto; padding: 96px 20px 56px; text-align: center; }
.lp .hero > * { position: relative; z-index: 1; }
.lp .hero { isolation: isolate; }
.lp .hero-float { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.lp .hero-title { margin: 0 auto 18px; max-width: 780px; font-size: clamp(2.4rem, 5.2vw, 4rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1.06; }
.lp .hero-sub { margin: 0 auto 32px; max-width: 460px; font-size: 19px; line-height: 1.55; color: var(--text-2); }

.lp .hero-tile {
  position: absolute; display: block; padding: 14px;
  background: #fff; border-radius: 16px;
  box-shadow: 0 10px 28px rgba(15, 20, 25, 0.12), 0 0 0 1px var(--line);
  animation: lp-float 7s ease-in-out infinite;
}
.lp .hero-tile:nth-child(odd) { animation-duration: 8.5s; animation-delay: -2.5s; }
.lp .hero-tile:nth-child(3n) { animation-delay: -5s; }
@keyframes lp-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@media (max-width: 1180px) {
  .lp .hero-tile:nth-child(7), .lp .hero-tile:nth-child(9) { display: none; }
}
@media (max-width: 1020px) {
  .lp .hero-tile:nth-child(4), .lp .hero-tile:nth-child(6) { display: none; }
}
@media (max-width: 900px) { .lp .hero-float { display: none; } }

.lp .hero-signup { display: flex; flex-direction: column; align-items: center; }
.lp .signup-pill {
  display: flex; align-items: center; gap: 6px;
  width: 100%; max-width: 480px; padding: 7px 7px 7px 22px;
  background: #fff; border-radius: 9999px;
  border: 1px solid var(--line);
  box-shadow: 0 6px 24px rgba(15, 20, 25, 0.08), 0 0 0 1px rgba(15, 20, 25, 0.04);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.lp .signup-pill:focus-within { border-color: var(--blue); box-shadow: 0 6px 24px rgba(29, 155, 240, 0.18), 0 0 0 3px rgba(29, 155, 240, 0.12); }
.lp .signup-input {
  flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent;
  font-size: 16px; color: var(--ink); font-family: inherit;
}
.lp .signup-input::placeholder { color: var(--text-3); }
.lp .signup-btn {
  display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0;
  height: 44px; padding: 0 22px; border: none; border-radius: 9999px; cursor: pointer;
  background: var(--blue); color: #fff; font-size: 15px; font-weight: 700; font-family: inherit;
  transition: background-color 0.2s ease;
}
.lp .signup-btn:hover { background: #1a8cd8; }
.lp .signup-btn:disabled { opacity: 0.7; cursor: default; }
.lp .signup-arrow { font-size: 15px; }
.lp .signup-msg { margin: 12px 0 0; font-size: 14px; font-weight: 600; }
.lp .signup-msg.is-ok { color: #0f7b3d; }
.lp .signup-msg.is-error { color: #d6303a; }
.lp .signup-note { margin: 14px 0 0; font-size: 12.5px; color: var(--text-3); }
.lp .signup-note a {
  position: relative; display: inline-block;
  font-size: 15px; font-weight: 750; text-decoration: none;
  background: linear-gradient(100deg, var(--blue) 0%, var(--blue) 38%, #a9e3ff 50%, var(--blue) 62%, var(--blue) 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: var(--blue);
  animation: lp-glimmer 2.6s linear infinite;
}
.lp .signup-note a::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, rgba(29, 155, 240, 0.12), var(--blue) 50%, rgba(29, 155, 240, 0.12));
  background-size: 200% 100%; opacity: 0.7;
  animation: lp-glimmer 2.6s linear infinite;
}
.lp .signup-note a:hover { -webkit-text-fill-color: #0d7dcc; }
.lp .signup-note a:hover::after { opacity: 1; }
@keyframes lp-glimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .lp .signup-note a, .lp .signup-note a::after { animation: none; }
}
@media (max-width: 480px) {
  .lp .signup-pill { padding: 5px 5px 5px 16px; }
  .lp .signup-btn { padding: 0 14px; font-size: 14px; }
  .lp .hero-title { max-width: 100%; }
  .lp .proof-label { padding: 0 8px; }
}

}
.lp .hero-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.lp .btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 48px; padding: 0 28px; border-radius: 9999px;
  background: var(--blue); color: #fff; font-size: 16px; font-weight: 700; text-decoration: none;
  transition: background-color 0.2s ease;
}
.lp .btn-primary:hover { background: #1a8cd8; }
.lp .btn-logo { width: 18px; height: 18px; flex-shrink: 0; }
.lp .btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 48px; padding: 0 28px; border-radius: 9999px;
  border: 1px solid var(--text-2); color: var(--ink); font-size: 16px; font-weight: 700; text-decoration: none;
  transition: background-color 0.2s ease;
}
.lp .btn-ghost:hover { background: var(--hover); }

.lp .proof { margin-top: 72px; border-top: 1px solid var(--line); padding-top: 24px; }
.lp .proof-label { margin: 0; font-size: 13.5px; font-weight: 650; color: var(--ink); }
.lp .logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 30px; margin-top: 20px; }
.lp .logos img { height: 24px; width: auto; opacity: 0.45; filter: grayscale(1); transition: opacity 0.2s ease, filter 0.2s ease; }
.lp .logos img:hover { opacity: 0.85; filter: grayscale(0); }

.lp .section { max-width: 1000px; margin: 0 auto; padding: 96px 20px; }
.lp .section-title { margin: 0 0 12px; text-align: center; font-size: clamp(1.9rem, 4vw, 2.75rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.08; }
.lp .section-sub { margin: 0 auto 48px; text-align: center; font-size: 17px; color: var(--text-2); max-width: 560px; line-height: 1.6; }
.lp .band { background: var(--hover); }
.lp .band .section { padding-top: 88px; padding-bottom: 88px; }

.lp .yg {
  max-width: 1140px;
  padding: 104px 32px 56px;
}
.lp .yg .section-title { margin-bottom: 12px; }
.lp .yg .section-sub { margin-bottom: 20px; max-width: 560px; }
.lp .yg-row {
  --yg-demo-h: 560px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  align-items: center;
  padding: 72px 0;
}
.lp .yg-row + .yg-row { border-top: 1px solid var(--line); }
@media (min-width: 900px) {
  .lp .yg-row {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 96px;
    padding: 88px 0;
  }
  .lp .yg-row.flip { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
  .lp .yg-row.flip .yg-copy { order: 2; }
  .lp .yg-row.flip .yg-demo { order: 1; }
}
.lp .yg-copy { max-width: 440px; }
.lp .yg-kicker {
  margin: 0 0 12px; font-size: 12px; font-weight: 800; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--blue);
}
.lp .yg-copy h3 {
  margin: 0; font-size: clamp(1.6rem, 2.8vw, 2.25rem); font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.12;
}
.lp .yg-copy p { margin: 14px 0 0; font-size: 16.5px; line-height: 1.65; color: var(--text-2); }
.lp .yg-link {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 20px; color: var(--blue); font-weight: 700;
  font-size: 15px; text-decoration: none;
}
.lp .yg-link::after { content: '→'; transition: transform 0.2s ease; }
.lp .yg-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.lp .yg-link:hover::after { transform: translateX(3px); }
.lp .yg-demo { height: var(--yg-demo-h); }

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
.lp .yg-ph {
  width: 88px; height: 64px; border-radius: 12px; background: #f7f9f9;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: var(--text-3);
  letter-spacing: 0.04em; text-transform: uppercase; flex-shrink: 0;
}
.lp .yg-tag { margin: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--blue); }
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
.lp .yg-coverage {
  margin: 0 14px 14px; padding: 10px 12px 8px;
  background: #f7f9f9; border: 1px solid var(--line); border-radius: 16px;
  flex: 1; min-height: 0;
}
.lp .yg-coverage > p {
  margin: 0 0 6px; font-size: 11px; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3);
}
.lp .yg-coverage ol { list-style: none; margin: 0; padding: 0; }
.lp .yg-coverage li {
  display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px;
  align-items: start; padding: 7px 0 7px 12px; position: relative;
}
.lp .yg-coverage li + li { border-top: 1px solid var(--line); }
.lp .yg-coverage li::before {
  content: ''; position: absolute; left: 0; top: 13px;
  width: 7px; height: 7px; border-radius: 50%; background: var(--blue);
}
.lp .yg-coverage li img {
  width: 16px; height: 16px; border-radius: 4px; margin-top: 2px;
  background: #fff; box-shadow: 0 0 0 1px var(--line);
}
.lp .yg-coverage li span {
  display: block; font-size: 11px; font-weight: 700; color: var(--text-3);
}
.lp .yg-coverage li b {
  display: block; margin-top: 1px; font-size: 13px; font-weight: 650;
  letter-spacing: -0.015em; line-height: 1.3; color: var(--ink);
}

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
  .lp .yg { padding: 48px 18px 32px; }
  .lp .yg-row { grid-template-columns: minmax(0, 1fr); padding: 36px 0; --yg-demo-h: 500px; }
  .lp .yg-demo, .lp .yg-frame { height: auto; min-width: 0; }
  .lp .yg-nt-grid .yg-nt-card:nth-child(n+5) { display: none; }
  .lp .yg-copy { max-width: none; }
  .lp .yg-copy p { font-size: 14.5px; }
}

.lp .steps { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 780px) { .lp .steps { grid-template-columns: 1fr 1fr 1fr; } }
.lp .card { border-radius: 24px; padding: 32px 28px; background: #fff; box-shadow: 0 12px 32px rgba(15, 20, 25, 0.06); }
.lp .step-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 12px;
  font-size: 14px; font-weight: 800; color: var(--blue);
  background: rgba(29, 155, 240, 0.1); font-variant-numeric: tabular-nums;
}
.lp .card-title { margin: 18px 0 8px; font-size: 19px; font-weight: 750; letter-spacing: -0.015em; }
.lp .card-body { margin: 0; font-size: 15px; line-height: 1.65; color: var(--text-2); }

.lp .plans { display: grid; grid-template-columns: 1fr; gap: 20px; max-width: 760px; margin: 0 auto; }
@media (min-width: 780px) { .lp .plans { grid-template-columns: 1fr 1fr; } }
.lp .plan { position: relative; border: 1px solid var(--line); border-radius: 24px; padding: 34px 30px; display: flex; flex-direction: column; background: #fff; }
.lp .plan-pro { border-color: var(--blue); box-shadow: 0 16px 48px rgba(29, 155, 240, 0.18); }
.lp .plan-badge {
  position: absolute; top: -13px; left: 28px; margin: 0;
  padding: 4px 14px; border-radius: 999px;
  background: var(--blue); color: #fff;
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
}
.lp .plan-tag { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-2); }
.lp .plan-price { margin: 8px 0 20px; font-size: 44px; font-weight: 800; letter-spacing: -0.03em; }
.lp .plan-price span { font-size: 15px; font-weight: 500; color: var(--text-2); }
.lp .plan-list { margin: 0 0 24px; padding: 0; list-style: none; flex: 1; }
.lp .plan-list li { padding: 6px 0 6px 26px; position: relative; font-size: 14.5px; line-height: 1.5; }
.lp .plan-list li::before {
  content: '✓'; position: absolute; left: 0; top: 6px;
  width: 17px; height: 17px; border-radius: 50%;
  background: rgba(29, 155, 240, 0.12); color: var(--blue);
  font-size: 10px; font-weight: 800; line-height: 17px; text-align: center;
}
.lp .plan-btn { width: 100%; height: 48px; display: flex; }

.lp .founder {
  max-width: 680px; margin: 0 auto; padding: 48px 44px;
  background: var(--hover); border-radius: 32px;
}
.lp .kicker {
  margin: 0 0 14px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}
.lp .founder .kicker { margin-bottom: 16px; text-align: left; }
.lp .founder-head { display: flex; align-items: center; justify-content: space-between; gap: 22px; margin-bottom: 22px; }
.lp .founder .section-title { text-align: left; }
.lp .founder-title { margin: 0; }
.lp #faq .section-title { margin-bottom: 30px; }
.lp .founder-title { margin-bottom: 18px; }
.lp .founder-avatar { width: 104px; height: 104px; border-radius: 50%; object-fit: cover; display: block; box-shadow: 0 0 0 4px rgba(29,155,240,0.12); flex-shrink: 0; }
.lp .founder-p { margin: 0 0 14px; font-size: 16.5px; line-height: 1.7; color: var(--ink); }
.lp .founder-sign { margin: 18px 0 0; font-size: 14px; font-weight: 600; color: var(--text-2); }
.lp .flink { color: var(--ink); font-weight: 650; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--line); }
.lp .flink:hover { text-decoration-color: var(--ink); }

.lp .faq { max-width: 680px; margin: 0 auto; border-radius: 24px; overflow: hidden; box-shadow: 0 0 0 1px var(--line); background: #fff; }
.lp .faq-item { border-bottom: 1px solid var(--line); }
.lp .faq-item:last-child { border-bottom: none; }
.lp .faq-item summary { padding: 20px 24px; font-size: 16px; font-weight: 650; cursor: pointer; list-style: none; transition: background-color 0.2s ease; }
.lp .faq-item summary::-webkit-details-marker { display: none; }
.lp .faq-item summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.lp .faq-item summary::after {
  content: '+'; flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--hover); color: var(--text-2);
  font-size: 16px; font-weight: 600;
}
.lp .faq-item[open] summary::after { content: '−'; background: rgba(29, 155, 240, 0.12); color: var(--blue); }
.lp .faq-item summary:hover { background: var(--hover); }
.lp .faq-item p { margin: 0; padding: 0 24px 22px; font-size: 15px; line-height: 1.7; color: var(--text-2); }

.lp .discovery-links { padding-top: 96px; padding-bottom: 40px; }
.lp .discovery-links .section-title { max-width: 22ch; margin-left: auto; margin-right: auto; line-height: 1.15; }
.lp .discovery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-top: 8px; }
.lp .discovery-card {
  display: flex; flex-direction: column; gap: 10px; padding: 28px 26px;
  border-radius: 20px; color: var(--ink); text-decoration: none;
  background: var(--hover);
  transition: background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  min-height: 148px;
}
.lp .discovery-card:hover { background: #eef2f3; transform: translateY(-3px); box-shadow: 0 14px 32px rgba(15, 20, 25, 0.08); }
.lp .discovery-card strong { font-size: 17px; letter-spacing: -0.02em; display: flex; align-items: center; justify-content: space-between; }
.lp .discovery-card strong::after { content: '→'; color: var(--blue); font-weight: 700; }
.lp .discovery-card span { color: var(--text-2); font-size: 14.5px; line-height: 1.55; }
@media (max-width: 760px) { .lp .discovery-grid { grid-template-columns: 1fr; } }

.final-cta {
  max-width: 1150px; margin: 0 auto 32px; padding: 88px 40px 40px; text-align: center;
  background: var(--hover); border-radius: 32px;
}
.lp .final-cta .hero-title { max-width: 640px; margin-left: auto; margin-right: auto; }
.lp .final-cta .hero-ctas { margin-top: 30px; }

.lp .footer { border-top: 1px solid var(--line); }
.lp .foot-in { max-width: 1100px; margin: 0 auto; padding: 24px 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; }
.lp .foot-brand { font-weight: 800; font-size: 16px; }
.lp .foot-links { display: flex; flex-wrap: wrap; gap: 18px; }
.lp .foot-links a { color: var(--text-2); text-decoration: none; font-size: 13.5px; }
.lp .foot-links a:hover { color: var(--ink); }
.lp .foot-copy { font-size: 13px; color: var(--text-3); }
`;
