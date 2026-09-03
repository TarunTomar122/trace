import Link from 'next/link';
import { adminFirestore } from '@/lib/firebase-admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

function thumb(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || url.length < 10) return null;
  if (url.includes('placeholder') || url.includes('default')) return null;
  if (!/^https?:\/\//.test(url)) return null;
  return url;
}

function hostOf(url?: string): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function score(it: any): number {
  return Number(it?.metadata?.trend_score || 0);
}

function dedupeKey(it: Doc): string {
  return (it.url || it.id || '').replace(/[#?].*$/, '').replace(/\/$/, '');
}

export default async function StoryShare({ id }: { id: string }) {

  let story: null | {
    id: string; title: string; body: string; img: string | null;
    source: string; sourceNames: string[]; time: string; url: string;
  } = null;

  try {
    if (adminFirestore) {
      const ref = adminFirestore.collection('v3_user_feeds').doc('_global').collection('daily');
      const snap = await ref.orderBy('__name__', 'desc').limit(2).get();
      outer: for (const doc of snap.docs) {
        const data = doc.data();
        const pool = [...(data.trending || [])];
        const clusters: Doc[] = [];
        for (const topic of data.trending_topics || []) {
          for (const a of topic.articles || []) pool.push(a);
          clusters.push(topic);
        }
        for (const it of pool) {
          if ((it.id || dedupeKey(it)) === id) {
            const sourceNames = [...new Set(
              (clusters.find((c) => (c.articles || []).some((a: Doc) => dedupeKey(a) === dedupeKey(it)))?.articles || [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((a: any) => String(a.source_name || a.source || hostOf(a.url)))
                .filter(Boolean),
            )];
            story = {
              id,
              title: it.title || '',
              body: it.summary?.short_article?.body || it.description || '',
              img: thumb(it.thumbnail),
              source: it.source_name || it.source || hostOf(it.url),
              sourceNames: sourceNames as string[],
              time: timeAgo(it.published_date) || 'today',
              url: it.url || '#',
            };
            break outer;
          }
        }
      }
    }
  } catch {
    story = null;
  }

  return (
    <main className="sh">
      <style>{css}</style>
      <div className="sh-col">
        <div className="sh-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trace.webp" alt="Trace" className="sh-logo" />
          <span className="sh-wordmark">Trace</span>
        </div>

        {!story ? (
          <p className="sh-missing">This story isn&rsquo;t available anymore. Shared stories live for a day.</p>
        ) : (
          <>
            <div className="sh-byline">
              {story.source && <span className="sh-src">{story.source}</span>}
              <span className="sh-dot">·</span>
              <span className="sh-time">{story.time}</span>
            </div>
            <h1 className="sh-title">{story.title}</h1>
            {story.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sh-img" src={story.img} alt="" />
            )}
            {story.body && <p className="sh-body">{story.body}</p>}
            {story.sourceNames.length > 1 && (
              <p className="sh-covered">Covered by: {story.sourceNames.join(', ')}</p>
            )}
            <a className="sh-source-link" href={story.url} target="_blank" rel="noreferrer">
              Read the full story at {story.source} ›
            </a>

            <div className="sh-cta">
              <p className="sh-cta-line">
                This story was shared from <b>Trace</b> — the day&rsquo;s what actually mattered, ranked and summarized for you every morning.
              </p>
              <Link className="sh-cta-btn" href="/feed">
                Get your daily feed — free
              </Link>
              <p className="sh-cta-sub">Pro from $3/mo · 5-min daily brief · by email</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const css = `
.sh {
  --ink: #0f1419; --text-2: #536471; --text-3: #71767b;
  --line: #eff3f4; --hover: #f7f9f9; --blue: #1d9bf0;
  background: #fff; color: var(--ink); min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px; line-height: 20px;
}
.sh-col { max-width: 600px; margin: 0 auto; padding: 20px 16px 64px; }
.sh-brand { display: flex; align-items: center; gap: 10px; padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 22px; }
.sh-logo { height: 28px; width: auto; }
.sh-wordmark { font-size: 19px; font-weight: 800; letter-spacing: -0.03em; }
.sh-byline { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; }
.sh-src { font-size: 13px; font-weight: 700; color: var(--text-2); }
.sh-dot { color: var(--text-3); }
.sh-time { font-size: 13px; color: var(--text-3); }
.sh-title { margin: 0 0 14px; font-size: 28px; font-weight: 800; line-height: 34px; letter-spacing: -0.02em; }
.sh-img { width: 100%; max-height: 460px; object-fit: cover; border-radius: 16px; margin-bottom: 16px; }
.sh-body { margin: 0 0 14px; font-size: 17px; line-height: 27px; color: var(--ink); }
.sh-covered { margin: 0 0 14px; font-size: 13px; color: var(--text-3); }
.sh-source-link { display: inline-block; font-size: 15px; font-weight: 700; color: var(--blue); text-decoration: none; margin-bottom: 26px; }
.sh-source-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.sh-cta { border: 1px solid var(--line); border-radius: 16px; padding: 20px; text-align: center; background: var(--hover); }
.sh-cta-line { margin: 0 0 14px; font-size: 15px; line-height: 22px; color: var(--ink); }
.sh-cta-line b { font-weight: 800; }
.sh-cta-btn {
  display: inline-block; height: 44px; line-height: 44px; padding: 0 24px;
  border-radius: 9999px; background: var(--blue); color: #fff;
  font-size: 15px; font-weight: 700; text-decoration: none;
  transition: background-color 0.2s ease;
}
.sh-cta-btn:hover { background: #1a8cd8; }
.sh-cta-sub { margin: 12px 0 0; font-size: 12.5px; color: var(--text-3); }
.sh-missing { font-size: 16px; color: var(--text-2); }
`;
