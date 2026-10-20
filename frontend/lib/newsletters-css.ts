/**
 * /newsletters and /newsletters/[slug] on top of HOME_CSS (the 1440-style
 * homepage system), in the same family as COMPARE_CSS: a centred serif hero
 * over a white-to-grey wash, white review cards with a hairline border on a
 * grey band, and on a review a rating chip, a green "Pros" and a pink "Cons"
 * panel, a ruled method note, a closing call to action and link cards.
 *
 * Render it after HOME_CSS inside a `.hp.nl` wrapper. Everything is scoped
 * under `.hp.nl` / `.hp .nl-*` so nothing leaks into other pages. Keep the
 * class names clear of `nl-toast` / `nl-open` (globals.css owns those).
 */
export const NEWSLETTERS_CSS = `
/* Same base size as the homepage. */
.hp.nl { font-size: 16px; line-height: 1.5; }

/* ---------- hero ---------- */
.hp .nl-top { background: linear-gradient(180deg, #fff 0%, #fff 30%, var(--hp-gray) 100%); }
.hp .nl-hero { max-width: 960px; margin: 0 auto; padding: 72px 24px 48px; text-align: center; }
.hp .nl-hero .hp-kicker { justify-content: center; margin-bottom: 16px; color: #666; }
.hp .nl-hero .hp-h1 { max-width: 940px; font-size: clamp(2.4rem, 4.6vw, 3.9rem); }
.hp.nl-detail .nl-hero .hp-h1 { max-width: 900px; font-size: clamp(2.2rem, 4.2vw, 3.4rem); line-height: 1.1; }
.hp .nl-hero .hp-hero-p { margin-top: 28px; max-width: 700px; }
.hp .nl-hero .hp-btns { justify-content: center; margin-top: 32px; }

/* back link above the title */
.hp .nl-crumb {
  display: flex; width: max-content; max-width: 100%; align-items: center; gap: 6px; margin: 0 auto 24px; color: #666;
  font-size: 15px; font-weight: 550; text-decoration: none;
}
.hp .nl-crumb::before { content: "\\2190" / ""; color: var(--hp-blue); font-weight: 400; transition: transform 0.15s ease; }
.hp .nl-crumb:hover { color: var(--hp-ink); text-decoration: underline; text-underline-offset: 3px; }
.hp .nl-crumb:hover::before { transform: translateX(-3px); }

/* A long unbroken name or URL wraps instead of widening the page. */
.hp .nl-hero .hp-h1, .hp .nl-hero .hp-hero-p, .hp .nl-card-title, .hp .nl-card-text, .hp .nl-chip,
.hp .nl-list li, .hp .nl-method p, .hp .nl-visit { overflow-wrap: anywhere; }

/* ---------- stars, chips ---------- */
/* #a35f00 on white is 5:1; the outlined stars read as "empty" by shape. */
.hp .nl-stars { color: #a35f00; letter-spacing: 0.04em; white-space: nowrap; line-height: 1; }
.hp .nl-chip {
  display: inline-flex; align-items: center; padding: 3px 10px; border: 1px solid var(--hp-line); border-radius: 4px;
  background: var(--hp-gray); color: var(--hp-text); font-size: 13.5px; font-weight: 550; line-height: 1.4;
}
.hp .nl-chip-freq { border-color: transparent; background: var(--hp-lav); color: var(--hp-blue); font-weight: 600; }

/* ---------- index cards ---------- */
.hp .nl-grid-wrap { background: var(--hp-gray); padding: 8px 24px 104px; }
.hp .nl-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.hp .nl-card {
  display: flex; flex-direction: column; padding: 28px 28px 24px; border: 1px solid var(--hp-line); border-radius: 12px;
  background: #fff; color: inherit; text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.2s ease, transform 0.2s ease;
}
.hp .nl-card:hover { border-color: #c7c7c7; box-shadow: 0 12px 32px rgba(10,10,10,0.07); transform: translateY(-3px); }
.hp .nl-card:focus-visible { border-radius: 12px; }
.hp .nl-card:nth-child(5n+1) { --tint: #fdfbc9; --tint-ink: #6c4904; }
.hp .nl-card:nth-child(5n+2) { --tint: #e3f7fc; --tint-ink: #08414f; }
.hp .nl-card:nth-child(5n+3) { --tint: #fde8f7; --tint-ink: #9e0f79; }
.hp .nl-card:nth-child(5n+4) { --tint: #e0fdce; --tint-ink: #10601f; }
.hp .nl-card:nth-child(5n+5) { --tint: #edeffd; --tint-ink: #1634cc; }
.hp .nl-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hp .nl-tag {
  padding: 3px 10px; border-radius: 4px; background: var(--tint); color: var(--tint-ink);
  font-size: 13.5px; font-weight: 600; line-height: 1.4; letter-spacing: 0;
}
.hp .nl-rate { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--hp-ink); }
.hp .nl-rate .nl-stars { font-size: 15px; }
.hp .nl-card-title {
  margin: 18px 0 0; font-family: var(--hp-serif); font-size: 28px; font-weight: 500; line-height: 1.12;
  letter-spacing: -0.005em; text-wrap: balance; color: var(--hp-ink);
}
.hp .nl-card-text { margin: 14px 0 0; font-size: 16px; line-height: 1.5; color: var(--hp-text); text-wrap: pretty; }
.hp .nl-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px; }
.hp .nl-more { display: inline-flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 24px; font-size: 16px; font-weight: 600; color: var(--hp-ink); }
.hp .nl-more::after { content: "\\2192" / ""; color: var(--hp-blue); transition: transform 0.15s ease; }
.hp .nl-card:hover .nl-more::after { transform: translateX(4px); }

/* ---------- review: rating row ---------- */
.hp .nl-score {
  display: inline-flex; align-items: center; gap: 14px; margin-top: 32px; padding: 12px 22px;
  border: 1px solid var(--hp-line); border-radius: 12px; background: #fff; box-shadow: 0 1px 2px rgba(10,10,10,0.04);
}
.hp .nl-score .nl-stars { font-size: 24px; }
.hp .nl-score-num { font-family: var(--hp-serif); font-size: 30px; font-weight: 500; line-height: 1; letter-spacing: -0.005em; color: var(--hp-ink); }
.hp .nl-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 18px auto 0; max-width: 640px; }
.hp .nl-meta .nl-chip { padding: 5px 13px; font-size: 15px; }
.hp .nl-visit { white-space: normal; height: auto; min-height: 46px; padding-top: 10px; padding-bottom: 10px; text-align: left; }

/* ---------- review: pros and cons ---------- */
.hp .nl-band { background: linear-gradient(180deg, var(--hp-gray) 0, var(--hp-gray) calc(100% - 72px), #fff 100%); padding: 8px 24px 96px; }
.hp .nl-panels { max-width: 952px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.hp .nl-panel { padding: 36px 36px 28px; border-radius: 16px; background: var(--tint); }
.hp .nl-pros { --tint: #e0fdce; --tint-ink: #10601f; }
.hp .nl-cons { --tint: #fde8f7; --tint-ink: #9e0f79; }
.hp .nl-panel-title { display: flex; align-items: center; gap: 12px; font-size: clamp(1.6rem, 2.4vw, 2rem); line-height: 1.12; }
.hp .nl-sign {
  display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%;
  background: #fff; color: var(--tint-ink); font-family: system-ui, sans-serif; font-size: 22px; font-weight: 600; line-height: 1;
}
.hp .nl-list { list-style: none; margin: 20px 0 0; padding: 0; }
.hp .nl-list li {
  position: relative; padding: 13px 0 13px 26px; border-top: 1px solid rgba(10,10,10,0.12);
  font-size: 17px; line-height: 1.5; color: var(--hp-ink); text-wrap: pretty;
}
.hp .nl-list li::before { content: ""; position: absolute; left: 2px; top: 1.15em; width: 8px; height: 8px; border-radius: 50%; background: var(--tint-ink); }

/* ---------- review: body sections ---------- */
.hp .nl-wrap { max-width: 1000px; margin: 0 auto; padding: 0 24px; }
.hp .nl-h2 { font-size: clamp(1.9rem, 3.2vw, 2.5rem); line-height: 1.1; text-align: left; }

.hp .nl-method {
  display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 56px; margin-top: 96px; padding: 40px 0;
  border-top: 1px solid var(--hp-line); border-bottom: 1px solid var(--hp-line);
}
.hp .nl-method p { margin: 0; font-size: 17px; line-height: 1.6; color: var(--hp-text); text-wrap: pretty; }

.hp .nl-cta { max-width: 720px; margin: 88px auto 0; text-align: center; }
.hp .nl-cta .hp-h2 { text-align: center; }
.hp .nl-cta p { margin: 20px auto 0; max-width: 600px; font-size: 18px; line-height: 1.45; color: var(--hp-ink); text-wrap: pretty; }
.hp .nl-cta .hp-btns { justify-content: center; margin-top: 28px; }

.hp .nl-explore { padding-top: 96px; }
.hp .nl-explore-label { margin: 0; font-size: 17px; font-weight: 600; color: var(--hp-ink); }
.hp .nl-rel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.hp .nl-rel-card {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px;
  border: 1px solid var(--hp-line); border-radius: 12px; background: #fff; color: var(--hp-ink);
  font-size: 17px; font-weight: 600; line-height: 1.35; text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.2s ease;
}
.hp .nl-rel-card::after { content: "\\2192" / ""; flex-shrink: 0; color: var(--hp-blue); font-weight: 400; transition: transform 0.15s ease; }
.hp .nl-rel-card:hover { border-color: var(--hp-ink); box-shadow: 0 8px 24px rgba(10,10,10,0.05); }
.hp .nl-rel-card:hover::after { transform: translateX(3px); }
.hp .nl-rel-card:focus-visible { border-radius: 12px; }

@media (max-width: 1000px) {
  .hp .nl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .hp .nl-method { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 32px 0; }
}
@media (max-width: 760px) {
  .hp .nl-hero { padding: 44px 18px 36px; }
  .hp .nl-hero .hp-hero-p { margin-top: 20px; font-size: 17px; }
  .hp .nl-hero .hp-btns { margin-top: 24px; }
  .hp .nl-crumb { margin-bottom: 20px; }
  .hp .nl-grid-wrap { padding: 4px 16px 72px; }
  .hp .nl-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .hp .nl-card { padding: 24px 22px 22px; }
  .hp .nl-card-title { font-size: 26px; }
  .hp .nl-score { margin-top: 24px; padding: 10px 18px; gap: 12px; }
  .hp .nl-score .nl-stars { font-size: 22px; }
  .hp .nl-score-num { font-size: 26px; }
  .hp .nl-band { padding: 4px 16px 56px; }
  .hp .nl-panels { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .hp .nl-panel { padding: 28px 24px 20px; border-radius: 14px; }
  .hp .nl-list li { font-size: 16.5px; }
  .hp .nl-wrap { padding: 0 16px; }
  .hp .nl-method { margin-top: 56px; }
  .hp .nl-cta { margin-top: 64px; }
  .hp .nl-cta p { font-size: 17px; }
  .hp .nl-explore { padding-top: 72px; }
  .hp .nl-rel-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 420px) {
  .hp .nl-visit { text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .hp .nl-card, .hp .nl-rel-card, .hp .nl-more::after, .hp .nl-rel-card::after, .hp .nl-crumb::before { transition: none; }
  .hp .nl-card:hover { transform: none; }
}
`;
