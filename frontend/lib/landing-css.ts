/**
 * Landing stylesheet: the page injects it, and the launch video injects the
 * same string so the homepage's demo components render identically there.
 * Kept dependency-free so Remotion's bundler can import it.
 *
 * Scales: type --fs-*, spacing --s1..--s8 (4/8/16/24/32/48/64/96).
 * The yg-* block below styles the shared demo components; keep it stable.
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
.lp .on-dark a:focus-visible, .lp .on-dark button:focus-visible { outline-color: #fff; }
.lp .signup-input:focus-visible { outline: none; }

/* nav */
.lp .nav { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(12px); z-index: 100; }
.lp .nav-in { max-width: 1120px; margin: 0 auto; padding: 0 var(--s4); min-height: 60px; display: flex; align-items: center; justify-content: space-between; gap: var(--s3); }
.lp .brand { display: flex; align-items: center; gap: 9px; text-decoration: none; color: var(--ink); }
.lp .brand-logo { height: 28px; width: auto; }
.lp .wordmark { font-family: var(--serif); font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.lp .nav-links { display: flex; align-items: center; gap: var(--s4); }
.lp .nav-links a:not(.nav-cta) { color: var(--text-2); text-decoration: none; font-size: var(--fs-sm); font-weight: 550; }
.lp .nav-links a:not(.nav-cta):hover { color: var(--ink); }
.lp .nav-cta {
  display: inline-flex; align-items: center; height: 38px; padding: 0 18px; border-radius: 9999px;
  background: var(--ink); color: #fff; font-size: var(--fs-sm); font-weight: 650; text-decoration: none;
  transition: background-color 0.2s ease;
}
.lp .nav-cta:hover { background: #2b303a; }
@media (max-width: 640px) {
  .lp .nav-in { padding: 0 var(--s3); }
  .lp .nav-links { gap: var(--s3); }
  .lp .nav-hide-sm { display: none; }
}

/* shared layout + type */
.lp .section { max-width: 1120px; margin: 0 auto; padding: var(--s8) var(--s4); }
.lp .eyebrow {
  margin: 0 0 var(--s3); font-family: var(--mono); font-size: var(--fs-xs); font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--blue);
}
.lp .h2 {
  margin: 0 0 var(--s3); font-family: var(--serif); font-size: var(--fs-h2); font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.1; text-wrap: balance;
}
.lp .lede { margin: 0; font-size: var(--fs-lg); line-height: 1.6; color: var(--text-2); max-width: 560px; text-wrap: pretty; }
.lp .sec-head { max-width: 640px; margin: 0 auto var(--s6); text-align: center; }
.lp .sec-head .lede { margin: 0 auto; }
.lp .band { background: var(--hover); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
@media (max-width: 760px) {
  .lp .section { padding: var(--s7) var(--s3); }
  .lp .sec-head { margin-bottom: var(--s5); }
  .lp .lede { font-size: var(--fs-md); }
}

/* buttons */
.lp .btn-primary, .lp .btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s2);
  height: 48px; padding: 0 var(--s4); border-radius: 9999px;
  font-size: var(--fs-md); font-weight: 650; text-decoration: none; transition: background-color 0.2s ease, border-color 0.2s ease;
}
.lp .btn-primary { background: var(--blue); color: #fff; }
.lp .btn-primary:hover { background: var(--blue-hover); }
.lp .btn-ghost { border: 1px solid #b9b4a8; color: var(--ink); background: transparent; }
.lp .btn-ghost:hover { background: #fff; border-color: var(--ink); }
.lp .btn-row { display: flex; flex-wrap: wrap; gap: var(--s3); }
.lp .text-link { color: var(--ink); font-weight: 650; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #b9b4a8; }
.lp .text-link:hover { text-decoration-color: var(--ink); }

/* hero */
.lp .hero { max-width: 880px; margin: 0 auto; padding: 88px var(--s4) var(--s7); text-align: center; }
.lp .pill {
  display: inline-flex; align-items: center; gap: var(--s2); margin: 0 0 var(--s4); padding: 6px 14px;
  border: 1px solid var(--line); border-radius: 9999px; background: #fff;
  font-size: 13px; font-weight: 600; color: var(--text-2);
}
.lp .pill i { width: 6px; height: 6px; border-radius: 50%; background: #1a7f45; display: block; }
.lp .hero-title {
  margin: 0 auto var(--s4); max-width: 900px; font-family: var(--serif); font-size: var(--fs-h1);
  font-weight: 800; letter-spacing: -0.035em; line-height: 1.04; text-wrap: balance;
}
.lp .hero-sub { margin: 0 auto var(--s5); max-width: 680px; font-size: 20px; line-height: 1.55; color: var(--text-2); text-wrap: pretty; }
.lp .hero-links { margin: var(--s4) 0 0; display: flex; flex-wrap: wrap; justify-content: center; gap: var(--s2) var(--s4); font-size: var(--fs-sm); }
@media (max-width: 760px) {
  .lp .hero { padding: var(--s7) var(--s3) var(--s6); }
  .lp .hero-sub { font-size: var(--fs-lg); margin-bottom: var(--s4); }
}

/* signup */
.lp .hero-signup { display: flex; flex-direction: column; align-items: center; }
.lp .signup-pill {
  display: flex; align-items: center; gap: 6px;
  width: 100%; max-width: 500px; padding: 6px 6px 6px 22px;
  background: #fff; border-radius: 9999px; border: 1px solid #cfd9de;
  box-shadow: 0 8px 28px rgba(20, 22, 26, 0.07);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.lp .signup-pill:focus-within { border-color: var(--blue); box-shadow: 0 8px 28px rgba(21, 80, 200, 0.16), 0 0 0 3px rgba(21, 80, 200, 0.18); }
.lp .signup-input {
  flex: 1; min-width: 0; height: 46px; border: none; outline: none; background: transparent;
  font-size: var(--fs-md); color: var(--ink); font-family: inherit;
}
.lp .signup-input::placeholder { color: var(--text-3); }
.lp .signup-btn {
  display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0;
  height: 46px; padding: 0 22px; border: none; border-radius: 9999px; cursor: pointer;
  background: var(--blue); color: #fff; font-size: 15px; font-weight: 650; font-family: inherit;
  transition: background-color 0.2s ease;
}
.lp .signup-btn:hover { background: var(--blue-hover); }
.lp .signup-btn:disabled { opacity: 0.7; cursor: default; }
.lp .signup-msg { margin: var(--s3) 0 0; font-size: var(--fs-sm); font-weight: 600; }
.lp .signup-msg.is-ok { color: #0f6b36; }
.lp .signup-msg.is-error { color: #b4232c; }
.lp .signup-note { margin: var(--s3) 0 0; font-size: 13px; color: var(--text-3); }
@media (max-width: 480px) {
  /* Stacked on phones: a full-size field and a full-width button, no pill shell. */
  .lp .signup-pill, .lp .signup-pill:focus-within { flex-direction: column; align-items: stretch; gap: 10px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .lp .signup-input { flex: none; height: 50px; padding: 0 20px; background: #fff; border: 1px solid #cfd9de; border-radius: 9999px; }
  .lp .signup-input:focus-visible { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.2); }
  .lp .signup-btn { justify-content: center; height: 50px; }
}

/* sources strip */
.lp .proof { margin: var(--s7) auto 0; max-width: 760px; padding-top: var(--s5); border-top: 1px solid var(--line); }
.lp .proof-label { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-3); }
.lp .logos { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 760px; margin: var(--s3) auto 0; padding: 0; list-style: none; }
.lp .logos li { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 8px; border: 1px solid var(--line); border-radius: 9999px; font-size: 14px; font-weight: 600; color: var(--ink); background: #fff; }
.lp .logos img { width: 20px; height: 20px; border-radius: 5px; }
@media (max-width: 760px) { .lp .proof { margin-top: var(--s6); } .lp .logos li { font-size: 13px; } }

/* today's brief as feed cards (mirrors FeedApp .xw cards) */
.lp .sec-date { margin: 8px 0 0; font-size: 15px; color: var(--text-3); }
.lp .fcol { max-width: 600px; margin: 0 auto; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: #fff; }
.lp .fcard { padding: 22px 0 26px; border-bottom: 1px solid var(--line); }
.lp .fkicker { display: flex; align-items: center; gap: 6px; margin: 0 0 16px; padding: 0 18px; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pink); }
.lp .fimg { display: block; width: 100%; height: 340px; margin: 0 0 22px; object-fit: cover; object-position: center 28%; background: var(--hover); }
.lp .fbody { padding: 0 18px; }
.lp .ftitle { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.16; color: var(--ink); }
.lp .fsum { margin: 10px 0 0; font-size: 16px; line-height: 1.45; color: var(--text-2); }
.lp .fmeta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 12px 0 0; font-size: 13px; font-weight: 600; color: var(--text-2); }
@media (max-width: 640px) {
  /* Edge to edge on phones, like the feed column. */
  .lp .fcol { margin: 0 calc(-1 * var(--s3)); border-left: 0; border-right: 0; border-radius: 0; }
  .lp .fcard { padding: 18px 0 22px; }
  .lp .fkicker { padding: 0 20px; margin-bottom: 14px; }
  .lp .fimg { height: 240px; margin-bottom: 18px; }
  .lp .fbody { padding: 0 20px; }
  .lp .ftitle { font-size: 22px; }
  .lp .fsum { font-size: 14.5px; }
}
.lp .ftitle a, .lp .bd-story h3 a { color: inherit; text-decoration: none; }
.lp .ftitle a:hover, .lp .bd-story h3 a:hover { text-decoration: underline; }
.lp .fav-stack { display: inline-flex; align-items: center; }
.lp .fav-stack img { width: 16px; height: 16px; border-radius: 9999px; background: #fff; box-shadow: 0 0 0 1px var(--line); object-fit: contain; }
.lp .fav-stack img + img { margin-left: -5px; }
.lp .ffoot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; font-size: 14px; color: var(--text-2); }
.lp .fbtn { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 9999px; background: var(--blue); color: #fff; font-weight: 700; text-decoration: none; }
.lp .fbtn:hover { background: var(--blue-hover); }

/* how it works */
.lp .steps { display: grid; grid-template-columns: 1fr; gap: var(--s5); list-style: none; margin: 0; padding: 0; }
@media (min-width: 780px) { .lp .steps { grid-template-columns: repeat(3, 1fr); gap: var(--s6); } }
.lp .step { padding: 0; }
.lp .step-icon, .lp .yg-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(29, 155, 240, 0.1); color: var(--blue); margin-bottom: var(--s2); }
.lp .step-viz { display: flex; align-items: center; gap: 10px; margin-top: var(--s3); }
.lp .viz-stack { display: inline-flex; }
.lp .viz-stack img { width: 28px; height: 28px; border-radius: 9999px; border: 2px solid #fff; background: #fff; margin-left: -8px; box-shadow: 0 1px 2px rgba(15,20,25,0.12); }
.lp .viz-stack img:first-child { margin-left: 0; }
.lp .viz-arrow { color: var(--text-3); font-weight: 700; }
.lp .viz-more { font-size: 13px; font-weight: 700; color: var(--text-2); }
.lp .viz-mail { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 12px; background: #fff; border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(15,20,25,0.08); font-size: 13px; color: var(--text-2); }
.lp .viz-mail svg { color: var(--blue); }
.lp .viz-mail b { color: var(--ink); }
.lp .viz-mail em { font-style: normal; color: var(--text-3); margin-left: 4px; }
.lp .viz-card { padding: 6px 12px; border-radius: 9999px; background: var(--ink); color: #fff; font-size: 13px; font-weight: 700; }
.lp .chip { display: inline-flex; align-items: center; gap: 6px; }
.lp .step-title { margin: var(--s2) 0 var(--s2); font-family: var(--serif); font-size: 22px; font-weight: 800; letter-spacing: -0.015em; line-height: 1.2; }
.lp .step-body { margin: 0; font-size: var(--fs-md); line-height: 1.65; color: var(--text-2); }
/* Single column on phones: centre each step (and feature intro) under the
   centred section heading instead of hugging the left edge. */
@media (max-width: 779px) {
  .lp .step, .lp .yg-copy { text-align: center; }
  .lp .step-viz { justify-content: center; }
  .lp .yg-copy .yg-link { justify-content: center; }
}

/* make it yours */
.lp .builder-label { margin: 0 0 var(--s2); font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }
.lp .chips { display: flex; flex-wrap: wrap; gap: var(--s2); }
.lp .chip { cursor: pointer; font-family: inherit; transition: background 0.15s ease, color 0.15s ease; padding: 6px 14px; border-radius: 9999px; border: 1px solid #cfd9de; font-size: var(--fs-sm); font-weight: 550; color: var(--text-2); background: #fff; }
.lp .chip.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.lp .seg { display: inline-flex; padding: 3px; border-radius: 9999px; background: var(--hover); border: 1px solid var(--line); }
.lp .seg button { cursor: pointer; border: 0; background: transparent; font-family: inherit; padding: 6px 16px; border-radius: 9999px; font-size: var(--fs-sm); font-weight: 600; color: var(--text-2); }
.lp .seg button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(20, 22, 26, 0.15); }
.lp .bd { display: grid; gap: var(--s5); max-width: 1040px; margin: 0 auto; align-items: start; }
@media (min-width: 900px) { .lp .bd { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: var(--s6); } }
.lp .bd-controls { display: grid; gap: var(--s4); align-content: start; }
.lp .bd-cta { justify-self: start; }
.lp .bd-email { height: auto; display: flex; flex-direction: column; background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(15, 20, 25, 0.08); }
.lp .bd-email-head { padding: 18px 20px 14px; border-bottom: 1px solid var(--line); flex-shrink: 0; }
.lp .bd-brand { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--blue); }
.lp .bd-headline { margin: 4px 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.lp .bd-email-body { flex: 1; padding: 0 0 12px; }
/* A fixed, self-scrolling preview only where there is room beside the controls;
   on phones an inner scroller traps the page, so it grows instead. */
.lp .bd-more { display: none; }
@media (max-width: 899px) {
  .lp .bd-email-body.collapsed .bd-extra { display: none; }
  .lp .bd-email-body.collapsed .bd-more { display: block; width: calc(100% - 36px); margin: 14px 18px 4px; height: 44px; border: 1px solid #cfd9de; border-radius: 9999px; background: #fff; color: var(--ink); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
}
@media (min-width: 900px) {
  .lp .bd-email { height: 560px; }
  .lp .bd-email-body { overflow-y: auto; overscroll-behavior: contain; }
}
.lp .bd-kicker { margin: 0; padding: 18px 18px 0; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pink); }
.lp .bd-story { padding: 14px 18px 16px; border-bottom: 1px solid var(--line); }
.lp .bd-section:last-child .bd-story:last-child { border-bottom: 0; }
.lp .bd-story h3 { margin: 8px 0 0; font-size: 19px; font-weight: 700; line-height: 25px; letter-spacing: -0.01em; color: var(--ink); }
.lp .bd-story p { margin: 8px 0 0; font-size: 15px; line-height: 23px; color: var(--ink); }
.lp .bd-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 14px; color: var(--text-3); }
.lp .bd-src { color: var(--ink); font-weight: 700; text-decoration: none; }
.lp .bd-src:hover { text-decoration: underline; }
.lp .bd-meta .fav-stack img { width: 18px; height: 18px; }
.lp .bd-img { display: block; width: 100%; max-height: 320px; object-fit: cover; border-radius: 16px; margin-top: 12px; background: var(--hover); }

/* free + open source */
.lp .trust { display: flex; flex-direction: column; align-items: center; text-align: center; }
.lp .trust-icon { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin-bottom: var(--s4); border-radius: 16px; background: rgba(29, 155, 240, 0.1); color: var(--blue); }
.lp .trust .lede { margin: var(--s3) auto 0; }
.lp .trust-points { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: var(--s5) 0 0; padding: 0; list-style: none; }
.lp .trust-points li { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 9999px; background: #fff; border: 1px solid var(--line); font-size: 14px; font-weight: 650; color: var(--ink); }
.lp .trust-points svg { color: var(--blue); }
.lp .trust-actions { justify-content: center; margin-top: var(--s5); }

/* founder note */
.lp .founder { max-width: 720px; margin: 0 auto; display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: var(--s4); align-items: start; }
.lp .founder-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; display: block; box-shadow: 0 0 0 1px var(--line); }
.lp .founder-title { margin: 0 0 var(--s3); font-size: var(--fs-xl); font-weight: 650; line-height: 1.3; }
.lp .founder-p { margin: 0 0 var(--s3); font-size: var(--fs-md); line-height: 1.7; color: var(--ink); }
.lp .founder-sign { margin: var(--s3) 0 0; font-family: var(--serif); font-size: var(--fs-xl); font-style: italic; color: var(--text-2); }
.lp .bmc-btn { display: inline-flex; align-items: center; gap: 8px; margin-top: var(--s4); height: 44px; padding: 0 20px; border-radius: 9999px; background: #ffdd00; color: #0f1419; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 1px 2px rgba(15, 20, 25, 0.12); transition: transform 0.15s ease, box-shadow 0.15s ease; }
.lp .bmc-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15, 20, 25, 0.14); }
.lp .bmc-note { margin: 10px 0 0; font-size: 14px; color: var(--text-3); }
.lp .flink { color: var(--ink); font-weight: 650; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #b9b4a8; }
.lp .flink:hover { text-decoration-color: var(--ink); }
@media (max-width: 560px) { .lp .founder { grid-template-columns: 1fr; gap: var(--s3); } }

/* faq */
.lp .faq { max-width: 720px; margin: 0 auto; border-top: 1px solid var(--line); }
.lp .faq-item { border-bottom: 1px solid var(--line); }
.lp .faq-item summary {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s3);
  padding: var(--s4) 0; font-size: var(--fs-lg); font-weight: 600; cursor: pointer; list-style: none;
}
.lp .faq-item summary::-webkit-details-marker { display: none; }
.lp .faq-item summary::after {
  content: '+'; flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #cfd9de; color: var(--text-2); font-size: 18px; font-weight: 400; line-height: 1;
}
.lp .faq-item[open] summary::after { content: '−'; background: var(--ink); border-color: var(--ink); color: #fff; }
.lp .faq-item p { margin: 0; padding: 0 var(--s6) var(--s4) 0; font-size: var(--fs-md); line-height: 1.7; color: var(--text-2); }
@media (max-width: 560px) { .lp .faq-item summary { font-size: var(--fs-md); } .lp .faq-item p { padding-right: 0; } }

/* final cta */
.lp .final-wrap { max-width: 1120px; margin: 0 auto var(--s5); padding: 0 var(--s4); }
.lp .final-cta {
  padding: var(--s7) var(--s4); text-align: center; border-radius: 28px;
  background: var(--ink); color: #fff;
}
.lp .final-cta .h2 { max-width: 720px; margin: 0 auto var(--s3); }
.lp .final-cta .lede { margin: 0 auto var(--s5); color: #c9ced6; }
.lp .final-cta .signup-note { color: #b4bac4; }
.lp .final-cta .signup-msg.is-ok { color: #7ee2a8; }
.lp .final-cta .signup-msg.is-error { color: #ff9aa2; }
.lp .final-apps { margin: var(--s5) 0 0; display: flex; flex-wrap: wrap; justify-content: center; gap: var(--s2) var(--s4); font-size: var(--fs-sm); color: #b4bac4; }
.lp .final-apps a { color: #fff; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(255,255,255,0.4); }
.lp .final-apps a:hover { text-decoration-color: #fff; }
@media (max-width: 760px) { .lp .final-wrap { padding: 0 var(--s3); } .lp .final-cta { padding: var(--s7) var(--s3); border-radius: 24px; } }

/* demo components (shared with the launch video) */
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
.lp .yg-copy h3 {
  margin: 0; font-size: clamp(1.6rem, 2.8vw, 2.25rem); font-weight: 800;
  letter-spacing: -0.03em; line-height: 1.12;
}
.lp .yg-copy p:not(.yg-kicker) { margin: 14px 0 0; font-size: 16.5px; line-height: 1.65; color: var(--text-2); }
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
  .lp .yg { padding: 48px 18px 32px; }
  .lp .yg-row { grid-template-columns: minmax(0, 1fr); padding: 36px 0; --yg-demo-h: 500px; }
  .lp .yg-demo, .lp .yg-frame { height: auto; min-width: 0; }
  .lp .yg-nt-grid .yg-nt-card:nth-child(n+5) { display: none; }
  .lp .yg-copy { max-width: none; }
  .lp .yg-copy p:not(.yg-kicker) { font-size: 14.5px; }
}

/* where you read it (demo rows) */
.lp .yg { max-width: 1120px; padding-top: var(--s8); padding-bottom: var(--s5); }
.lp .yg-row { padding: var(--s6) 0; gap: var(--s5); }
.lp .yg-row:first-of-type { padding-top: 0; }
.lp .yg-row { --yg-demo-h: 500px; }
.lp .yg-copy h3 { font-family: var(--serif); font-weight: 800; letter-spacing: -0.02em; text-wrap: balance; }
@media (min-width: 900px) { .lp .yg-row { gap: var(--s8); padding: var(--s7) 0; } }
@media (max-width: 760px) { .lp .yg { padding-top: var(--s7); } .lp .yg-row { padding: var(--s5) 0; } }

@media (prefers-reduced-motion: reduce) {
  .lp * { transition: none !important; animation: none !important; }
}

`;
