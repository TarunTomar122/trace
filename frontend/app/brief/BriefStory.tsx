import Link from 'next/link';
import { Star } from 'lucide-react';
import { sourceHost, type DailyStory } from '@/lib/daily-editions';
import { faviconUrl } from '@/lib/topic-icons';

/**
 * One story in the feed's home-card layout (RetentionPanels .ret-sotd):
 * kicker, full-bleed image, heavy title, the whole summary, then the source
 * row. Feed type sizes; phones get slightly wider side padding (20px).
 * Title, image and source open the original article.
 */
export default function BriefStory({
  story,
  kicker = '',
  eager = false,
}: {
  story: DailyStory;
  kicker?: string;
  eager?: boolean;
}) {
  const host = sourceHost(story.url);
  const favs = [host, ...story.sources.filter((domain) => domain !== host && !host.endsWith(`.${domain}`))]
    .filter(Boolean)
    .slice(0, 4);
  const appLink = `/feed?from=brief&story=${encodeURIComponent(story.url)}`;

  return (
    <div className="pt-[18px] pb-[22px] sm:pt-[22px] sm:pb-[26px]">
      {kicker && (
        <p className="mb-3.5 flex items-center gap-1.5 px-5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#f91880] sm:mb-4 sm:px-[18px]">
          <Star size={12} fill="currentColor" aria-hidden="true" />
          {kicker}
        </p>
      )}
      {story.image && (
        <a href={story.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails */}
          <img
            src={story.image}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            className="mb-[18px] block h-[240px] w-full bg-[#f7f9f9] object-cover object-[center_28%] sm:mb-[22px] sm:h-[340px]"
          />
        </a>
      )}
      <div className="px-5 sm:px-[18px]">
        <h2 className="text-[22px] font-extrabold leading-[1.16] tracking-[-0.035em] text-[#0f1419] sm:text-[28px]">
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{story.title}</a>
        </h2>
        {story.summary && (
          <p className="mt-2.5 text-[14.5px] leading-[1.45] text-[#536471] sm:text-[16px]">{story.summary}</p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] font-semibold text-[#536471]">
          {favs.length > 0 && (
            <span className="inline-flex items-center" title={favs.join(', ')} aria-hidden="true">
              {favs.map((domain, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
                <img
                  key={domain}
                  src={faviconUrl(domain)}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  className={`h-4 w-4 rounded-full bg-white shadow-[0_0_0_1px_#eff3f4] ${i ? '-ml-[5px]' : ''}`}
                />
              ))}
            </span>
          )}
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#0f1419] hover:underline">
            {story.source_name || host}
          </a>
          {story.source_count > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <Link href={appLink} className="hover:text-[#1d9bf0] hover:underline">{story.source_count} sources</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
