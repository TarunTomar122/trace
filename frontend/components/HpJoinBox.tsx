import type { ReactNode } from 'react';
import LandingHeroSignup, { type SignupSource } from '@/components/feed-v2/LandingHeroSignup';
import { faviconUrl } from '@/lib/topic-icons';

// Outlets the pipeline actually reads (backend/v3/config/*_sources.json, Pulse).
const SOURCE_FACES = ['techcrunch.com', 'theverge.com', 'bloomberg.com', 'arstechnica.com', 'news.ycombinator.com'];

/** Five of the outlets Trace reads, as overlapping favicons. */
export function SourceFaces() {
  return (
    <span className="hp-faces" aria-hidden="true">
      {SOURCE_FACES.map((domain) => (
        // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
        <img key={domain} src={faviconUrl(domain)} alt="" width={28} height={28} loading="lazy" />
      ))}
    </span>
  );
}

/**
 * The closing subscribe box (lavender, HOME_CSS hp-join-*) shared by the
 * homepage and the other 1440-style pages. Its id is `join`, so pages without
 * the strip point the header's Subscribe here. `children` sit inside the box under
 * the form (the homepage puts the founder's note there). Needs the `.hp` scope
 * and HOME_CSS on the page.
 */
export default function HpJoinBox({
  heading,
  source,
  children,
}: {
  heading: ReactNode;
  source: SignupSource;
  children?: ReactNode;
}) {
  return (
    <section className="hp-join" id="join" aria-labelledby="join-title">
      <h2 className="hp-h2" id="join-title">{heading}</h2>
      <div className="hp-join-box">
        <div className="hp-join-top">
          <div>
            <p className="hp-join-title">Receive the most important tech &amp; AI stories of the day</p>
            <p className="hp-join-sub">Grouped, summed up and sent every morning.</p>
          </div>
          <div className="hp-join-form">
            <p className="hp-join-proof">
              <SourceFaces />
              <span className="hp-count">100+</span> sources read every morning
            </p>
            <LandingHeroSignup placement="box" source={source} />
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
