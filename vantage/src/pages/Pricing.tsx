import { Link } from 'react-router-dom';
import { Check, ArrowRight, Star, Sparkles, Podcast } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { Reveal, SectionHeading } from '../components/ui';
import { Waveform } from '../components/Waveform';

const planFeatures = [
  'A new personalized brief every morning',
  'Your private podcast feed',
  'Email delivery each morning',
  'The full searchable archive',
  'Tune the voice, length, topics and pace',
  'Cancel anytime',
];

const freeFeatures = [
  'One sample brief to try',
  'A generic edition — not yet yours',
  'Listen once, right here',
  'No account, no card',
];

const memberFeatures = [
  'A fresh, personalized brief daily',
  'Tuned to your role and goals',
  'Podcast, email — every delivery',
  'The full searchable archive',
];

const faqs = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — one tap in your account, no email and no retention maze. You keep access through the month you’ve paid for, and you’re simply not charged again.',
  },
  {
    q: 'Is it really personalized?',
    a: 'Yes. Your brief is written from your role and what you’re chasing — a founder and a designer get different editions from the same morning’s news. The more you tune it, the sharper it gets.',
  },
  {
    q: 'What if I don’t listen some days?',
    a: 'No guilt, nothing lost. Every brief lands in your private archive, fully searchable, so you can catch up on a commute or skip a quiet week entirely.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'Yes. If Vantage isn’t for you, email us within your first 7 days and we’ll refund you in full — no questions, no hard feelings.',
  },
];

export default function Pricing() {
  return (
    <div>
      {/* Header + main plan */}
      <section className="dawn">
        <div className="container-x pb-16 pt-14 md:pb-24 md:pt-20">
          <Reveal>
            <SectionHeading
              center
              label="Pricing"
              title="One plan. Five dollars. Cancel anytime."
              sub="Everything included for less than a single coffee — a five-minute morning edge that quietly compounds all year."
            />
          </Reveal>

          {/* Main plan card */}
          <Reveal delay={120}>
            <div className="mx-auto mt-12 max-w-lg">
              <div className="card border-accent/25 text-center shadow-lift">
                <span className="pill">
                  <Sparkles size={13} /> Everything included
                </span>
                <p className="h-display mt-4 text-5xl sm:text-6xl">
                  ${BRAND.priceMonthly}
                  <span className="font-sans text-lg font-medium text-muted">/month</span>
                </p>
                <p className="mt-2 text-sm text-muted">One simple price, billed monthly. No tiers, no add-ons.</p>
                <ul className="mx-auto mt-6 max-w-xs space-y-3 text-left text-[14.5px]">
                  {planFeatures.map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <Check size={18} className="mt-0.5 shrink-0 text-accent" /> {t}
                    </li>
                  ))}
                </ul>
                <Link to="/onboarding" className="btn-primary btn-lg mt-7 w-full">
                  Start free <ArrowRight size={18} />
                </Link>
                <p className="mt-3 text-xs text-muted">First brief on us. No card to start.</p>
              </div>

              {/* Social proof */}
              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-muted">
                <span className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={14} className="fill-accent text-accent" />
                  ))}
                  <span className="ml-1 font-medium text-ink">{BRAND.social.rating}</span>
                </span>
                <span className="h-4 w-px bg-line" />
                <span>{BRAND.social.listeners} start their day here</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Free sample vs Membership */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading
            center
            label="Free vs membership"
            title="Try one on us. Keep it for five."
            sub="The free sample shows you the format. Membership makes every morning yours."
          />
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
          <Reveal>
            <div className="card h-full border-line/80 bg-bg">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-muted">Free sample</p>
                <span className="pill-quiet">$0</span>
              </div>
              <p className="h-display mt-3 text-2xl">A taste of the format</p>
              <ul className="mt-5 space-y-3 text-[14.5px] text-ink/80">
                {freeFeatures.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/40" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="card h-full border-accent/30 bg-accent-soft/40">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-accent-dark">Membership</p>
                <span className="pill">${BRAND.priceMonthly}/mo</span>
              </div>
              <p className="h-display mt-3 text-2xl">Your morning, personalized</p>
              <ul className="mt-5 space-y-3 text-[14.5px] text-ink">
                {memberFeatures.map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why $5 */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-x py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <Reveal>
              <SectionHeading center label="Why $5" title="Priced like a habit, not a SaaS." />
            </Reveal>
            <Reveal delay={80}>
              <div className="mt-8 space-y-4 text-center text-[15px] leading-relaxed text-muted">
                <p>
                  We could have built tiers, add-ons and an annual upsell to squeeze out a bigger number. We didn’t.
                  {' '}
                  {BRAND.name} is one small price because it’s meant to be one small daily habit — the coffee you don’t
                  think twice about, not the subscription you keep meaning to cancel.
                </p>
                <p>
                  And five dollars isn’t arbitrary. Reading the night’s news, writing your edition and voicing it fresh
                  every single morning costs real money. Your $5 pays for exactly that — which keeps us independent, and
                  keeps you the customer, never the product. No ads, no selling your data.
                </p>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="card mx-auto mt-8 flex max-w-md items-center gap-4 border-accent/25">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                  <Podcast size={20} />
                </div>
                <p className="text-left text-[14px] leading-relaxed text-muted">
                  Most of your $5 goes straight into generating and voicing your brief each morning. The rest just keeps
                  the lights on — there are no investors to feed.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Billing FAQ */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading center label="Billing" title="The money questions, answered." />
        </Reveal>
        <div className="mx-auto mt-10 max-w-2xl divide-y divide-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold">
                {f.q}
                <span className="text-accent transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container-x pb-8">
        <Reveal>
          <div className="dawn-night relative overflow-hidden rounded-[1.8rem] px-6 py-14 text-center sm:px-12">
            <Waveform bars={24} className="mx-auto mb-6 h-8 opacity-90" color="bg-accent" />
            <h2 className="h-display mx-auto max-w-2xl text-3xl leading-tight text-bg sm:text-[2.6rem]">
              Five dollars a month. Wake up ahead.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-bg/70">
              Start with a brief on us — no card, under a minute to set up. Keep it for less than a coffee.
            </p>
            <Link to="/onboarding" className="btn-primary btn-lg mt-8">
              Start free <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
