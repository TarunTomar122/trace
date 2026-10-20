import LandingHeroSignup from '@/components/feed-v2/LandingHeroSignup';

/** The homepage's lavender subscribe bar, for the /brief pages (signups count as daily_page). */
export default function BriefStrip() {
  return (
    <section className="hp-strip" id="subscribe" aria-label="Subscribe">
      <div className="hp-strip-in">
        <div>
          <p className="hp-strip-title">Subscribe to the Trace Daily Brief</p>
          <p className="hp-strip-sub">
            The most important tech and AI stories of the day, summed up. <em>100% free, unsubscribe anytime.</em>{' '}
            <a href="/terms">Terms</a> &amp; <a href="/privacy-policy">Privacy</a>.
          </p>
        </div>
        <LandingHeroSignup placement="strip" inputId="subscribe-email" source="daily_page" />
      </div>
    </section>
  );
}
