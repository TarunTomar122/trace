'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import LandingHeroSignup from '@/components/feed-v2/LandingHeroSignup';
import { isNewsletterSubscribed, onNewsletterSubscribed } from '@/lib/newsletter-local';
import { trackFeedItemClicked, trackSponsoredToolClicked } from '@/lib/posthog';
import { faviconUrl } from '@/lib/topic-icons';

// The edition page's right rail (wide screens): the sponsor card, then the
// subscribe card. Client components only for the click tracking and for
// knowing whether this device already subscribed.

export type RailSponsor = { id: string; title: string; url: string; sub: string };

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The active sponsor, as the feed's sponsor row shows it, in the rail's card style. */
export function RailSponsorCard({ sponsor, editionDate }: { sponsor: RailSponsor; editionDate: string }) {
  const domain = domainOf(sponsor.url);
  return (
    <a
      className="br-sponsor"
      href={sponsor.url}
      target="_blank"
      rel="noreferrer sponsored"
      aria-label={`Sponsored: ${sponsor.title}. Visit website`}
      onClick={() => {
        trackFeedItemClicked(sponsor.id, 'promo', '');
        trackSponsoredToolClicked({
          sponsorId: sponsor.id,
          title: sponsor.title,
          domain,
          placement: 'brief_rail',
          position: 1,
          feedDate: editionDate,
        });
      }}
    >
      <span className="br-sponsor-label">Sponsored</span>
      <span className="br-sponsor-head">
        {domain && (
          // eslint-disable-next-line @next/next/no-img-element -- sponsor favicon
          <img src={faviconUrl(domain)} alt="" width={20} height={20} loading="lazy" />
        )}
        <span className="br-sponsor-title">{sponsor.title}</span>
      </span>
      {sponsor.sub && <span className="br-sponsor-sub">{sponsor.sub}</span>}
      <span className="br-sponsor-visit">Visit website ↗</span>
    </a>
  );
}

/** The compact subscribe card; readers who already subscribed on this device get a pointer to customising. */
export function RailSubscribeCard() {
  // false on the server and until hydration; then this device's answer, live.
  const subscribed = useSyncExternalStore(onNewsletterSubscribed, isNewsletterSubscribed, () => false);
  // A signup from this card keeps the card's own "You're in" message and celebration.
  const [signedUpHere, setSignedUpHere] = useState(false);

  return (
    <div className="br-rail-sub">
      {subscribed && !signedUpHere ? (
        <>
          <p className="br-rail-title">You&rsquo;re subscribed</p>
          <p className="br-rail-line">Pick your topics, how many stories, and how you read them.</p>
          <Link href="/brief/customize" className="br-rail-link">Make it yours →</Link>
        </>
      ) : (
        <>
          <p className="br-rail-title">Get this every morning</p>
          <p className="br-rail-line">The 10 stories that matter in tech and AI, summed up each morning.</p>
          <div onSubmitCapture={() => setSignedUpHere(true)}>
            <LandingHeroSignup placement="box" source="daily_page" />
          </div>
        </>
      )}
    </div>
  );
}
