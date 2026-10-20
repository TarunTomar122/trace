/**
 * /brief (archive) and /brief/[date] (one edition), on top of HOME_CSS (`.hp`):
 * the homepage's serif headings, lavender strip and boxes, and yellow marks.
 * Story titles use Georgia, like the homepage's email preview.
 */
export const BRIEF_CSS = `
.hp .br-wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.hp .br-story-serif { font-family: Georgia, "Times New Roman", serif; font-weight: 700; letter-spacing: -0.01em; }

/* archive hero */
.hp .br-hero { max-width: 820px; margin: 0 auto; padding: 64px 24px 56px; text-align: center; }
.hp .br-hero p { margin: 24px auto 0; max-width: 600px; font-size: 18px; line-height: 1.45; text-wrap: pretty; }
.hp .br-link { color: var(--hp-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
.hp .br-link:hover { text-decoration-thickness: 2px; }
.hp .br-empty { margin: 0 auto; padding: 0 24px 96px; max-width: 600px; text-align: center; font-size: 17px; color: var(--hp-text); }

/* latest edition: copy beside a yellow panel, like the homepage's Daily Brief row */
.hp .br-latest { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 80px; align-items: center; padding: 8px 0 80px; }
.hp .br-latest .hp-h3 a { color: inherit; text-decoration: none; }
.hp .br-latest .hp-h3 a:hover { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 6px; }
.hp .br-date { margin: 12px 0 0; font-size: 16px; color: var(--hp-text); }
.hp .br-list { list-style: none; margin: 24px 0 0; padding: 0; counter-reset: br; border-top: 1px solid var(--hp-line); }
.hp .br-list li {
  display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; padding: 14px 0;
  border-bottom: 1px solid var(--hp-line); counter-increment: br; font-size: 17px; line-height: 1.35; font-weight: 550;
}
.hp .br-list li::before { content: counter(br); font-family: var(--hp-serif); font-size: 24px; line-height: 1; color: var(--hp-muted); }
.hp .br-list a { color: inherit; text-decoration: none; }
.hp .br-list a:hover { text-decoration: underline; text-underline-offset: 3px; }
.hp .br-panel-link { display: block; color: inherit; text-decoration: none; }
.hp .br-panel-img { display: block; width: 100%; height: 190px; margin: 0 0 16px; object-fit: cover; object-position: center 28%; border-radius: 4px; background: #f4f4f4; }

/* past editions */
.hp .br-past { max-width: 880px; margin: 0 auto; padding: 8px 24px 32px; }
.hp .br-past .hp-h2 { margin-bottom: 24px; font-size: clamp(2rem, 3.4vw, 2.75rem); }
.hp .br-past-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--hp-line); }
.hp .br-past-list li { border-bottom: 1px solid var(--hp-line); }
.hp .br-past-link { display: grid; grid-template-columns: minmax(0, 1fr) 148px; gap: 28px; align-items: center; padding: 22px 0; color: inherit; text-decoration: none; }
.hp .br-past-link.no-img { grid-template-columns: minmax(0, 1fr); }
.hp .br-past-date { margin: 0; font-size: 14px; font-weight: 600; color: var(--hp-text); }
.hp .br-past-title { margin: 6px 0 0; font-size: 21px; line-height: 1.28; }
.hp .br-past-link:hover .br-past-title { text-decoration: underline; text-underline-offset: 3px; }
.hp .br-past-more { margin: 6px 0 0; font-size: 15px; color: var(--hp-text); }
.hp .br-past-img { width: 148px; height: 96px; object-fit: cover; border-radius: 4px; background: #f4f4f4; }

/* one edition */
.hp .br-edition { max-width: 760px; margin: 0 auto; padding: 56px 24px 0; }
.hp .br-edition .hp-h1 { margin: 0; max-width: none; font-size: clamp(2.6rem, 5.2vw, 4rem); }
.hp .br-meta { margin: 14px 0 0; font-size: 16px; color: var(--hp-text); }
.hp .br-meta a { color: var(--hp-ink); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #c7c7c7; }
.hp .br-meta a:hover { text-decoration-color: var(--hp-ink); }
.hp .br-share { margin-top: 24px; }
.hp .br-stories { list-style: none; margin: 40px 0 0; padding: 0; border-top: 1px solid var(--hp-line); }
.hp .br-stories > li { border-bottom: 1px solid var(--hp-line); }
.hp .br-story { padding: 32px 0 34px; }
.hp .br-mark { margin: 0 0 18px; font-family: var(--hp-serif); font-weight: 500; font-size: 22px; line-height: 1.2; }
.hp .br-mark span { padding: 0 5px; background: #fdfbc9; }
.hp .br-mark.is-lead span { background: #ffef5f; }
.hp .br-story-img { display: block; width: 100%; height: 360px; margin: 0 0 22px; object-fit: cover; object-position: center 28%; border-radius: 6px; background: #f4f4f4; }
.hp .br-story-title { margin: 0; font-size: 27px; line-height: 1.22; }
.hp .br-story-title a { color: inherit; text-decoration: none; }
.hp .br-story-title a:hover { text-decoration: underline; text-underline-offset: 4px; }
.hp .br-story-body { margin: 12px 0 0; font-size: 17px; line-height: 1.6; color: var(--hp-text); }
.hp .br-story-body + .br-story-body { margin-top: 14px; }
.hp .br-story-body strong { font-weight: 650; color: var(--hp-ink); }
.hp .br-source { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 16px 0 0; font-size: 14.5px; font-weight: 600; color: var(--hp-text); }
.hp .br-source a { color: inherit; text-decoration: none; }
.hp .br-source a:hover { color: var(--hp-ink); text-decoration: underline; text-underline-offset: 3px; }
.hp .br-source .br-count { color: var(--hp-blue); }
.hp .br-favs { display: inline-flex; align-items: center; }
.hp .br-favs img { width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--hp-line); object-fit: contain; }
.hp .br-favs img + img { margin-left: -7px; }

/* contents: sticky column left of the reading column (desktop), dropdown below */
.hp .br-stories > li { scroll-margin-top: 12px; } /* plus HOME_CSS's 72px scroll-padding for the header */
@media (prefers-reduced-motion: no-preference) { :root:has(.br-toc) { scroll-behavior: smooth; } }
.hp .br-layout { display: block; }
.hp .br-toc-col { display: none; }
.hp .br-toc { position: sticky; top: 84px; display: flex; flex-direction: column; max-height: calc(100vh - 108px); }
.hp .br-toc-title { margin: 0 0 12px; font-family: var(--hp-serif); font-weight: 500; font-size: 23px; line-height: 1.1; }
.hp .br-toc-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; border-top: 1px solid var(--hp-line); }
.hp .br-toc-group { padding: 10px 0 8px; border-bottom: 1px solid var(--hp-line); }
.hp .br-toc-label { margin: 0 0 4px; font-size: 13px; font-weight: 650; color: var(--hp-text); }
.hp .br-toc-group ol, .hp .br-jump ol { list-style: none; margin: 0; padding: 0; }
.hp .br-toc-link {
  display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 4px; padding: 6px 8px 6px 8px;
  border-left: 2px solid transparent; border-radius: 0 4px 4px 0;
  color: var(--hp-text); font-size: 14.5px; line-height: 1.35; text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.hp .br-toc-link:hover { background: var(--hp-gray); color: var(--hp-ink); }
.hp .br-toc-link[aria-current="true"] { background: var(--hp-lav); border-left-color: var(--hp-blue); color: var(--hp-blue); }
.hp .br-toc-n { font-variant-numeric: tabular-nums; color: var(--hp-muted); }
.hp .br-toc-link[aria-current="true"] .br-toc-n { color: inherit; }
.hp .br-toc-t { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hp .br-jump { margin-top: 16px; border: 1px solid #c7c7c7; border-radius: 3px; background: #fff; }
.hp .br-jump summary {
  display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 14px;
  font-size: 16px; cursor: pointer; list-style: none;
}
.hp .br-jump summary::-webkit-details-marker { display: none; }
.hp .br-jump summary::after { content: "+"; font-size: 22px; font-weight: 300; line-height: 1; color: var(--hp-muted); }
.hp .br-jump[open] summary::after { content: "\\2212"; }
.hp .br-jump > ol { max-height: 60vh; overflow-y: auto; padding: 4px 0 8px; border-top: 1px solid var(--hp-line); }
.hp .br-jump-label { margin: 0; padding: 10px 14px 2px; font-size: 13px; font-weight: 650; color: var(--hp-text); }
.hp .br-jump a { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 4px; padding: 8px 14px; font-size: 15px; line-height: 1.35; color: var(--hp-ink); text-decoration: none; }
.hp .br-jump a:hover { background: var(--hp-gray); }
@media (min-width: 1100px) {
  /* The reading column stays 760px and centred; the contents fill the space on its left. */
  .hp .br-layout { display: grid; grid-template-columns: minmax(236px, 1fr) minmax(0, 760px) minmax(0, 1fr); align-items: stretch; }
  .hp .br-layout > .br-edition { grid-column: 2; margin: 0; max-width: none; }
  .hp .br-toc-col { display: block; grid-column: 1; grid-row: 1; justify-self: end; width: min(280px, 100%); padding: 64px 32px 0 16px; }
  .hp .br-jump { display: none; }
}

/* right rail (sponsor, then subscribe card): sticky on wide screens, level with the contents column */
.hp .br-rail-col { display: none; }
.hp .br-rail { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 16px; }
.hp .br-rail-sub { padding: 18px; border-radius: 12px; background: var(--hp-lav); }
.hp .br-sponsor {
  display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid var(--hp-line); border-radius: 12px;
  background: #fff; color: var(--hp-ink); text-decoration: none; transition: border-color 0.15s ease;
}
.hp .br-sponsor:hover { border-color: #c7c7c7; }
.hp .br-sponsor-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--hp-muted); }
.hp .br-sponsor-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.hp .br-sponsor-head img { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; }
.hp .br-sponsor-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; font-weight: 600; }
.hp .br-sponsor-sub { font-size: 13px; line-height: 1.4; color: var(--hp-text); }
.hp .br-sponsor-visit { margin-top: 2px; font-size: 14px; font-weight: 600; color: var(--hp-blue); }
.hp .br-sponsor:hover .br-sponsor-visit { text-decoration: underline; text-underline-offset: 3px; }
.hp .br-rail-title { margin: 0; font-family: var(--hp-serif); font-weight: 500; font-size: 25px; line-height: 1.08; }
.hp .br-rail-line { margin: 8px 0 14px; font-size: 14.5px; line-height: 1.45; }
.hp .br-rail .hp-form { flex-direction: column; gap: 8px; }
.hp .br-rail .hp-signup-box .hp-input { width: 100%; flex: none; height: 42px; font-size: 16px; }
.hp .br-rail .hp-signup-box .hp-submit { width: 100%; height: 42px; font-size: 16px; }
.hp .br-rail .hp-fine { font-size: 12.5px; }
.hp .br-rail-link { display: inline-block; font-size: 15px; font-weight: 600; color: var(--hp-blue); text-decoration: none; }
.hp .br-rail-link:hover { text-decoration: underline; text-underline-offset: 3px; }
@media (min-width: 1280px) {
  /* Left rail + 760px reading column + this card fit without squeezing the column. */
  .hp .br-rail-col { display: block; grid-column: 3; grid-row: 1; justify-self: start; width: min(280px, 100%); padding: 64px 20px 0 28px; }
}

/* closing subscribe box + other editions */
.hp .br-join { max-width: 1200px; margin: 0 auto; padding: 64px 24px 0; }
.hp .br-join .hp-join-box { padding: 2px; }
.hp .br-join-more { margin: 14px 0 0; font-size: 15px; line-height: 1.45; }
.hp .br-join-more a { color: var(--hp-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.hp .br-nav { max-width: 760px; margin: 0 auto; padding: 40px 24px 96px; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; }
.hp .br-nav > :first-child { justify-self: start; }
.hp .br-nav > :last-child { justify-self: end; }
.hp .br-nav .hp-btn { height: 42px; padding: 0 16px; font-size: 16px; }

@media (max-width: 960px) {
  .hp .br-latest { grid-template-columns: minmax(0, 1fr); gap: 32px; }
}
@media (max-width: 760px) {
  .hp .br-wrap { padding: 0 16px; }
  .hp .br-hero { padding: 44px 18px 36px; }
  .hp .br-hero p { margin-top: 18px; font-size: 17px; }
  .hp .br-latest { padding-bottom: 56px; }
  .hp .br-panel-img { height: 150px; }
  .hp .br-past { padding: 0 16px 16px; }
  .hp .br-past-link { grid-template-columns: minmax(0, 1fr) 96px; gap: 16px; padding: 18px 0; }
  .hp .br-past-title { font-size: 18px; }
  .hp .br-past-img { width: 96px; height: 68px; }
  .hp .br-edition { padding: 40px 16px 0; }
  .hp .br-story { padding: 26px 0 28px; }
  .hp .br-mark { font-size: 20px; margin-bottom: 14px; }
  .hp .br-story-img { height: 220px; margin-bottom: 18px; }
  .hp .br-story-title { font-size: 22px; }
  .hp .br-story-body { font-size: 16px; }
  .hp .br-join { padding: 48px 16px 0; }
  .hp .br-nav { padding: 32px 16px 72px; }
  .hp .br-nav .hp-btn { padding: 0 12px; font-size: 15px; }
}
`;
