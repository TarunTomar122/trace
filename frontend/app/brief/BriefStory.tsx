import Link from 'next/link';
import { sourceHost, type DailyStory } from '@/lib/daily-editions';
import { faviconUrl } from '@/lib/topic-icons';
import { bodyParagraphs } from '@/lib/body-text';

/**
 * One story in an edition, in the homepage's email look (lib/brief-css.ts):
 * a yellow-marked kicker, the image, a Georgia headline, the whole summary,
 * then the source row. Title, image and source open the original article.
 */
export default function BriefStory({
  story,
  kicker = '',
  lead = false,
  eager = false,
}: {
  story: DailyStory;
  kicker?: string;
  /** The story of the day: a brighter mark. */
  lead?: boolean;
  eager?: boolean;
}) {
  const host = sourceHost(story.url);
  const favs = [host, ...story.sources.filter((domain) => domain !== host && !host.endsWith(`.${domain}`))]
    .filter(Boolean)
    .slice(0, 4);
  const appLink = `/feed?from=brief&story=${encodeURIComponent(story.url)}`;

  return (
    <div className="br-story">
      {kicker && (
        <p className={`br-mark${lead ? ' is-lead' : ''}`}><span>{kicker}</span></p>
      )}
      {story.image && (
        <a href={story.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails */}
          <img
            src={story.image}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            className="br-story-img"
          />
        </a>
      )}
      <h2 className="br-story-title br-story-serif">
        <a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}</a>
      </h2>
      {/* Split into short paragraphs and bold key names, like the feed's story view. */}
      {bodyParagraphs(story.summary).map((para, index) => (
        <p key={index} className="br-story-body">
          {para.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
        </p>
      ))}
      <p className="br-source">
        {favs.length > 0 && (
          <span className="br-favs" title={favs.join(', ')} aria-hidden="true">
            {favs.map((domain) => (
              // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
              <img key={domain} src={faviconUrl(domain)} alt="" width={18} height={18} loading="lazy" />
            ))}
          </span>
        )}
        <a href={story.url} target="_blank" rel="noopener noreferrer">{story.source_name || host}</a>
        {story.source_count > 1 && (
          <>
            <span aria-hidden="true">·</span>
            <Link href={appLink} className="br-count">{story.source_count} sources</Link>
          </>
        )}
      </p>
    </div>
  );
}
