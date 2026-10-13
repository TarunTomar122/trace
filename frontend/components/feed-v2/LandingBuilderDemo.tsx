'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { selectFromGroups, type PoolStory, type Section } from '@/lib/newsletter-select';
import { STORY_COUNTS, laneKicker, topicLabel, type StoryCount, type StoryFormat } from '@/lib/newsletter-prefs';
import { faviconUrl, topicIcon } from '@/lib/topic-icons';

const PHONE_PREVIEW = 3;
const TOPICS = ['ai', 'markets', 'startups', 'tech', 'ux-design'] as const;
const FORMATS: { id: StoryFormat; label: string }[] = [
  { id: 'summaries', label: 'Summaries' },
  { id: 'headlines', label: 'Headlines' },
  { id: 'images', label: 'Images' },
];

/**
 * The landing's "make it yours" demo, live: controls on the left, today's
 * email on the right, built from the real story pool with the sender's own
 * allocation (the same as /brief/customize).
 */
export default function LandingBuilderDemo({ fallback }: { fallback: { id: string; title: string; why: string }[] }) {
  const [pool, setPool] = useState<PoolStory[] | null>(null);
  const [topics, setTopics] = useState<string[]>(['ai', 'markets', 'startups']);
  const [count, setCount] = useState<StoryCount>(10);
  const [format, setFormat] = useState<StoryFormat>('summaries');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/newsletter/pool')
      .then((res) => res.json())
      .then((data: { pool?: PoolStory[] }) => !cancelled && setPool(data.pool ?? []))
      .catch(() => !cancelled && setPool([]));
    return () => { cancelled = true; };
  }, []);

  const sections: Section[] = useMemo(
    () => (pool?.length ? selectFromGroups(pool, topics, count, 'member') : []),
    [pool, topics, count],
  );
  const total = sections.reduce((sum, [, stories]) => sum + stories.length, 0);
  const customizeHref = `/brief/customize?topics=${topics.join(',')}&count=${count}&format=${format}`;

  function toggle(topic: string) {
    setTopics((current) => (current.includes(topic) ? current.filter((t) => t !== topic) : [...current, topic]));
  }

  return (
    <div className="bd">
      <div className="bd-controls">
        <div>
          <p className="builder-label">Topics</p>
          <div className="chips">
            {TOPICS.map((topic) => (
              <button key={topic} type="button" aria-pressed={topics.includes(topic)} onClick={() => toggle(topic)}
                className={`chip${topics.includes(topic) ? ' on' : ''}`}>
                {(() => { const Icon = topicIcon(topic); return <Icon size={15} strokeWidth={2.2} aria-hidden="true" />; })()}
                {topicLabel(topic)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="builder-label">Stories</p>
          <div className="seg" role="group" aria-label="Stories">
            {STORY_COUNTS.map((n) => (
              <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={count === n ? 'on' : ''}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="builder-label">Format</p>
          <div className="seg" role="group" aria-label="Format">
            {FORMATS.map((f) => (
              <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormat(f.id)} className={format === f.id ? 'on' : ''}>{f.label}</button>
            ))}
          </div>
        </div>
        <Link href={customizeHref} className="btn-primary bd-cta">Save this as my brief</Link>
      </div>

      {/* Fixed height with its own scroll, so changing picks never moves the page. */}
      <div className="bd-email">
        <div className="bd-email-head">
          <p className="bd-brand">Trace</p>
          <p className="bd-headline" aria-live="polite">{total || count} big things today</p>
        </div>
        {/* Phones show the first few stories; the rest is one tap away. */}
        <div className={`bd-email-body${showAll ? '' : ' collapsed'}`}>
          {total === 0 && fallback.map((story) => (
            <article key={story.id} className="bd-story">
              <h3>{story.title}</h3>
              {format !== 'headlines' && story.why && <p>{story.why}</p>}
            </article>
          ))}
          {sections.map(([lane, stories], index) => {
            const first = sections.slice(0, index).reduce((sum, [, group]) => sum + group.length, 0);
            return (
            <section key={`${lane}-${index}`} className={`bd-section${first >= PHONE_PREVIEW ? ' bd-extra' : ''}`}>
              <p className="bd-kicker">★ {laneKicker(lane)}</p>
              {stories.map((story, i) => (
                <article key={story.topic_id} className={`bd-story${first + i >= PHONE_PREVIEW ? ' bd-extra' : ''}`}>
                  <span className="bd-meta">
                    <span className="fav-stack" aria-hidden="true">
                      {(story.sources ?? []).slice(0, 3).map((domain) => (
                        // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
                        <img key={domain} src={faviconUrl(domain, 32)} alt="" width={18} height={18} loading="lazy" />
                      ))}
                    </span>
                    <a href={story.url} target="_blank" rel="noopener noreferrer" className="bd-src">{story.source_name}</a>
                    {story.source_count > 1 ? <span>· {story.source_count} sources</span> : null}
                  </span>
                  <h3><a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}</a></h3>
                  {format !== 'headlines' && story.summary && <p>{story.summary}</p>}
                  {format === 'images' && story.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails
                    <img src={story.image} alt="" loading="lazy" className="bd-img"
                      onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  )}
                </article>
              ))}
            </section>
            );
          })}
          {!showAll && total > PHONE_PREVIEW && (
            <button type="button" className="bd-more" onClick={() => setShowAll(true)}>
              Show all {total} stories
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
