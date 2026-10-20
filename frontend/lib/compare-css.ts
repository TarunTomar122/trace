/**
 * /compare and /compare/[slug] on top of HOME_CSS (the 1440-style homepage
 * system): a centred serif hero, white index cards with a hairline border, a
 * clean comparison table with Trace's column in lavender, pastel panels for the
 * two "what you trade / gain" sections, and a ruled FAQ.
 */
export const COMPARE_CSS = `
/* Same base size as the homepage. */
.hp.cmp { font-size: 16px; line-height: 1.5; }

.hp .cmp-top { background: linear-gradient(180deg, #fff 0%, #fff 30%, var(--hp-gray) 100%); }
.hp.cmp-detail .cmp-top { background: linear-gradient(180deg, #fff 0%, #fff 14%, var(--hp-gray) 62%, #fff 100%); }
.hp .cmp-hero { max-width: 960px; margin: 0 auto; padding: 72px 24px 48px; text-align: center; }
.hp .cmp-hero .hp-kicker { justify-content: center; margin-bottom: 16px; color: var(--hp-muted); }
.hp .cmp-hero .hp-h1 { max-width: 940px; font-size: clamp(2.4rem, 4.6vw, 3.9rem); }
.hp.cmp-detail .cmp-hero .hp-h1 { max-width: 900px; font-size: clamp(2.2rem, 4.2vw, 3.4rem); line-height: 1.1; }
.hp .cmp-hero .hp-hero-p { margin-top: 28px; max-width: 700px; }

/* chips and small links */
.hp .cmp-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 32px; }
.hp .cmp-leaving {
  margin: 44px 0 0; font-family: var(--hp-hand); font-size: 27px; font-weight: 600; line-height: 1; color: #606060;
  transform: rotate(-2deg);
}
.hp .cmp-links-tight { margin-top: 18px; }
.hp .cmp-chip {
  display: inline-flex; align-items: center; height: 40px; padding: 0 15px; border: 1px solid #d4d4d4; border-radius: 4px;
  background: #fff; color: var(--hp-ink); font-size: 16px; text-decoration: none; white-space: nowrap;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.hp .cmp-chip:hover { border-color: var(--hp-ink); }

/* index cards */
.hp .cmp-grid-wrap { background: var(--hp-gray); padding: 8px 24px 104px; }
.hp .cmp-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.hp .cmp-card {
  display: flex; flex-direction: column; padding: 28px 28px 24px; border: 1px solid var(--hp-line); border-radius: 12px;
  background: #fff; color: inherit; text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.2s ease, transform 0.2s ease;
}
.hp .cmp-card:hover { border-color: #c7c7c7; box-shadow: 0 12px 32px rgba(10,10,10,0.07); transform: translateY(-3px); }
.hp .cmp-card:nth-child(5n+1) { --tint: #fdfbc9; --tint-ink: #6c4904; }
.hp .cmp-card:nth-child(5n+2) { --tint: #e3f7fc; --tint-ink: #08414f; }
.hp .cmp-card:nth-child(5n+3) { --tint: #fde8f7; --tint-ink: #9e0f79; }
.hp .cmp-card:nth-child(5n+4) { --tint: #e0fdce; --tint-ink: #10601f; }
.hp .cmp-card:nth-child(5n+5) { --tint: #edeffd; --tint-ink: #1634cc; }
.hp .cmp-tag {
  align-self: flex-start; padding: 3px 10px; border-radius: 4px; background: var(--tint); color: var(--tint-ink);
  font-size: 13.5px; font-weight: 600; line-height: 1.4; letter-spacing: 0;
}
.hp .cmp-card-title {
  margin: 18px 0 0; font-family: var(--hp-serif); font-size: 28px; font-weight: 500; line-height: 1.12;
  letter-spacing: -0.005em; text-wrap: balance; color: var(--hp-ink);
}
.hp .cmp-card-text { margin: 14px 0 0; font-size: 16px; line-height: 1.5; color: var(--hp-text); text-wrap: pretty; }
.hp .cmp-more { display: inline-flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 24px; font-size: 16px; font-weight: 600; color: var(--hp-ink); }
.hp .cmp-more::after { content: "\\2192"; color: var(--hp-blue); transition: transform 0.15s ease; }
.hp .cmp-card:hover .cmp-more::after { transform: translateX(4px); }

/* detail: intro, sections */
.hp .cmp-intro-wrap { padding: 0 24px 80px; }
.hp .cmp-intro {
  max-width: 860px; margin: 0 auto; padding: 32px 40px; border-radius: 16px; background: #fdfbc9;
  font-size: 19px; line-height: 1.55; color: var(--hp-ink); text-wrap: pretty;
}
.hp .cmp-intro p { margin: 0; }
.hp .cmp-wrap { max-width: 1000px; margin: 0 auto; padding: 0 24px; }
.hp .cmp-h2 { font-size: clamp(1.9rem, 3.2vw, 2.5rem); line-height: 1.1; text-align: left; }

/* comparison table */
.hp .cmp-table-wrap {
  margin-top: 28px; overflow-x: auto; overscroll-behavior-x: contain; border: 1px solid var(--hp-line); border-radius: 12px;
  background: #fff; -webkit-overflow-scrolling: touch;
}
.hp .cmp-table-wrap:focus-visible { outline: 2px solid var(--hp-blue); outline-offset: 3px; border-radius: 12px; }
.hp .cmp-table { width: 100%; min-width: 620px; border-collapse: collapse; text-align: left; font-size: 16px; line-height: 1.5; }
.hp .cmp-table th, .hp .cmp-table td { padding: 18px 24px; vertical-align: top; border-bottom: 1px solid var(--hp-line); }
.hp .cmp-table tbody tr:last-child > * { border-bottom: 0; }
.hp .cmp-table thead th { padding-top: 15px; padding-bottom: 15px; background: var(--hp-gray); font-size: 15px; font-weight: 600; color: var(--hp-ink); }
.hp .cmp-table th:first-child { width: 26%; }
.hp .cmp-table th:nth-child(2), .hp .cmp-table th:nth-child(3) { width: 37%; }
.hp .cmp-table tbody th { font-weight: 600; color: var(--hp-ink); }
.hp .cmp-table td { color: var(--hp-text); }
.hp .cmp-table .is-trace { background: #f6f7fe; color: var(--hp-ink); }
.hp .cmp-table thead .is-trace { background: var(--hp-lav); color: var(--hp-blue); }
.hp .cmp-table tbody .is-trace { font-weight: 500; }

/* "what you trade away" / "what you gain" */
.hp .cmp-panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 88px; }
.hp .cmp-panel { padding: 36px 36px 40px; border-radius: 16px; background: var(--tint); }
.hp .cmp-panel:nth-child(4n+1) { --tint: #fde8f7; }
.hp .cmp-panel:nth-child(4n+2) { --tint: #e0fdce; }
.hp .cmp-panel:nth-child(4n+3) { --tint: #e3f7fc; }
.hp .cmp-panel:nth-child(4n+4) { --tint: #fdfbc9; }
.hp .cmp-panel .hp-h3 { font-size: clamp(1.6rem, 2.4vw, 2rem); line-height: 1.12; }
.hp .cmp-panel p { margin: 16px 0 0; font-size: 17px; line-height: 1.55; color: var(--hp-ink); text-wrap: pretty; }

/* call to action */
.hp .cmp-cta { max-width: 720px; margin: 88px auto 0; padding: 0 24px; text-align: center; }
.hp .cmp-cta .hp-h2 { text-align: center; }
.hp .cmp-cta p { margin: 20px auto 0; max-width: 600px; font-size: 18px; line-height: 1.45; color: var(--hp-ink); text-wrap: pretty; }
.hp .cmp-cta .hp-btns { justify-content: center; margin-top: 28px; }

/* faq */
.hp .cmp-faq { padding-top: 96px; }
.hp .cmp-faq-list { margin-top: 28px; border-top: 1px solid var(--hp-line); }
.hp .cmp-faq-item {
  display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 56px; padding: 30px 0;
  border-bottom: 1px solid var(--hp-line);
}
.hp .cmp-faq-item .hp-h3 { font-size: 25px; line-height: 1.18; }
.hp .cmp-faq-item p { margin: 0; font-size: 17px; line-height: 1.6; color: var(--hp-text); text-wrap: pretty; }

/* related */
.hp .cmp-related { padding-top: 96px; }
.hp .cmp-rel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 28px; }
.hp .cmp-rel-card {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px;
  border: 1px solid var(--hp-line); border-radius: 12px; background: #fff; color: var(--hp-ink);
  font-size: 17px; font-weight: 600; line-height: 1.35; text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.2s ease;
}
.hp .cmp-rel-card::after { content: "\\2192"; flex-shrink: 0; color: var(--hp-blue); font-weight: 400; transition: transform 0.15s ease; }
.hp .cmp-rel-card:hover { border-color: var(--hp-ink); box-shadow: 0 8px 24px rgba(10,10,10,0.05); }
.hp .cmp-rel-card:hover::after { transform: translateX(3px); }
.hp .cmp-related .cmp-links { justify-content: flex-start; margin-top: 24px; }

/* loading skeleton */
.hp .cmp-sk { display: block; border-radius: 6px; background: #ececee; animation: cmp-pulse 1.4s ease-in-out infinite; }
.hp .cmp-sk-card { height: 232px; border-radius: 12px; border: 1px solid var(--hp-line); background: #fff; padding: 28px; }
.hp .cmp-sk-card .cmp-sk + .cmp-sk { margin-top: 14px; }
@keyframes cmp-pulse { 50% { opacity: 0.55; } }

@media (max-width: 1000px) {
  .hp .cmp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .hp .cmp-faq-item { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 26px 0; }
}
@media (max-width: 760px) {
  .hp .cmp-hero { padding: 44px 18px 36px; }
  .hp .cmp-hero .hp-hero-p { margin-top: 20px; font-size: 17px; }
  .hp .cmp-links { gap: 10px; margin-top: 24px; }
  .hp .cmp-chip { height: 38px; padding: 0 12px; font-size: 15px; }
  .hp .cmp-leaving { margin-top: 34px; font-size: 24px; }
  .hp .cmp-grid-wrap { padding: 4px 16px 72px; }
  .hp .cmp-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .hp .cmp-card { padding: 24px 22px 22px; }
  .hp .cmp-card-title { font-size: 26px; }
  .hp .cmp-intro-wrap { padding: 0 16px 56px; }
  .hp .cmp-intro { padding: 24px 22px; font-size: 17.5px; border-radius: 14px; }
  .hp .cmp-wrap { padding: 0 16px; }
  .hp .cmp-panels { grid-template-columns: minmax(0, 1fr); gap: 14px; margin-top: 64px; }
  .hp .cmp-panel { padding: 28px 24px 30px; border-radius: 14px; }
  /* Fixed column widths so the Alternative column peeks in at the edge and says "scroll". */
  .hp .cmp-table { min-width: 504px; table-layout: fixed; }
  .hp .cmp-table th, .hp .cmp-table td { padding: 14px 16px; }
  .hp .cmp-table th:first-child { width: 124px; }
  .hp .cmp-table th:nth-child(2), .hp .cmp-table th:nth-child(3) { width: 190px; }
  .hp .cmp-cta { margin-top: 64px; padding: 0 16px; }
  .hp .cmp-cta p { font-size: 17px; }
  .hp .cmp-faq { padding-top: 72px; }
  .hp .cmp-faq-item .hp-h3 { font-size: 23px; }
  .hp .cmp-related { padding-top: 72px; }
  .hp .cmp-rel-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 420px) {
  .hp .cmp-chip { white-space: normal; height: auto; min-height: 40px; padding: 8px 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .hp .cmp-card, .hp .cmp-rel-card, .hp .cmp-more::after, .hp .cmp-rel-card::after { transition: none; }
  .hp .cmp-card:hover { transform: none; }
  .hp .cmp-sk { animation: none; }
}
`;
