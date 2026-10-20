/**
 * Homepage stylesheet (`.hp`), modelled on join1440.com: a display serif over
 * system sans, a lavender subscribe strip, tilted pastel cards, and alternating
 * rows on soft colour panels. Palette values are 1440's own scale.
 *
 * Rendered alongside LANDING_CSS, which styles the shared product demos (yg-*)
 * the rows show. The `.hp .hp-panel` demo tweaks here only apply on the
 * homepage, so the launch video that reuses the demos is unaffected.
 */
export const HOME_CSS = `
.hp {
  --hp-ink: #0a0a0a;
  --hp-text: #323232;
  --hp-muted: #767676;
  --hp-line: #e5e5e5;
  --hp-gray: #f7f7f8;
  --hp-blue: #1634cc;
  --hp-blue-hover: #102798;
  --hp-lav: #edeffd;
  --hp-serif: var(--font-hp-serif), "Times New Roman", serif;
  --hp-hand: var(--font-hp-hand), "Bradley Hand", cursive;
  color: var(--hp-ink);
  background: #fff;
}
.hp a:focus-visible, .hp button:focus-visible, .hp summary:focus-visible, .hp input:focus-visible {
  outline: 2px solid var(--hp-blue); outline-offset: 3px; border-radius: 4px;
}
.hp .hp-h1, .hp .hp-h2, .hp .hp-h3, .hp .hp-card-title, .hp .hp-how-title, .hp .hp-mail-mark {
  font-family: var(--hp-serif); font-weight: 500;
  letter-spacing: -0.005em; text-wrap: balance;
}

/* subscribe strip */
.hp .hp-strip { background: var(--hp-lav); }
/* Anchors and tabbing land below the sticky header. */
:root:has(.hp) { scroll-padding-top: 72px; }
.hp .hp-strip-in {
  max-width: 1230px; margin: 0 auto; padding: 16px 24px;
  display: flex; align-items: center; justify-content: space-between; gap: 32px;
}
.hp .hp-strip-title { margin: 0; font-size: 14.5px; font-weight: 650; line-height: 1.4; }
.hp .hp-strip-sub { margin: 2px 0 0; font-size: 14.5px; line-height: 1.45; color: var(--hp-ink); }
.hp .hp-strip-sub a, .hp .hp-fine a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }

/* email form */
.hp .hp-signup { flex-shrink: 0; }
.hp .hp-form { display: flex; gap: 12px; }
.hp .hp-input {
  width: 240px; min-width: 0; height: 36px; padding: 0 10px; border: 1px solid #8f8f8f; border-radius: 3px;
  background: #fff; color: var(--hp-ink); font: inherit; font-size: 16px;
}
.hp .hp-input::placeholder { color: var(--hp-muted); }
.hp .hp-input:focus-visible { outline: none; border-color: var(--hp-blue); box-shadow: 0 0 0 3px rgba(22, 52, 204, 0.18); }
.hp .hp-submit {
  height: 36px; padding: 0 14px; border: 0; border-radius: 3px; background: var(--hp-blue); color: #fff;
  font: inherit; font-size: 16px; cursor: pointer; white-space: nowrap; transition: background-color 0.15s ease;
}
.hp .hp-submit:hover { background: var(--hp-blue-hover); }
.hp .hp-submit[aria-disabled="true"] { opacity: 0.7; cursor: default; }
.hp .hp-msg { margin: 8px 0 0; font-size: 14px; font-weight: 600; }
.hp .hp-msg:empty { margin: 0; }
.hp .hp-msg.is-ok { color: #10601f; }
.hp .hp-msg.is-error { color: #971111; }
.hp .hp-fine { display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0; font-size: 13px; line-height: 1.4; color: var(--hp-ink); }
.hp .hp-fine svg { flex-shrink: 0; margin-top: 1px; }
.hp .hp-signup-box .hp-input { width: 100%; flex: 1; height: 44px; font-size: 17px; }
.hp .hp-signup-box .hp-submit { height: 44px; padding: 0 18px; font-size: 17px; }

/* hero + cards */
.hp .hp-top { background: linear-gradient(180deg, #fff 0%, #fff 22%, var(--hp-gray) 58%); }
.hp .hp-hero { max-width: 900px; margin: 0 auto; padding: 64px 24px 56px; text-align: center; }
.hp .hp-h1 { margin: 0 auto; max-width: 820px; font-size: clamp(2.6rem, 5vw, 4.25rem); line-height: 1.08; }
.hp .hp-hero-p { margin: 32px auto 0; max-width: 690px; font-size: 18px; line-height: 1.4; color: var(--hp-ink); text-wrap: pretty; }
.hp .hp-hero-p strong { font-weight: 650; }

.hp .hp-cards {
  list-style: none; margin: 0 auto; padding: 0 24px; max-width: 1290px;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
}
.hp .hp-card {
  border: 8px solid #fff; border-radius: 6px; box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 10px 30px rgba(10,10,10,0.05);
  transition: transform 0.25s ease;
}
.hp .hp-card-link {
  display: flex; flex-direction: column; align-items: center; height: 100%;
  padding: 28px 18px 26px; text-align: center; color: inherit; text-decoration: none;
}
.hp .hp-card-title { font-size: 32px; line-height: 1.05; }
.hp .hp-art { display: block; width: 100%; max-width: 196px; margin: 12px 0 14px; }
.hp .hp-card-text { margin-top: auto; font-size: 18px; font-weight: 600; line-height: 1.28; text-wrap: balance; }
.hp .hp-card-brief { background: #fefddd; color: #6c4904; transform: rotate(-2deg) translateY(10px); }
.hp .hp-card-feed { background: #e3f7fc; color: #08414f; transform: rotate(-0.6deg) translateY(-12px); }
.hp .hp-card-tab { background: #fde8f7; color: #9e0f79; transform: rotate(1.4deg) translateY(12px); }
.hp .hp-card-agents { background: #e0fdce; color: #10601f; transform: rotate(3deg); }
.hp .hp-card:hover { transform: rotate(0deg) translateY(-6px); }
.hp .hp-card-feed .hp-card-text { color: #0b6a80; }
.hp .hp-card-tab .hp-card-text { color: #b0117f; }

/* how we do it: the box sits across the grey/white seam */
.hp .hp-how-wrap { background: linear-gradient(180deg, var(--hp-gray) 0, var(--hp-gray) calc(50% + 24px), #fff calc(50% + 24px)); padding: 96px 24px 0; }
.hp .hp-how {
  position: relative; max-width: 790px; margin: 0 auto; padding: 36px 32px 34px;
  background: #f4f4f5; border: 8px solid #fff; border-radius: 16px;
}
.hp .hp-how-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; text-align: center; }
.hp .hp-how-title { margin: 0 0 10px; font-size: 30px; line-height: 1.05; }
.hp .hp-how-steps p { margin: 0 auto; max-width: 230px; font-size: 16px; line-height: 1.4; color: var(--hp-ink); }
.hp .hp-hand {
  position: absolute; left: -82px; top: -46px; margin: 0; font-family: var(--hp-hand); font-size: 25px; font-weight: 600;
  line-height: 0.95; color: #606060; transform: rotate(-9deg);
}
.hp .hp-hand-arrow { position: absolute; color: #606060; }
.hp .hp-hand-arrow-in { width: 52px; left: -32px; top: 12px; }
.hp .hp-hand-arrow-down { width: 34px; right: -40px; bottom: -48px; }

/* explore rows */
.hp .hp-explore { max-width: 1200px; margin: 0 auto; padding: 104px 24px 40px; }
.hp .hp-explore-head { max-width: 760px; margin: 0 auto 32px; text-align: center; }
.hp .hp-h2 { margin: 0; font-size: clamp(2.3rem, 4.4vw, 3.6rem); line-height: 1.06; }
.hp .hp-explore-head p { margin: 24px 0 0; font-size: 18px; line-height: 1.45; }
.hp .hp-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 80px; align-items: center; padding: 48px 0; }
.hp .hp-row-flip .hp-row-copy { order: 2; }
.hp .hp-row-copy { max-width: 550px; }
.hp .hp-kicker { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 16px; font-weight: 600; }
.hp .hp-h3 { margin: 0; font-size: clamp(2rem, 3.2vw, 2.6rem); line-height: 1.08; }
.hp .hp-row-copy > p:not(.hp-kicker):not(.hp-stat) { margin: 16px 0 0; font-size: 17px; line-height: 1.45; color: var(--hp-ink); }
.hp .hp-stat {
  display: flex; align-items: center; gap: 14px; margin: 24px 0 0; padding: 16px 0;
  border-top: 1px solid var(--hp-line); border-bottom: 1px solid var(--hp-line); font-size: 16px;
}
.hp .hp-stat b { font-weight: 650; }
.hp .hp-faces { display: inline-flex; flex-shrink: 0; }
.hp .hp-faces img { width: 28px; height: 28px; border-radius: 50%; background: #fff; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--hp-line); object-fit: contain; }
.hp .hp-faces img + img { margin-left: -9px; }
.hp .hp-btns { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 24px; }
.hp .hp-btn {
  display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 18px; border-radius: 3px;
  font-size: 17px; text-decoration: none; white-space: nowrap; transition: background-color 0.15s ease, border-color 0.15s ease;
}
.hp .hp-btn-dark { background: var(--hp-ink); color: #fff; }
.hp .hp-btn-dark:hover { background: #323232; }
.hp .hp-btn-line { border: 1px solid #c7c7c7; background: #fff; color: var(--hp-ink); }
.hp .hp-btn-line:hover { border-color: var(--hp-ink); }

.hp .hp-topics { list-style: none; margin: 24px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px; }
.hp .hp-topics li { border-bottom: 1px solid var(--hp-line); }
.hp .hp-topics li:nth-child(-n+2) { border-top: 1px solid var(--hp-line); }
.hp .hp-topics a { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 0; color: var(--hp-ink); font-size: 17px; font-weight: 550; text-decoration: none; }
.hp .hp-topics a span { display: inline-flex; align-items: center; gap: 12px; }
.hp .hp-topic-arrow { color: #10839e; transition: transform 0.15s ease; }
.hp .hp-topics a:hover .hp-topic-arrow { transform: translateX(3px); }
.hp .hp-more { display: inline-block; margin-top: 18px; color: var(--hp-ink); font-size: 16px; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }

/* colour panels holding the product pictures */
.hp .hp-panel {
  --panel: #fdfbc9; position: relative; height: 490px; padding: 44px 44px 0; border-radius: 24px;
  background: var(--panel); overflow: hidden;
}
.hp .hp-panel::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 110px; pointer-events: none;
  background: linear-gradient(180deg, transparent, var(--panel) 85%);
}
.hp .hp-panel-yellow { --panel: #fdfbc9; }
.hp .hp-panel-cyan { --panel: #e3f7fc; }
.hp .hp-panel-magenta { --panel: #fde8f7; }
.hp .hp-panel-green { --panel: #e0fdce; }
.hp .hp-panel > .yg-frame { height: 560px; border-radius: 16px; }
/* The panels are narrower than the demos' own breakpoints expect around 960-1020px. */
.hp .hp-panel .yg-feed-tab, .hp .hp-panel .yg-streak { white-space: nowrap; }

.hp .hp-mail-card {
  position: relative; z-index: 1; display: flex; align-items: center; gap: 16px; padding: 16px 18px;
  background: #fff; border-radius: 12px; box-shadow: 0 12px 32px rgba(10,10,10,0.10), 0 1px 3px rgba(10,10,10,0.06);
}
.hp .hp-mail-logo { width: 48px; height: 48px; padding: 9px; border-radius: 10px; background: #fff; box-shadow: inset 0 0 0 1.5px var(--hp-ink); object-fit: contain; flex-shrink: 0; }
.hp .hp-mail-name { margin: 0; font-size: 16px; font-weight: 650; }
.hp .hp-mail-promise { margin: 2px 0 0; font-size: 15px; color: var(--hp-text); }
.hp .hp-mail-promise i { font-style: normal; color: var(--hp-muted); padding: 0 2px; }
.hp .hp-mail-paper { margin: -4px 22px 0; padding: 24px 26px; background: #fff; box-shadow: 0 1px 3px rgba(10,10,10,0.05); }
.hp .hp-mail-mark { margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid var(--hp-line); font-size: 22px; line-height: 1.2; }
.hp .hp-mail-mark span { background: #ffef5f; padding: 0 5px; }
.hp .hp-mail-story + .hp-mail-story { margin-top: 18px; }
.hp .hp-mail-title { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 20px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; }
.hp .hp-mail-sum { margin: 10px 0 0; font-size: 14.5px; line-height: 1.5; color: var(--hp-text); }

/* faq */
.hp .hp-faq { max-width: 780px; margin: 0 auto; padding: 72px 24px 24px; }
.hp .hp-faq .hp-h2 { text-align: center; margin-bottom: 36px; }
.hp .hp-faq-list { border-top: 1px solid var(--hp-line); }
.hp .hp-faq-item { border-bottom: 1px solid var(--hp-line); }
.hp .hp-faq-item summary {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 0;
  font-size: 18px; font-weight: 600; cursor: pointer; list-style: none;
}
.hp .hp-faq-item summary::-webkit-details-marker { display: none; }
.hp .hp-faq-item summary::after { content: "+"; flex-shrink: 0; font-size: 26px; font-weight: 300; line-height: 1; color: var(--hp-muted); }
.hp .hp-faq-item[open] summary::after { content: "\\2212"; }
.hp .hp-faq-item p { margin: 0; padding: 0 40px 22px 0; font-size: 16.5px; line-height: 1.6; color: var(--hp-text); }

/* join */
.hp .hp-join { max-width: 1200px; margin: 0 auto; padding: 88px 24px 96px; }
.hp .hp-join .hp-h2 { max-width: 720px; margin: 0 auto 44px; text-align: center; font-size: clamp(2rem, 3.6vw, 2.9rem); }
.hp .hp-join-box { padding: 0 2px 2px; border-radius: 24px; background: var(--hp-lav); }
.hp .hp-join-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 420px); gap: 40px; align-items: center; padding: 40px 44px 36px; }
.hp .hp-join-title { margin: 0; font-size: 23px; font-weight: 650; line-height: 1.3; }
.hp .hp-join-sub { margin: 6px 0 0; font-size: 16px; }
.hp .hp-join-proof { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; font-size: 16px; }
.hp .hp-count { padding: 0 6px; background: #ffef5f; font-family: var(--hp-serif); font-size: 26px; font-weight: 700; line-height: 1.15; }
.hp .hp-quote {
  margin: 0; padding: 56px 72px 44px; border-radius: 22px; background: #fff; text-align: center;
  box-shadow: 0 0 0 1px #dfe3fb;
}
.hp .hp-quote blockquote { position: relative; max-width: 700px; margin: 0 auto; font-size: 20px; line-height: 1.55; }
.hp .hp-quote blockquote::before, .hp .hp-quote blockquote::after {
  position: absolute; font-family: Georgia, serif; font-size: 72px; line-height: 1; color: #d4d4d4;
}
.hp .hp-quote blockquote::before { content: "\\201C"; left: -48px; top: -18px; }
.hp .hp-quote blockquote::after { content: "\\201D"; right: -44px; bottom: -44px; }
.hp .hp-quote mark { background: #fdfbc9; color: inherit; padding: 0 2px; }
.hp .hp-quote figcaption { display: inline-flex; align-items: center; gap: 10px; margin-top: 24px; font-size: 16px; font-style: italic; font-weight: 600; }
.hp .hp-quote cite { font-style: italic; }
.hp .hp-quote-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.hp .hp-coffee { display: block; width: max-content; max-width: 100%; margin: 18px auto 0; font-size: 14.5px; color: var(--hp-text); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #c7c7c7; }
.hp .hp-coffee:hover { color: var(--hp-ink); text-decoration-color: var(--hp-ink); }

/* tablets */
@media (max-width: 1100px) {
  .hp .hp-hand { left: -16px; top: -54px; }
  .hp .hp-hand-arrow-in { display: none; }
}
@media (max-width: 960px) {
  .hp .hp-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; max-width: 680px; }
  .hp .hp-card-brief, .hp .hp-card-feed, .hp .hp-card-tab, .hp .hp-card-agents { transform: rotate(-1deg); }
  .hp .hp-card:nth-child(even) { transform: rotate(1.2deg); }
  .hp .hp-card:hover { transform: rotate(0deg) translateY(-6px); }
  .hp .hp-hand-arrow-down { display: none; }
  .hp .hp-row, .hp .hp-join-top { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .hp .hp-row-flip .hp-row-copy { order: 0; }
  .hp .hp-row-copy { max-width: none; }
  .hp .hp-panel { height: 440px; }
}
/* phones */
@media (max-width: 760px) {
  .hp .hp-strip-in { flex-direction: column; align-items: stretch; gap: 12px; padding: 14px 16px; }
  .hp .hp-strip .hp-input { flex: 1; width: auto; height: 42px; }
  .hp .hp-strip .hp-submit { height: 42px; }
  .hp .hp-hero { padding: 44px 18px 40px; }
  .hp .hp-hero-p { margin-top: 20px; font-size: 17px; }
  .hp .hp-cards { padding: 0 16px; gap: 12px; }
  .hp .hp-card { border-width: 6px; }
  .hp .hp-card-link { min-height: 0; padding: 22px 12px 20px; }
  .hp .hp-card-title { font-size: 26px; }
  .hp .hp-art { margin: 8px 0 10px; }
  .hp .hp-card-text { font-size: 15px; }
  .hp .hp-how-wrap { padding: 80px 16px 0; }
  .hp .hp-how { padding: 28px 20px; }
  .hp .hp-how-steps { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .hp .hp-hand { left: 4px; top: -58px; font-size: 22px; }
  .hp .hp-explore { padding: 72px 16px 16px; }
  .hp .hp-row { padding: 32px 0; }
  .hp .hp-panel { height: 400px; padding: 24px 20px 0; border-radius: 18px; }
  .hp .hp-mail-paper { margin: -4px 10px 0; padding: 18px; }
  .hp .hp-topics { grid-template-columns: minmax(0, 1fr); }
  .hp .hp-topics li:nth-child(2) { border-top: 0; }
  .hp .hp-faq { padding: 56px 16px 8px; }
  .hp .hp-faq-item summary { font-size: 16.5px; }
  .hp .hp-faq-item p { padding-right: 0; }
  .hp .hp-join { padding: 64px 16px 72px; }
  .hp .hp-join-top { padding: 28px 20px 24px; }
  .hp .hp-quote { padding: 40px 28px 32px; }
  .hp .hp-quote blockquote { font-size: 17.5px; }
  .hp .hp-quote blockquote::before { left: -18px; top: -30px; font-size: 56px; }
  .hp .hp-quote blockquote::after { display: none; }
}
@media (max-width: 420px) {
  .hp .hp-btns { flex-direction: column; align-items: stretch; }
  .hp .hp-btn { justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .hp .hp-card, .hp .hp-topic-arrow { transition: none; }
}
`;
