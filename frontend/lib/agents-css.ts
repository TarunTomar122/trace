/**
 * /agents on top of HOME_CSS (the 1440-style homepage system). The setup
 * widgets (AgentConnectGuide, CopyPromptCard, AgentAccessManager) are styled
 * with the site's theme tokens, so this scope re-points those tokens at the
 * 1440 palette instead of restyling the components.
 */
export const AGENTS_CSS = `
.hp.ag {
  /* The content-page shell (PageShell) sets 15px/20px; read like the homepage. */
  font-size: 16px; line-height: 1.5;
  --foreground: #0a0a0a;
  --primary: #0a0a0a;
  --secondary: #555555;
  --border: #e5e5e5;
  --surface: #ffffff;
  --surface-secondary: #f7f7f8;
  --accent: #1634cc;
}
/* 1440's rectangular buttons, including the copy buttons inside the widgets. */
.hp.ag button.rounded-full, .hp.ag a.rounded-full { border-radius: 4px; }

.hp .ag-eyebrow { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 18px; font-size: 16px; font-weight: 600; }
.hp .ag-url { display: flex; justify-content: center; margin-top: 32px; text-align: left; }
.hp .ag-url > div { width: 100%; background: #fff; box-shadow: 0 12px 32px rgba(10,10,10,0.08), 0 1px 3px rgba(10,10,10,0.06); }
.hp .ag-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 22px; margin: 22px 0 0; padding: 0; list-style: none; font-size: 15px; }
.hp .ag-badges li { display: inline-flex; align-items: center; gap: 7px; }
.hp .ag-badges svg { color: var(--hp-blue); }

.hp .ag-section { max-width: 1200px; margin: 0 auto; padding: 96px 24px 0; scroll-margin-top: 72px; }
.hp .ag-head { max-width: 720px; margin: 0 0 28px; }
.hp .ag-head p:not(.hp-kicker) { margin: 14px 0 0; font-size: 17px; line-height: 1.5; color: var(--hp-ink); }
.hp .ag-head code, .hp .ag-text code { font-family: var(--font-geist-mono), ui-monospace, Menlo, monospace; font-size: 0.86em; padding: 1px 5px; border-radius: 4px; background: #f7f7f8; }

.hp .ag-panel { --panel: #e3f7fc; padding: 40px; border-radius: 24px; background: var(--panel); }
.hp .ag-panel-cyan { --panel: #e3f7fc; }
.hp .ag-panel-green { --panel: #e0fdce; }
.hp .ag-panel-gray { --panel: #f7f7f8; }
.hp .ag-panel > * + * { margin-top: 20px; }

.hp .ag-signin { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.hp .ag-signin li { --tint: #fefddd; --ink: #6c4904; padding: 26px 24px 24px; border-radius: 6px; border: 8px solid #fff; background: var(--tint); box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 10px 30px rgba(10,10,10,0.05); }
.hp .ag-signin li:nth-child(1) { transform: rotate(-1deg); }
.hp .ag-signin li:nth-child(2) { --tint: #fde8f7; --ink: #9e0f79; transform: rotate(0.6deg) translateY(6px); }
.hp .ag-signin li:nth-child(3) { --tint: #e0fdce; --ink: #10601f; transform: rotate(-0.4deg); }
.hp .ag-step-num { margin: 0; font-family: var(--hp-serif); font-size: 52px; font-weight: 500; line-height: 1; color: var(--ink); }
.hp .ag-step-title { margin: 10px 0 0; font-size: 18px; font-weight: 650; line-height: 1.3; }
.hp .ag-step-body { margin: 6px 0 0; font-size: 15.5px; line-height: 1.5; color: #323232; }
.hp .ag-mail { display: flex; gap: 14px; margin-top: 28px; padding: 22px 24px; border-radius: 16px; background: var(--hp-lav); }
.hp .ag-mail svg { flex-shrink: 0; margin-top: 2px; color: var(--hp-blue); }
.hp .ag-mail p { margin: 0; font-size: 15.5px; line-height: 1.6; }
.hp .ag-fine { margin: 16px 0 0; font-size: 14px; line-height: 1.55; color: #555; }

.hp .ag-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 72px; align-items: start; }
.hp .ag-lede { margin: 14px 0 0; font-size: 17px; line-height: 1.5; }
.hp .ag-tools { list-style: none; margin: 24px 0 0; padding: 0; border-top: 1px solid var(--hp-line); }
.hp .ag-tools li { padding: 14px 0; border-bottom: 1px solid var(--hp-line); font-size: 15.5px; line-height: 1.5; }
.hp .ag-tools code { display: block; font-family: var(--font-geist-mono), ui-monospace, Menlo, monospace; font-size: 14px; font-weight: 600; color: var(--hp-ink); }
.hp .ag-tools span { color: #555; }
.hp .ag-card { padding: 28px; border-radius: 16px; background: #fff; box-shadow: 0 12px 32px rgba(10,10,10,0.08), 0 1px 3px rgba(10,10,10,0.06); }
.hp .ag-card h3 { margin: 0; font-family: var(--hp-serif); font-size: 32px; font-weight: 500; line-height: 1.08; }
.hp .ag-card > p { margin: 12px 0 0; font-size: 15.5px; line-height: 1.6; color: #323232; }
.hp .ag-card code { font-family: var(--font-geist-mono), ui-monospace, Menlo, monospace; font-size: 0.9em; }
.hp .ag-code { margin: 18px 0 0; overflow: hidden; border-radius: 10px; background: #151923; }
.hp .ag-code pre { margin: 0; padding: 16px 18px; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--font-geist-mono), ui-monospace, Menlo, monospace; font-size: 12px; line-height: 1.7; color: #f2f5f9; }
.hp .ag-link { display: inline-block; margin-top: 14px; color: var(--hp-ink); font-size: 15px; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }

.hp .ag-configs { margin-top: 20px; border: 1px solid #c7c7c7; border-radius: 6px; background: #fff; }
.hp .ag-configs summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 22px; font-size: 17px; font-weight: 600; cursor: pointer; list-style: none; }
.hp .ag-configs summary::-webkit-details-marker { display: none; }
.hp .ag-configs summary::after { content: "+"; font-size: 26px; font-weight: 300; line-height: 1; color: var(--hp-muted); }
.hp .ag-configs[open] summary::after { content: "\\2212"; }
.hp .ag-configs-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; padding: 0 22px 22px; }
.hp .ag-codecard { overflow: hidden; border-radius: 12px; background: #151923; color: #fff; }
.hp .ag-codecard p { display: flex; align-items: center; gap: 8px; margin: 0; padding: 18px 20px 0; font-family: var(--font-geist-mono), ui-monospace, Menlo, monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.55); }
.hp .ag-codecard pre { margin: 0; padding: 14px 20px 20px; overflow-x: auto; white-space: pre-wrap; font-family: var(--font-geist-mono), ui-monospace, Menlo, monospace; font-size: 11.5px; line-height: 1.7; color: #f2f5f9; }
.hp .ag-channels { padding: 22px 24px; border-radius: 12px; background: var(--hp-lav); }
.hp .ag-channels h3 { margin: 0; font-family: var(--hp-serif); font-size: 28px; font-weight: 500; line-height: 1.1; }
.hp .ag-channels p { margin: 10px 0 0; font-size: 15px; line-height: 1.6; }

.hp .ag-access { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px; }
.hp .ag-access h3 { margin: 0; font-size: 17px; font-weight: 650; }
.hp .ag-access ul { list-style: none; margin: 12px 0 0; padding: 0; border-top: 1px solid var(--hp-line); }
.hp .ag-access li { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--hp-line); font-size: 16px; }
.hp .ag-yes { color: #10601f; flex-shrink: 0; }
.hp .ag-no { color: #971111; flex-shrink: 0; }
.hp .ag-text { margin: 28px 0 0; font-size: 15px; color: #555; }
.hp .ag-text a { color: var(--hp-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 960px) {
  .hp .ag-row, .hp .ag-access, .hp .ag-configs-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .hp .ag-signin { grid-template-columns: minmax(0, 1fr); }
  .hp .ag-signin li { transform: none !important; }
}
@media (max-width: 760px) {
  .hp .ag-section { padding: 72px 16px 0; }
  .hp .ag-panel { padding: 18px; border-radius: 18px; }
  .hp .ag-card { padding: 22px 20px; }
  .hp .ag-card h3 { font-size: 28px; }
  .hp .ag-configs summary { padding: 16px 18px; font-size: 16px; }
  .hp .ag-configs-grid { padding: 0 14px 14px; }
}
`;
