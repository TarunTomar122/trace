/**
 * New-design loading skeleton for /feed: X-light 3-column shimmer
 * (left nav, center posts, right rails) so the loader matches the feed.
 */
export default function FeedSkeleton() {
  return (
    <div className="xsk">
      <style>{css}</style>
      <aside className="xsk-side" aria-hidden>
        <div className="xsk-brand"><span className="sk sk-word" /><span className="sk sk-logo" /></div>
        {[92, 78, 98, 84, 70, 88].map((w) => (
          <div key={w} className="sk sk-nav" style={{ width: w }} />
        ))}
      </aside>
      <main className="xsk-main" aria-hidden>
        <div className="sk sk-head" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="xsk-post">
            <div className="sk sk-meta" />
            <div className="sk sk-title" />
            <div className="sk sk-title short" />
            <div className="sk sk-img" />
          </div>
        ))}
      </main>
      <aside className="xsk-right" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="xsk-rail">
            <div className="sk sk-railhead" />
            <div className="sk sk-row" />
            <div className="sk sk-row" />
            <div className="sk sk-row short" />
          </div>
        ))}
      </aside>
    </div>
  );
}

const css = `
.xsk {
  --line: #e5e5e5;
  background: #fff; min-height: 100vh;
  display: flex; justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.xsk .sk {
  display: block; border-radius: 9999px;
  background: linear-gradient(90deg, #f7f7f8 25%, #ececee 50%, #f7f7f8 75%);
  background-size: 200% 100%;
  animation: xsk-shimmer 1.4s ease-in-out infinite;
}
@keyframes xsk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.xsk-side { width: 275px; flex-shrink: 0; padding: 18px 14px; }
@media (max-width: 1100px) { .xsk-side { display: none; } }
.xsk-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 22px; }
.xsk .sk-logo { width: 30px; height: 30px; border-radius: 8px; }
.xsk .sk-word { width: 76px; height: 20px; }
.xsk .sk-nav { height: 22px; margin: 0 8px 22px; }
.xsk-main { width: 726px; max-width: 100%; border-left: 1px solid var(--line); border-right: 1px solid var(--line); padding: 20px 16px 40px; }
@media (max-width: 687px) { .xsk-main { border-left: none; border-right: none; } }
.xsk .sk-head { width: 130px; height: 26px; margin-bottom: 22px; }
.xsk-post { border-top: 1px solid var(--line); padding: 16px 0 20px; }
.xsk .sk-meta { width: 190px; height: 13px; margin-bottom: 12px; }
.xsk .sk-title { height: 20px; margin-bottom: 8px; }
.xsk .sk-title.short { width: 72%; }
.xsk .sk-img { height: 200px; border-radius: 16px; margin-top: 12px; }
.xsk-right { width: 330px; flex-shrink: 0; padding: 20px 16px; display: flex; flex-direction: column; gap: 20px; }
@media (max-width: 1340px) { .xsk-right { display: none; } }
.xsk-rail { border: 1px solid var(--line); border-radius: 16px; padding: 14px; }
.xsk .sk-railhead { width: 90px; height: 18px; margin-bottom: 12px; }
.xsk .sk-row { height: 14px; margin-bottom: 12px; }
.xsk .sk-row.short { width: 60%; margin-bottom: 0; }
`;
