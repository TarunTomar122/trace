/**
 * The blog on top of HOME_CSS (the 1440-style system): index and category
 * pages (serif hero, post cards, category chips), the dynamic article page,
 * the 12 static posts that render through EditorialArticleShell, and the
 * inline email / pitch cards and sticky bar from BlogCTA.
 *
 * Render it after HOME_CSS inside an `.hp` wrapper. Presentation only: the
 * static posts keep their Tailwind classes, so the article rules below
 * out-rank them by scope (unlayered CSS beats Tailwind's layers) and use
 * !important only where a post sets an inline style (the heading font).
 */

// The article body: the static posts' `.prose` block and the dynamic page's `.bl-prose`.
const P = '.hp :is(.editorial-static-article .prose, .bl-prose)';
// Skip anything inside a CTA card (`not-prose`): those carry their own styles.
const NP = ':not(.not-prose *)';
const STATIC = '.hp .editorial-static-article';

export const BLOG_CSS = `
.hp.bl { font-size: 16px; line-height: 1.5; }
/* Pages that end on the grey card band: grey behind the footer's rounded corners too. */
.hp.bl-gray-end { background: var(--hp-gray); }
.hp .bl-title, .hp .bl-card-title, .hp .bl-feat-title, .hp .bl-aux-title, .hp .bl-faq-q,
.hp .bl-mail-title, .hp .bl-cta-title {
  font-family: var(--hp-serif); font-weight: 500; letter-spacing: -0.005em; text-wrap: balance; color: var(--hp-ink);
}

/* ---------- tags and chips ---------- */
.hp .bl-tag {
  display: inline-block; align-self: flex-start; margin: 0; padding: 3px 10px; border-radius: 4px;
  background: var(--hp-lav); color: var(--hp-blue); font-size: 13px; font-weight: 600; line-height: 1.5;
}
.hp .bl-tag[data-cat="comparisons"] { background: #fdfbc9; color: #6c4904; }
.hp .bl-tag[data-cat="guides"] { background: #e3f7fc; color: #08414f; }
.hp .bl-tag[data-cat="ai-tools"] { background: #fde8f7; color: #9e0f79; }
.hp .bl-tag[data-cat="research"] { background: #e0fdce; color: #10601f; }

.hp .bl-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 40px 0 28px; }
.hp .bl-chip {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border: 1px solid var(--hp-line);
  border-radius: 4px; background: #fff; color: var(--hp-text); font-size: 15px; font-weight: 550; text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.hp .bl-chip:hover { border-color: #c7c7c7; color: var(--hp-ink); }
.hp .bl-chip.is-active, .hp .bl-chip.is-active:hover { background: var(--hp-lav); border-color: #cfd5f8; color: var(--hp-blue); }

/* ---------- index and category ---------- */
.hp .bl-hero .bl-tag { display: table; margin: 0 auto 20px; }
.hp .bl-hero .hp-hero-p { margin-top: 24px; }
.hp .bl-hero .hp-btns { justify-content: center; margin-top: 32px; }
.hp .bl-crumb {
  display: flex; width: max-content; max-width: 100%; align-items: center; gap: 6px; margin: 0 auto 28px; color: var(--hp-muted); font-size: 15px;
  font-weight: 550; text-decoration: none;
}
.hp .bl-crumb:hover { color: var(--hp-ink); text-decoration: underline; text-underline-offset: 3px; }

.hp .bl-band { display: flow-root; background: var(--hp-gray); padding-bottom: 96px; }
.hp .bl-wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.hp .bl-wrap > .bl-chips:first-child { margin-top: 0; }

.hp .bl-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
.hp .bl-feat, .hp .bl-card {
  background: #fff; border: 1px solid var(--hp-line); border-radius: 12px; overflow: hidden; color: inherit; text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.25s ease, transform 0.25s ease;
}
.hp .bl-feat:hover, .hp .bl-card:hover { border-color: #c7c7c7; box-shadow: 0 12px 32px rgba(10, 10, 10, 0.07); transform: translateY(-2px); }
.hp .bl-feat:hover .bl-img { transform: scale(1.02); }
.hp .bl-card:hover .bl-img { transform: scale(1.03); }

.hp .bl-feat { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); }
.hp .bl-feat-img { position: relative; min-height: 380px; background: var(--hp-gray); overflow: hidden; }
.hp .bl-feat-body { display: flex; flex-direction: column; justify-content: center; padding: 48px; }
.hp .bl-feat-title { margin: 16px 0 0; font-size: clamp(2rem, 3.2vw, 2.75rem); line-height: 1.08; }
.hp .bl-feat-ex { margin: 16px 0 0; font-size: 18px; line-height: 1.5; color: var(--hp-text); }
.hp .bl-feat .bl-meta { margin-top: 26px; }

.hp .bl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.hp .bl-card { display: flex; flex-direction: column; }
.hp .bl-card-img { position: relative; aspect-ratio: 16 / 10; background: var(--hp-gray); overflow: hidden; }
.hp .bl-card-body { display: flex; flex: 1; flex-direction: column; padding: 22px 24px 22px; }
.hp .bl-card-title { margin: 14px 0 0; font-size: 27px; line-height: 1.1; }
.hp .bl-card-ex { margin: 12px 0 0; flex: 1; font-size: 16px; line-height: 1.5; color: var(--hp-text); }
.hp .bl-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin-top: 20px; color: var(--hp-muted); font-size: 14px; line-height: 1.4; }
.hp .bl-card .bl-meta { padding-top: 16px; border-top: 1px solid var(--hp-line); }
.hp .bl-meta span { display: inline-flex; align-items: center; gap: 5px; }
.hp .bl-meta .bl-read { color: var(--hp-blue); font-weight: 600; }
.hp .bl-meta .bl-read svg { transition: transform 0.15s ease; }
.hp .bl-feat:hover .bl-read svg, .hp .bl-card:hover .bl-read svg { transform: translateX(3px); }
.hp .bl-empty { padding: 56px 0 24px; text-align: center; }
.hp .bl-empty p { margin: 0; font-size: 18px; color: var(--hp-text); }
.hp .bl-empty a { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; color: var(--hp-blue); font-size: 16px; font-weight: 600; text-decoration: none; }
.hp .bl-empty a:hover { text-decoration: underline; text-underline-offset: 3px; }

.hp .bl-end { max-width: 768px; margin: 0 auto; padding: 64px 24px 96px; }
.hp .bl-end .bl-mail { margin: 0; }

/* ---------- article page (dynamic posts) ---------- */
.hp .bl-art { max-width: 732px; margin: 0 auto; padding: 36px 16px 96px; }
.hp .bl-back {
  display: inline-flex; align-items: center; gap: 6px; color: var(--hp-muted); font-size: 15px; font-weight: 550; text-decoration: none;
}
.hp .bl-back:hover { color: var(--hp-ink); text-decoration: underline; text-underline-offset: 3px; }
.hp .bl-art-head { margin-top: 28px; }
.hp .bl-title { margin: 16px 0 0; font-size: clamp(2.3rem, 4.8vw, 3.5rem); line-height: 1.08; }
.hp .bl-deck { margin: 20px 0 0; font-size: 21px; line-height: 1.45; color: var(--hp-text); text-wrap: pretty; }
/* Spaced, not dot-separated: a dot would start the second line when it wraps on phones. */
.hp .bl-byline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; margin-top: 20px; color: var(--hp-muted); font-size: 15px; line-height: 1.4; }
.hp .bl-byline > span { display: inline-flex; align-items: center; gap: 5px; }
.hp .bl-hero-img { position: relative; margin-top: 36px; aspect-ratio: 16 / 9; border-radius: 12px; background: var(--hp-gray); overflow: hidden; }

.hp .bl-toc { margin: 40px 0 8px; padding: 22px 26px 24px; border-radius: 12px; background: var(--hp-gray); }
.hp .bl-toc-title { margin: 0; color: var(--hp-ink); font-size: 16px; font-weight: 600; }
.hp .bl-toc ol { list-style: none; margin: 14px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 28px; }
.hp .bl-toc a { color: var(--hp-text); font-size: 16px; line-height: 1.4; text-decoration: none; }
.hp .bl-toc a:hover { color: var(--hp-blue); text-decoration: underline; text-underline-offset: 3px; }

.hp .bl-prose { margin-top: 40px; }
.hp .bl-toc + .bl-prose { margin-top: 32px; }

.hp .bl-aux { margin-top: 56px; padding-top: 40px; border-top: 1px solid var(--hp-line); }
.hp .bl-aux-title { margin: 0 0 22px; font-size: 30px; line-height: 1.15; }
.hp .bl-sources { display: grid; }
.hp .bl-source {
  display: flex; align-items: flex-start; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--hp-line);
  color: var(--hp-text); font-size: 16px; line-height: 1.45; text-decoration: none; transition: color 0.15s ease;
}
.hp .bl-source:first-child { padding-top: 0; }
.hp .bl-source svg { flex-shrink: 0; margin-top: 3px; color: var(--hp-muted); }
.hp .bl-source:hover { color: var(--hp-blue); }
.hp .bl-source:hover span { text-decoration: underline; text-underline-offset: 3px; }
.hp .bl-source-pub { color: var(--hp-muted); }
.hp .bl-faq { display: grid; gap: 28px; }
.hp .bl-faq-q { margin: 0; font-size: 23px; line-height: 1.2; }
.hp .bl-faq-a { margin: 8px 0 0; font-size: 17px; line-height: 1.6; color: var(--hp-text); }
.hp .bl-related { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.hp .bl-rel {
  display: block; padding: 20px 22px 22px; border: 1px solid var(--hp-line); border-radius: 12px; background: #fff; color: inherit;
  text-decoration: none; transition: border-color 0.15s ease, box-shadow 0.25s ease, transform 0.25s ease;
}
.hp .bl-rel:hover { border-color: #c7c7c7; box-shadow: 0 12px 32px rgba(10, 10, 10, 0.07); transform: translateY(-2px); }
.hp .bl-rel-title { margin: 12px 0 0; font-family: var(--hp-serif); font-size: 23px; font-weight: 500; line-height: 1.15; letter-spacing: -0.005em; color: var(--hp-ink); text-wrap: balance; }
.hp .bl-rel-ex { margin: 10px 0 0; font-size: 15px; line-height: 1.5; color: var(--hp-text); }
.hp .bl-art > .bl-chips { margin: 32px 0 0; }

/* ---------- static posts (EditorialArticleShell) ---------- */
${STATIC} { background: #fff; color: var(--hp-text); }
${STATIC} > div { max-width: 732px; margin: 0 auto; padding: 36px 16px 96px; }
${STATIC} nav[aria-label="Breadcrumb"] { margin: 0 0 20px; }
${STATIC} nav[aria-label="Breadcrumb"] ol { gap: 4px 8px; margin: 0; padding: 0; font-size: 14px; line-height: 1.4; color: var(--hp-muted); }
${STATIC} nav[aria-label="Breadcrumb"] li { margin: 0; padding: 0; color: var(--hp-muted); font-size: 14px; }
${STATIC} nav[aria-label="Breadcrumb"] li[aria-hidden="true"] { color: #c7c7c7; }
${STATIC} nav[aria-label="Breadcrumb"] li[aria-current="page"] { color: var(--hp-ink); font-weight: 500; }
${STATIC} nav[aria-label="Breadcrumb"] a { color: var(--hp-muted); text-decoration: none; }
${STATIC} nav[aria-label="Breadcrumb"] a:hover { color: var(--hp-ink); text-decoration: underline; text-underline-offset: 3px; }
${STATIC} > div > a {
  display: inline-block; margin: 0 0 32px; color: var(--hp-blue); font-size: 15px; font-weight: 550; text-decoration: none;
}
${STATIC} > div > a:hover { color: var(--hp-blue-hover); text-decoration: underline; text-underline-offset: 3px; }
${STATIC} header { margin: 0 0 36px; }
${STATIC} header > span:first-child {
  display: inline-block; padding: 3px 10px; border-radius: 4px; background: var(--hp-lav); color: var(--hp-blue);
  font-size: 13px; font-weight: 600; line-height: 1.5;
}
${STATIC} header h1 {
  margin: 16px 0 0 !important; font-family: var(--hp-serif) !important; font-weight: 500 !important;
  font-size: clamp(2.3rem, 4.8vw, 3.5rem); line-height: 1.08; letter-spacing: -0.005em; color: var(--hp-ink) !important; text-wrap: balance;
}
/* Spaced like .bl-byline, not dot-separated (a dot would start the wrapped line on phones). */
${STATIC} header > div {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; margin: 20px 0 0; color: var(--hp-muted); font-size: 15px; line-height: 1.4;
}
${STATIC} header > div a { color: inherit; text-decoration: none; }
${STATIC} header > div a:hover { color: var(--hp-ink); text-decoration: underline; text-underline-offset: 3px; }
${STATIC} .prose { max-width: none; color: var(--hp-text); font-size: 18px; line-height: 1.65; }

/* ---------- article body (static .prose and dynamic .bl-prose) ---------- */
${P} :is(h2, h3)${NP} {
  font-family: var(--hp-serif) !important; font-weight: 500 !important; letter-spacing: -0.005em; color: var(--hp-ink) !important;
  text-wrap: balance; scroll-margin-top: 84px;
}
${P} h2${NP} { margin: 2.1em 0 0.6em; font-size: clamp(1.8rem, 3.2vw, 2.25rem); line-height: 1.15; }
${P} h3${NP} { margin: 1.8em 0 0.5em; font-size: 1.6rem; line-height: 1.2; }
.hp .bl-prose > section:first-child > h2:first-child { margin-top: 0; }
${P} p${NP} { margin: 0 0 1.15em; font-size: 18px; line-height: 1.65; color: var(--hp-text); text-wrap: pretty; }
${STATIC} .prose > p.text-xl${NP} { margin: 0 0 1.4em; font-size: 21px; line-height: 1.5; color: var(--hp-ink); }
${P} :is(ul, ol)${NP} { margin: 0 0 1.4em; padding-left: 1.5em; list-style-position: outside; }
${P} ul${NP} { list-style-type: disc; }
${P} ol${NP} { list-style-type: decimal; }
${P} li${NP} { margin: 0.45em 0; padding-left: 0.2em; font-size: 18px; line-height: 1.6; color: var(--hp-text); }
${P} li${NP}::marker { color: #9a9a9a; }
${P} strong${NP} { font-weight: 650; color: var(--hp-ink); }
${P} a${NP} {
  color: var(--hp-blue); font-weight: 500; text-decoration: underline; text-decoration-color: rgba(22, 52, 204, 0.3);
  text-underline-offset: 3px; transition: color 0.15s ease, text-decoration-color 0.15s ease;
}
${P} a${NP}:hover { color: var(--hp-blue-hover); text-decoration-color: currentColor; }
${P} hr${NP} { margin: 3em 0; border: 0; border-top: 1px solid var(--hp-line); }
${P} img${NP} { max-width: 100%; height: auto; border-radius: 12px; }
${P} blockquote${NP} {
  margin: 1.8em 0; padding: 0.15em 0 0.15em 1.4em; border: 0; border-left: 4px solid #ffef5f;
  font-family: var(--hp-serif); font-size: 1.5rem; font-style: normal; font-weight: 500; line-height: 1.35; color: var(--hp-ink);
}
${P} blockquote${NP} p { margin: 0; font-size: inherit; line-height: inherit; color: inherit; }
${P} code${NP} { padding: 2px 6px; border-radius: 4px; background: var(--hp-gray); color: var(--hp-ink); font-size: 0.9em; font-weight: 400; }
${P} code${NP}::before, ${P} code${NP}::after { content: none; }
${P} pre${NP} { margin: 1.6em 0; padding: 16px 20px; overflow-x: auto; border: 1px solid var(--hp-line); border-radius: 12px; background: var(--hp-gray); color: var(--hp-ink); font-size: 15px; line-height: 1.6; }
${P} pre${NP} code { padding: 0; background: none; }

/* comparison tables: clean grey-headed table that scrolls sideways inside its own frame */
${P} div.overflow-x-auto${NP} {
  margin: 2em 0; overflow-x: auto; border: 1px solid var(--hp-line); border-radius: 12px; background: #fff; -webkit-overflow-scrolling: touch;
}
${P} table${NP} {
  width: 100%; min-width: 600px; margin: 0; border: 0; border-collapse: separate; border-spacing: 0; font-size: 16px; line-height: 1.45;
}
${P} :is(th, td)${NP} {
  padding: 13px 16px; border: 0; border-bottom: 1px solid var(--hp-line); text-align: left; vertical-align: top; color: var(--hp-text);
}
${P} tbody tr:last-child :is(th, td)${NP} { border-bottom: 0; }
${P} thead tr${NP}, ${P} thead :is(th, td)${NP} { background: var(--hp-gray); }
${P} th${NP} { color: var(--hp-ink); font-size: 14.5px; font-weight: 650; white-space: nowrap; }
${P} tbody td:first-child${NP} { color: var(--hp-ink); font-weight: 600; }

/* "Read Next" box that closes most static posts */
${P} div.bg-gray-50${NP} { margin: 0; padding: 28px 30px 20px; border-radius: 12px; background: var(--hp-gray); }
${P} div.bg-gray-50 h3${NP} { margin: 0 0 12px; font-size: 1.6rem; }
${P} div.bg-gray-50 ul${NP} { margin: 0; padding: 0; list-style: none; }
${P} div.bg-gray-50 li${NP} { margin: 0; padding: 12px 0; border-top: 1px solid var(--hp-line); font-size: 17px; }
${P} div.bg-gray-50 a${NP} { text-decoration: none; }
${P} div.bg-gray-50 a${NP}:hover { text-decoration: underline; }

/* ---------- CTA cards inside posts (BlogCTA) ---------- */
.hp .bl-mail { margin: 40px 0; padding: 30px 32px 28px; border-radius: 16px; background: var(--hp-lav); }
.hp .bl-mail-kicker { margin: 0; color: var(--hp-blue); font-size: 15px; font-weight: 600; line-height: 1.4; }
.hp .bl-mail-title { margin: 8px 0 0; font-size: clamp(1.65rem, 3vw, 2rem); line-height: 1.15; }
.hp .bl-mail .hp-signup { margin-top: 20px; }
.hp .bl-mail-preview { margin-top: 18px; padding: 14px 16px; border-radius: 10px; background: #fff; }
.hp .bl-mail-preview-label { color: var(--hp-muted); font-size: 13px; font-weight: 600; letter-spacing: 0.01em; }
.hp .bl-mail-preview ol { margin: 8px 0 0; padding-left: 20px; }
.hp .bl-mail-preview li { margin: 6px 0 0; padding-left: 2px; color: var(--hp-ink); font-size: 15.5px; line-height: 1.4; }
.hp .bl-mail-preview a { color: var(--hp-ink); font-weight: 600; text-decoration: none; }
.hp .bl-mail-preview a:hover { color: var(--hp-blue); text-decoration: underline; text-underline-offset: 3px; }
.hp .bl-mail .hp-signup-box .hp-input { max-width: none; }
.hp .bl-mail .hp-msg { margin-top: 10px; }
.hp .bl-mail .hp-submit:disabled { opacity: 0.7; cursor: default; }
.hp .bl-mail-done { margin: 20px 0 0; color: #10601f; font-size: 17px; font-weight: 600; line-height: 1.4; outline: none; }
.hp .bl-mail-foot { margin-top: 18px; }
.hp .bl-feedlink {
  display: inline-flex; align-items: center; gap: 5px; color: var(--hp-blue); font-size: 15px; font-weight: 600; text-decoration: none;
}
.hp .bl-feedlink:hover { color: var(--hp-blue-hover); text-decoration: underline; text-underline-offset: 3px; }
.hp .bl-mail-slim { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 18px 24px; }
.hp .bl-mail-slim-title { color: var(--hp-ink); font-size: 17px; font-weight: 600; }

.hp .bl-cta { margin: 40px 0; padding: 30px 32px 32px; border-radius: 16px; background: var(--hp-gray); }
.hp .bl-cta-kicker { display: inline-block; padding: 1px 8px; border-radius: 3px; background: #fdfbc9; color: #6c4904; font-size: 14px; font-weight: 600; line-height: 1.5; }
.hp .bl-cta-title { margin: 14px 0 0; font-size: clamp(1.65rem, 3vw, 2rem); line-height: 1.15; }
.hp .bl-cta-text { margin: 12px 0 0; font-size: 17px; line-height: 1.55; color: var(--hp-text); }
.hp .bl-cta .hp-btns { margin-top: 22px; }

.hp .bl-sticky {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--hp-line); background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(10px);
}
.hp .bl-sticky-in { display: flex; align-items: center; gap: 12px; max-width: 720px; margin: 0 auto; }
.hp .bl-sticky-text { flex: 1; min-width: 0; margin: 0; color: var(--hp-ink); font-size: 15px; font-weight: 550; line-height: 1.3; }
.hp .bl-sticky-btn {
  display: inline-flex; flex-shrink: 0; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border-radius: 4px;
  background: var(--hp-blue); color: #fff; font-size: 15px; font-weight: 600; text-decoration: none; transition: background-color 0.15s ease;
}
.hp .bl-sticky-btn:hover { background: var(--hp-blue-hover); }
.hp .bl-sticky-x {
  display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 40px; height: 40px; border: 0; border-radius: 4px;
  background: transparent; color: var(--hp-muted); cursor: pointer; transition: color 0.15s ease, background-color 0.15s ease;
}
.hp .bl-sticky-x:hover { background: var(--hp-gray); color: var(--hp-ink); }
@media (min-width: 768px) { .hp .bl-sticky { display: none; } }
/* Room under the footer so the bar never covers its last line. */
@media (max-width: 767px) { .hp:has(.bl-sticky) footer { padding-bottom: 104px; } }

/* ---------- tablets ---------- */
@media (max-width: 1000px) {
  .hp .bl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hp .bl-related { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 860px) {
  .hp .bl-feat { grid-template-columns: minmax(0, 1fr); }
  .hp .bl-feat-img { min-height: 0; aspect-ratio: 16 / 10; }
  .hp .bl-feat-body { padding: 32px 28px 30px; }
}

/* ---------- phones ---------- */
@media (max-width: 760px) {
  .hp .bl-wrap { padding: 0 16px; }
  .hp .bl-band { padding-bottom: 64px; }
  .hp .bl-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .hp .bl-chip { min-height: 44px; }
  .hp .bl-chips { margin: 28px 0 22px; }
  .hp .bl-card-body { padding: 20px 20px 20px; }
  .hp .bl-card-title { font-size: 25px; }
  .hp .bl-feat-body { padding: 24px 20px 24px; }
  .hp .bl-end { padding: 48px 16px 72px; }
  .hp .bl-art { padding: 28px 16px 88px; }
  .hp .bl-deck { font-size: 19px; }
  .hp .bl-hero-img { margin-top: 28px; }
  .hp .bl-toc { padding: 20px 20px 22px; }
  .hp .bl-toc ol { grid-template-columns: minmax(0, 1fr); }
  .hp .bl-aux { margin-top: 44px; padding-top: 32px; }
  .hp .bl-aux-title { font-size: 26px; }
  ${STATIC} > div { padding: 28px 16px 88px; }
  ${P} :is(p, li)${NP} { font-size: 17.5px; }
  ${STATIC} .prose > p.text-xl${NP} { font-size: 19.5px; }
  ${P} div.bg-gray-50${NP} { padding: 22px 20px 14px; }
  .hp .bl-mail { padding: 24px 20px 22px; margin: 32px 0; }
  .hp .bl-mail .hp-form { flex-direction: column; gap: 10px; }
  .hp .bl-mail .hp-signup-box .hp-input { flex: none; width: 100%; }
  .hp .bl-mail .hp-submit { width: 100%; }
  .hp .bl-mail-slim { padding: 16px 20px; }
  .hp .bl-cta { padding: 24px 20px 26px; margin: 32px 0; }
}
@media (max-width: 420px) {
  .hp .bl-cta .hp-btns { flex-direction: column; align-items: stretch; }
  .hp .bl-cta .hp-btn { justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .hp .bl-feat, .hp .bl-card, .hp .bl-rel, .hp .bl-img, .hp .bl-read svg { transition: none; }
  .hp .bl-feat:hover, .hp .bl-card:hover, .hp .bl-rel:hover { transform: none; }
  .hp .bl-feat:hover .bl-img, .hp .bl-card:hover .bl-img { transform: none; }
}
`;
