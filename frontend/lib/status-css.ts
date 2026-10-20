/**
 * Error and 404 pages, in the 1440-style site system (serif headline, handwritten
 * note, rectangular buttons, tilted pastel cards): one calm centred block and a
 * few small cards pointing somewhere useful.
 *
 * Deliberately self-contained instead of rendering the whole homepage sheet
 * (HOME_CSS, ~16 KB): not-found.tsx sits in every route's server payload, so
 * whatever it renders is shipped with every page. Palette and type values here
 * are the same ones HOME_CSS uses (lib/home-css.ts).
 */
export const STATUS_CSS = `
.st {
  --st-ink: #0a0a0a; --st-text: #323232; --st-muted: #666; --st-gray: #f7f7f8; --st-blue: #1634cc;
  --st-serif: var(--font-hp-serif), "Times New Roman", serif;
  --st-hand: var(--font-hp-hand), "Bradley Hand", cursive;
  min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
  /* Grey like the bottom of .st-main, so the footer's rounded corners sit on grey. */
  background: var(--st-gray); color: var(--st-ink);
  /* The root body font is Space Grotesk; the site pages read in the system sans. */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px; line-height: 1.5;
}
.st a:focus-visible, .st button:focus-visible { outline: 2px solid var(--st-blue); outline-offset: 3px; border-radius: 4px; }

.st-main {
  flex: 1 0 auto; display: flex; flex-direction: column; align-items: center;
  padding: 72px 24px 104px; background: linear-gradient(180deg, #fff 0%, #fff 34%, var(--st-gray) 100%);
}
.st-wrap { width: 100%; max-width: 680px; text-align: center; }
.st-note {
  display: inline-block; margin: 0 0 12px; font-family: var(--st-hand); font-size: 28px; font-weight: 600;
  line-height: 1; color: #606060; transform: rotate(-4deg);
}
.st-h1, .st-card-title { font-family: var(--st-serif); font-weight: 500; letter-spacing: -0.005em; text-wrap: balance; }
.st-h1 { margin: 0 auto; max-width: 820px; font-size: clamp(2.5rem, 5.2vw, 3.9rem); line-height: 1.08; }
/* Focused programmatically after an error so screen readers announce it; not an interactive control. */
.st-h1:focus { outline: none; }
.st-lede { margin: 24px auto 0; max-width: 520px; font-size: 18px; line-height: 1.45; text-wrap: pretty; }

.st-btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 32px; }
.st-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 46px; padding: 0 18px;
  border: 0; border-radius: 3px; font: inherit; font-size: 17px; text-decoration: none; white-space: nowrap; cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.st-btn-dark { background: var(--st-ink); color: #fff; }
.st-btn-dark:hover { background: var(--st-text); }
.st-btn-line { border: 1px solid #c7c7c7; background: #fff; color: var(--st-ink); }
.st-btn-line:hover { border-color: var(--st-ink); }

.st-fine { margin: 26px auto 0; max-width: 520px; font-size: 14.5px; line-height: 1.5; color: var(--st-muted); }
.st-fine a { color: var(--st-text); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #c7c7c7; }
.st-fine a:hover { color: var(--st-ink); text-decoration-color: var(--st-ink); }
.st-ref { display: block; margin-top: 2px; font-size: 13px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

.st-cards {
  list-style: none; margin: 72px auto 0; padding: 0; width: 100%; max-width: 780px;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 22px;
}
.st-card {
  --tint: #fefddd; --ink: #6c4904;
  flex: 0 1 236px; border: 7px solid #fff; border-radius: 6px; background: var(--tint); color: var(--ink);
  box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 10px 30px rgba(10,10,10,0.05); transition: transform 0.25s ease;
}
.st-card:nth-child(1) { transform: rotate(-1.8deg); }
.st-card:nth-child(2) { transform: rotate(1.2deg) translateY(6px); }
.st-card:nth-child(3) { transform: rotate(-0.8deg); }
.st-card:focus-within { transform: rotate(0deg) translateY(-4px); }
@media (hover: hover) {
  .st-card:hover { transform: rotate(0deg) translateY(-4px); }
}
.st-card-yellow { --tint: #fefddd; --ink: #6c4904; }
.st-card-cyan { --tint: #e3f7fc; --ink: #08414f; }
.st-card-pink { --tint: #fde8f7; --ink: #9e0f79; }
.st-card-green { --tint: #e0fdce; --ink: #10601f; }
.st-card-link { display: block; height: 100%; padding: 20px 18px; color: inherit; text-decoration: none; text-align: center; }
.st-card-title { display: block; font-size: 28px; line-height: 1.05; }
.st-card-text { display: block; margin-top: 8px; font-size: 15.5px; font-weight: 600; line-height: 1.3; text-wrap: balance; }

@media (max-width: 760px) {
  .st-main { padding: 48px 18px 72px; }
  .st-note { font-size: 25px; }
  .st-lede { margin-top: 20px; font-size: 17px; }
  .st-btns { margin-top: 28px; }
  .st-cards { margin-top: 56px; gap: 18px; flex-direction: column; align-items: center; }
  .st-card { flex: 0 0 auto; width: min(100%, 320px); }
}
@media (max-width: 420px) {
  .st-btns { flex-direction: column; align-items: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .st-card, .st-btn { transition: none; }
}
`;
