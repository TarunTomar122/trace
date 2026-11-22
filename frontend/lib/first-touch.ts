// Where a visitor first came from, kept in their browser so the signup they make later (maybe
// pages later) can say so: a utm_source tag (our bio links /yt /tt /ig), our email's ?from=, a
// reader's ?via= share code, else the referring site. Nothing personal: a channel name and the
// sharer's 8-character code (backend v3/lib/referral.py). Read only in the browser: the cached
// pages never see it.

const KEY = 'trace_first_touch';
export const REF_CODE = /^[a-z2-7]{8}$/;
const CHANNEL = /^[a-z0-9][a-z0-9_.-]{0,39}$/;

export type FirstTouch = { channel?: string; ref?: string };

// Known referrers by host suffix, most specific first.
const HOSTS: [string, string][] = [
  ['mail.google.com', 'gmail'], ['com.google.android.gm', 'gmail'], ['gemini.google.com', 'gemini'], ['news.google.com', 'google-news'], ['google.', 'google'],
  ['bing.com', 'bing'], ['duckduckgo.com', 'duckduckgo'], ['chatgpt.com', 'chatgpt'], ['openai.com', 'chatgpt'],
  ['perplexity.ai', 'perplexity'], ['claude.ai', 'claude'], ['t.co', 'x'], ['x.com', 'x'], ['twitter.com', 'x'],
  ['news.ycombinator.com', 'hackernews'], ['reddit.com', 'reddit'], ['youtube.com', 'youtube'], ['youtu.be', 'youtube'],
  ['tiktok.com', 'tiktok'], ['instagram.com', 'instagram'], ['facebook.com', 'facebook'], ['linkedin.com', 'linkedin'],
  ['lnkd.in', 'linkedin'], ['threads.net', 'threads'], ['threads.com', 'threads'], ['bsky.app', 'bluesky'],
  ['github.com', 'github'], ['producthunt.com', 'producthunt'], ['substack.com', 'substack'],
];

export function channelOf(search: string, referrer: string, ownHost: string): string | null {
  const params = new URLSearchParams(search);
  const tagged = (params.get('utm_source') || params.get('from') || '').trim().toLowerCase();
  if (tagged) return CHANNEL.test(tagged) ? tagged : 'other';
  if (REF_CODE.test(params.get('via') || '')) return 'referral';
  if (!referrer) return 'direct';
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); } catch { return 'other'; }
  if (!host || host === ownHost.replace(/^www\./, '')) return null; // a page of ours: not a first touch
  for (const [suffix, name] of HOSTS) {
    if (suffix.endsWith('.') ? host.startsWith(suffix) || host.includes('.' + suffix) : host === suffix || host.endsWith('.' + suffix)) return name;
  }
  return CHANNEL.test(host) ? host : 'other';
}

function read(): FirstTouch {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return {
      channel: typeof raw.channel === 'string' && CHANNEL.test(raw.channel) ? raw.channel : undefined,
      ref: typeof raw.ref === 'string' && REF_CODE.test(raw.ref) ? raw.ref : undefined,
    };
  } catch {
    return {};
  }
}

/** On a page load: the first channel sticks; a reader's share code is kept until a newer one. */
export function captureFirstTouch(): void {
  try {
    const stored = read();
    const ref = new URLSearchParams(window.location.search).get('via') || '';
    const channel = stored.channel ?? channelOf(window.location.search, document.referrer, window.location.hostname) ?? undefined;
    const next: FirstTouch = { channel, ref: REF_CODE.test(ref) ? ref : stored.ref };
    if (next.channel !== stored.channel || next.ref !== stored.ref) window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows and blocked storage: the signup just goes uncredited.
  }
}

/** What a signup form sends along. */
export function firstTouch(): FirstTouch {
  return typeof window === 'undefined' ? {} : read();
}

/** Server side: the fields a signup record keeps, from an untrusted body. */
export function signupAttribution(body: { channel?: unknown; ref?: unknown } | null | undefined): { channel?: string; referredBy?: string } {
  const out: { channel?: string; referredBy?: string } = {};
  if (typeof body?.channel === 'string' && CHANNEL.test(body.channel)) out.channel = body.channel;
  if (typeof body?.ref === 'string' && REF_CODE.test(body.ref)) out.referredBy = body.ref;
  return out;
}
