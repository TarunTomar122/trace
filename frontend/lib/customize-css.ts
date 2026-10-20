/**
 * /brief/customize, in the homepage's join1440.com language (lib/home-css.ts):
 * a serif title, white tiles that turn lavender with a blue edge when picked,
 * square buttons, and the live preview as the Daily Brief panel (a yellow panel
 * holding the email's header card over a white sheet of stories).
 */
export const CUSTOMIZE_CSS = `
.hp .cz-head { max-width: 760px; margin: 0 auto; padding: 64px 24px 48px; text-align: center; }
.hp .cz-head .hp-h1 { font-size: clamp(2.6rem, 4.6vw, 3.75rem); }
.hp .cz-head p { margin: 20px auto 0; max-width: 600px; font-size: 18px; line-height: 1.45; text-wrap: pretty; }
.hp .cz { max-width: 1200px; margin: 0 auto; padding: 0 24px 96px; }
.hp .cz-grid { display: grid; gap: 48px; }
@media (min-width: 1024px) { .hp .cz-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 64px; } }

/* signed-in: the daily email on/off */
.hp .cz-switch-card {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 36px;
  padding: 16px 20px; border: 1px solid var(--hp-line); border-radius: 6px; background: #fff;
}
.hp .cz-switch-card p { margin: 0; }
.hp .cz-switch-title { font-size: 16.5px; font-weight: 650; }
.hp .cz-switch-sub { margin-top: 2px !important; font-size: 14.5px; color: var(--hp-text); }
.hp .cz-switch {
  position: relative; width: 48px; height: 28px; flex-shrink: 0; border: 0; border-radius: 999px;
  background: #929292; cursor: pointer; transition: background-color 0.15s ease;
}
.hp .cz-switch[aria-checked="true"] { background: var(--hp-blue); }
.hp .cz-switch span {
  position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(10, 10, 10, 0.25); transition: left 0.15s ease;
}
.hp .cz-switch[aria-checked="true"] span { left: 23px; }

/* the three choices */
.hp .cz-set { min-width: 0; margin: 0; padding: 0; border: 0; }
.hp .cz-set + .cz-set { margin-top: 44px; }
.hp .cz-legend { padding: 0; font-family: var(--hp-serif); font-size: 30px; font-weight: 500; line-height: 1.1; }
.hp .cz-hint { margin: 8px 0 0; font-size: 15.5px; line-height: 1.45; color: var(--hp-text); }
.hp .cz-tiles { display: grid; gap: 10px; margin-top: 18px; }
.hp .cz-tiles-topics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.hp .cz-tiles-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
/* Buttons centre their content; tiles in a row read top-down, so stack from the top. */
.hp .cz-tile {
  display: flex; flex-direction: column; justify-content: flex-start; width: 100%; padding: 14px 16px; border: 1px solid #c7c7c7; border-radius: 4px;
  background: #fff; color: var(--hp-ink); font: inherit; text-align: left; cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.hp .cz-tile:hover { border-color: var(--hp-ink); }
.hp .cz-tile[aria-pressed="true"] { background: var(--hp-lav); border-color: var(--hp-blue); box-shadow: inset 0 0 0 1px var(--hp-blue); }
.hp .cz-tile-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.hp .cz-tile-name { display: flex; align-items: center; gap: 9px; font-size: 16.5px; font-weight: 650; }
.hp .cz-tile-name svg { color: var(--hp-blue); flex-shrink: 0; }
.hp .cz-check {
  display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0;
  border: 1px solid #8f8f8f; border-radius: 3px; background: #fff; color: #fff;
}
.hp .cz-tile[aria-pressed="true"] .cz-check { background: var(--hp-blue); border-color: var(--hp-blue); }
.hp .cz-tile-sub { display: block; margin-top: 4px; font-size: 14px; line-height: 1.4; color: var(--hp-text); }
.hp .cz-num { display: block; font-family: var(--hp-serif); font-size: 34px; font-weight: 500; line-height: 1; }
.hp .cz-fmt { display: block; font-size: 16.5px; font-weight: 650; }

.hp .cz-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 40px; }
.hp .cz-actions .hp-btn { border: 0; font-family: inherit; cursor: pointer; }
.hp .cz-actions .hp-btn:disabled { opacity: 0.45; cursor: default; }
.hp .cz-ok, .hp .cz-err { margin: 0; font-size: 15px; font-weight: 600; }
.hp .cz-ok { color: #10601f; }
.hp .cz-err { color: #971111; }
.hp .cz-link { color: var(--hp-ink); font-size: 15.5px; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: #c7c7c7; }
.hp .cz-link:hover { text-decoration-color: var(--hp-ink); }
.hp .cz-alt { margin-top: 44px; padding-top: 28px; border-top: 1px solid var(--hp-line); }
.hp .cz-alt-title { margin: 0; font-size: 17px; font-weight: 650; }
.hp .cz-alt-sub { margin: 4px 0 16px; font-size: 15.5px; line-height: 1.45; color: var(--hp-text); }

/* live preview: the Daily Brief panel */
@media (min-width: 1024px) { .hp .cz-preview { position: sticky; top: 84px; align-self: start; } }
.hp .cz-preview-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-size: 15px; }
.hp .cz-preview-bar p { margin: 0; }
.hp .cz-preview-label { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.hp .cz-preview-label svg { align-self: center; }
.hp .cz-read { color: var(--hp-text); white-space: nowrap; }
.hp .cz-panel { padding: 28px; border-radius: 24px; background: #fdfbc9; }
.hp .cz-paper { margin: -4px 16px 0; overflow: hidden; border-radius: 0 0 6px 6px; background: #fff; box-shadow: 0 1px 3px rgba(10, 10, 10, 0.06); }
.hp .cz-paper-head { padding: 22px 22px 14px; border-bottom: 1px solid var(--hp-line); }
.hp .cz-paper-head p { margin: 0; font-family: var(--hp-serif); font-size: 28px; font-weight: 500; line-height: 1.1; }
.hp .cz-paper-body { padding-bottom: 12px; }
@media (min-width: 1024px) { .hp .cz-paper-body { height: 520px; overflow-y: auto; overscroll-behavior: contain; } }
.hp .cz-kicker { margin: 0; padding: 20px 22px 0; }
.hp .cz-kicker span { padding: 0 5px; background: #ffef5f; font-family: var(--hp-serif); font-size: 20px; font-weight: 500; line-height: 1.3; }
.hp .cz-story { padding: 14px 22px 18px; border-bottom: 1px solid var(--hp-line); }
.hp .cz-section:last-child .cz-story:last-child { border-bottom: 0; }
.hp .cz-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin: 0; font-size: 14px; color: var(--hp-muted); }
.hp .cz-meta a { color: var(--hp-ink); font-weight: 650; text-decoration: none; }
.hp .cz-meta a:hover { text-decoration: underline; }
.hp .cz-favs { display: inline-flex; }
.hp .cz-favs img { width: 18px; height: 18px; border: 2px solid #fff; border-radius: 50%; background: #fff; box-shadow: 0 0 0 1px var(--hp-line); object-fit: contain; }
.hp .cz-favs img + img { margin-left: -7px; }
.hp .cz-title { margin: 8px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: 19.5px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; }
.hp .cz-title a { color: inherit; text-decoration: none; }
.hp .cz-title a:hover { text-decoration: underline; }
.hp .cz-sum { margin: 8px 0 0; font-size: 15px; line-height: 1.55; color: var(--hp-text); }
.hp .cz-sum + .cz-sum { margin-top: 10px; }
.hp .cz-img { display: block; width: 100%; max-height: 300px; margin-top: 12px; border-radius: 6px; object-fit: cover; background: var(--hp-gray); }
.hp .cz-empty { margin: 0; padding: 40px 22px; text-align: center; font-size: 15px; line-height: 1.5; color: var(--hp-text); }
.hp .cz-more {
  display: block; width: calc(100% - 44px); height: 44px; margin: 14px 22px 4px; border: 1px solid #c7c7c7; border-radius: 3px;
  background: #fff; color: var(--hp-ink); font: inherit; font-size: 16px; cursor: pointer;
}
.hp .cz-more:hover { border-color: var(--hp-ink); }
.hp .cz-note { margin: 12px 0 0; font-size: 14px; line-height: 1.45; color: var(--hp-text); }
/* Phones show the first few preview stories; "Show all" reveals the rest. */
@media (max-width: 1023px) { .hp .cz-hide-sm { display: none; } }
@media (min-width: 1024px) { .hp .cz-more { display: none; } }

@media (max-width: 760px) {
  .hp .cz-head { padding: 44px 18px 32px; }
  .hp .cz-head p { font-size: 17px; }
  .hp .cz { padding: 0 16px 72px; }
  .hp .cz-tiles-topics, .hp .cz-tiles-format { grid-template-columns: minmax(0, 1fr); }
  .hp .cz-legend { font-size: 27px; }
  .hp .cz-panel { padding: 14px; border-radius: 18px; }
  .hp .cz-paper { margin: -4px 8px 0; }
  .hp .cz-paper-head, .hp .cz-story { padding-left: 18px; padding-right: 18px; }
  .hp .cz-kicker { padding-left: 18px; padding-right: 18px; }
}
`;
