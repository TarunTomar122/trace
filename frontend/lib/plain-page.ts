/**
 * A one-message HTML page for API routes that answer a click from an email
 * (unsubscribe, feedback). Plain HTML, no React, in the site's look: the serif
 * wordmark and headline (served from /fonts), quiet body copy, a black button.
 */
export function plainPage({
  title,
  heading,
  body,
  cta,
}: {
  title: string;
  heading: string;
  body: string;
  cta: { href: string; label: string };
}): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
@font-face { font-family: 'Trace Serif'; font-weight: 500; src: url('/fonts/trace-serif-500.woff2') format('woff2'); }
@font-face { font-family: 'Trace Serif'; font-weight: 700; src: url('/fonts/trace-serif-700.woff2') format('woff2'); }
body { margin: 0; background: #fff; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
.wrap { max-width: 540px; margin: 0 auto; padding: 72px 24px; text-align: center; }
.mark { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 36px; color: inherit; text-decoration: none; font-family: 'Trace Serif', Georgia, serif; font-size: 30px; font-weight: 700; line-height: 1; }
.mark img { width: 28px; height: 28px; }
h1 { margin: 0 0 14px; font-family: 'Trace Serif', Georgia, serif; font-size: 40px; font-weight: 500; line-height: 1.08; letter-spacing: -0.005em; }
p { margin: 0 0 30px; font-size: 17px; line-height: 1.5; color: #323232; }
.btn { display: inline-block; padding: 13px 22px; border-radius: 3px; background: #0a0a0a; color: #fff; font-size: 17px; text-decoration: none; }
.btn:hover { background: #323232; }
</style></head>
<body><div class="wrap">
  <a class="mark" href="/">Trace<img src="/trace.png" alt=""></a>
  <h1>${heading}</h1>
  <p>${body}</p>
  <a class="btn" href="${cta.href}">${cta.label}</a>
</div></body></html>`;
}
