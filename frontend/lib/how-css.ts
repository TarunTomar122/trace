/**
 * /how-it-works on top of HOME_CSS (the 1440-style homepage system): the five
 * steps as alternating rows, each with a pastel number card.
 */
export const HOW_CSS = `
/* The content-page shell (PageShell) sets 15px/20px; read like the homepage. */
.hp.hw { font-size: 16px; line-height: 1.5; }

.hp .hw-section { max-width: 1100px; margin: 0 auto; padding: 104px 24px 24px; }
.hp .hw-head { max-width: 720px; margin: 0 auto 24px; text-align: center; }
.hp .hw-head p { margin: 20px 0 0; font-size: 18px; line-height: 1.45; }
.hp .hw-note {
  display: inline-block; margin: 0 0 10px; font-family: var(--hp-hand); font-size: 28px; font-weight: 600;
  line-height: 1; color: #606060; transform: rotate(-5deg);
}

.hp .hw-steps { list-style: none; margin: 0; padding: 0; }
.hp .hw-step {
  display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 72px; align-items: center; padding: 40px 0;
}
.hp .hw-step:nth-child(even) { grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); }
.hp .hw-step:nth-child(even) .hw-num { order: 2; }
.hp .hw-step:nth-child(even) .hw-copy { justify-self: end; }
.hp .hw-num {
  --tint: #fdfbc9; --ink: #6c4904;
  position: relative; display: flex; align-items: center; justify-content: center; height: 270px;
  border-radius: 24px; background: var(--tint); color: var(--ink); overflow: hidden;
}
.hp .hw-step:nth-child(5n+2) .hw-num { --tint: #e3f7fc; --ink: #08414f; }
.hp .hw-step:nth-child(5n+3) .hw-num { --tint: #fde8f7; --ink: #9e0f79; }
.hp .hw-step:nth-child(5n+4) .hw-num { --tint: #e0fdce; --ink: #10601f; }
.hp .hw-step:nth-child(5n+5) .hw-num { --tint: #edeffd; --ink: #1634cc; }
.hp .hw-digit { font-family: var(--hp-serif); font-size: 168px; font-weight: 500; line-height: 1; }
.hp .hw-icon {
  position: absolute; right: 26px; bottom: 26px; display: inline-flex; align-items: center; justify-content: center;
  width: 60px; height: 60px; border-radius: 14px; background: #fff; color: var(--hp-ink);
  box-shadow: 0 8px 24px rgba(10,10,10,0.08), 0 1px 2px rgba(10,10,10,0.06); transform: rotate(-4deg);
}
.hp .hw-step:nth-child(even) .hw-icon { transform: rotate(4deg); }
.hp .hw-copy { max-width: 560px; }
.hp .hw-copy p:not(.hp-kicker) { margin: 16px 0 0; font-size: 17px; line-height: 1.55; color: var(--hp-ink); }

.hp .hw-cta { max-width: 760px; margin: 0 auto; padding: 88px 24px 16px; text-align: center; }
.hp .hw-cta p { margin: 20px auto 0; max-width: 560px; font-size: 18px; line-height: 1.45; }
.hp .hw-cta .hp-btns { justify-content: center; margin-top: 28px; }

@media (max-width: 900px) {
  .hp .hw-step { grid-template-columns: minmax(0, 1fr); gap: 24px; padding: 28px 0; }
  .hp .hw-step:nth-child(even) { grid-template-columns: minmax(0, 1fr); }
  .hp .hw-step:nth-child(even) .hw-num { order: 0; }
  .hp .hw-step:nth-child(even) .hw-copy { justify-self: stretch; }
  .hp .hw-num { height: 200px; }
  .hp .hw-digit { font-size: 128px; }
  .hp .hw-copy { max-width: none; }
}
@media (max-width: 760px) {
  .hp .hw-section { padding: 72px 16px 8px; }
  .hp .hw-head p { font-size: 17px; }
  .hp .hw-num { height: 168px; border-radius: 18px; }
  .hp .hw-digit { font-size: 108px; }
  .hp .hw-icon { right: 18px; bottom: 18px; width: 50px; height: 50px; }
  .hp .hw-cta { padding: 64px 16px 8px; }
  .hp .hw-cta p { font-size: 17px; }
}
`;
