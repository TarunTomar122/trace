import { Link } from 'react-router-dom';
import {
  ArrowRight, Star, Check, Terminal, PenTool, Rocket, Compass, TrendingUp, BookOpen,
  Podcast, Mail, MessageCircle, Moon, Coffee, Ear, Sparkles, Clock,
} from 'lucide-react';
import { BRAND } from '../lib/brand';
import { MOCK_EPISODES, fmtDate } from '../lib/mock';
import { AudioPlayer } from '../components/AudioPlayer';
import { Waveform } from '../components/Waveform';
import { Reveal, SectionHeading } from '../components/ui';

const today = MOCK_EPISODES[0];

const steps = [
  { icon: Compass, title: 'Tell us who you are', body: 'Two quick questions — what you do, and what you’re chasing. That’s the whole setup.' },
  { icon: Moon, title: 'It reads the night shift', body: 'Every morning it goes through the AI and tech firehose — the papers, launches, threads — so you don’t have to.' },
  { icon: Ear, title: 'You get your brief', body: 'Five minutes, in your ears, pointed at what actually matters for someone building what you’re building.' },
];

const values = [
  { icon: Compass, title: 'Tuned to your goals', body: 'A founder and a designer get different briefs from the same morning. Yours is aimed where you’re headed.' },
  { icon: Sparkles, title: 'Openings, not noise', body: 'It doesn’t just say what happened. It flags the move worth making, the skill worth learning, the gap nobody’s filled yet.' },
  { icon: Coffee, title: 'Sounds like a smart friend', body: 'A real voice with real opinions catching you up — not a robot reading headlines back to you.' },
  { icon: Clock, title: 'Five minutes, done', body: 'The length of a coffee or a short drive. You start the day ahead instead of buried in ten open tabs.' },
];

const roleChips = [
  { icon: Terminal, label: 'Engineer' },
  { icon: PenTool, label: 'Designer' },
  { icon: Rocket, label: 'Founder' },
  { icon: TrendingUp, label: 'Investor' },
  { icon: BookOpen, label: 'Learning' },
];

const delivery = [
  { icon: Podcast, title: 'In your podcast app', body: 'Add your private feed to Apple Podcasts, Spotify or Overcast. Tomorrow’s episode just appears.' },
  { icon: Mail, title: 'In your inbox', body: 'A short email each morning with the play button and the three lines that matter.' },
  { icon: MessageCircle, title: 'On WhatsApp', body: 'Optional. The day’s brief lands as a voice note, right where you already are.' },
];

const faqs = [
  { q: 'Is it actually personalized, or one feed for everyone?', a: 'Personalized. You tell us your role and what you’re after, and the brief is written for that — the same morning’s news, aimed at your goals.' },
  { q: 'Where does the news come from?', a: 'A curated read of the AI and tech firehose every night — launches, papers, funding, threads — filtered down to what’s worth your five minutes.' },
  { q: 'Does it sound like AI?', a: 'It’s a synthetic voice, but tuned to sound like a sharp friend talking, with pauses and real opinions. Play the sample above and judge for yourself.' },
  { q: 'What does $5 get me?', a: 'A new personalized brief every morning, your private podcast feed, email delivery, and the full archive. Cancel anytime.' },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="dawn relative overflow-hidden">
        <div className="container-x grid items-center gap-12 pb-16 pt-14 md:grid-cols-[1.05fr_0.95fr] md:pb-24 md:pt-20">
          <div className="animate-rise">
            <span className="pill-quiet">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Your daily edge in AI & tech
            </span>
            <h1 className="h-display mt-5 text-[2.7rem] leading-[1.02] sm:text-6xl">
              Wake up<br />
              <span className="text-accent">ahead.</span>
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted sm:text-lg">
              A 5-minute audio brief on AI and tech every morning — tuned to what you’re building, and pointed at the
              openings, not the headlines.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/onboarding" className="btn-primary btn-lg">
                Start free <ArrowRight size={18} />
              </Link>
              <a href="#listen" className="btn-secondary btn-lg">
                <Ear size={18} /> Hear today’s brief
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={14} className="fill-accent text-accent" />
                ))}
                <span className="ml-1 font-medium text-ink">{BRAND.social.rating}</span>
              </span>
              <span className="h-4 w-px bg-line" />
              <span>{BRAND.social.listeners} people start their day here</span>
            </div>
          </div>

          {/* Today's brief card */}
          <Reveal delay={120}>
            <div className="relative">
              <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-tr from-accent/10 to-transparent blur-xl" />
              <div className="rounded-[1.6rem] border border-line bg-surface/80 p-3 shadow-lift backdrop-blur">
                <div className="rounded-[1.2rem] bg-bg p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-muted">{fmtDate(today.date)}</span>
                    <span className="pill">{Math.round(today.durationSec / 60)} min</span>
                  </div>
                  <h3 className="h-display mt-2 text-[1.35rem] leading-tight">{today.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {today.topics.map((t) => (
                      <span key={t} className="pill-quiet">{t}</span>
                    ))}
                  </div>
                  <div className="mt-4">
                    <AudioPlayer episode={today} />
                  </div>
                  <p className="mt-4 border-t border-line pt-3 text-[13.5px] leading-relaxed text-muted">
                    “Hey, morning. So 40% of MCP servers someone checked had exploitable holes — which is less a security
                    story and more a founder-shaped opening…”
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Contrast */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading
            center
            label="The problem with mornings"
            title={<>Ten tabs, an hour gone, still behind.</>}
            sub="You don’t need more feeds. You need someone who read all of it and can tell you the three things that matter for you — in the time it takes to make coffee."
          />
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="card h-full border-line/80 bg-bg">
              <p className="text-[13px] font-semibold text-muted">Your morning now</p>
              <ul className="mt-4 space-y-3 text-[15px] text-ink/80">
                {['Open X, HN, five newsletters, three Discords', 'Skim 40 headlines, absorb maybe four', 'Still not sure what actually matters for you', 'Close the laptop already a little behind'].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/40" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="card h-full border-accent/30 bg-accent-soft/40">
              <p className="text-[13px] font-semibold text-accent-dark">Your morning with {BRAND.name}</p>
              <ul className="mt-4 space-y-3 text-[15px] text-ink">
                {['Press play, hands free, five minutes', 'Hear the 3–4 things that actually move your world', 'Each one with the so-what: the opening, the risk, the skill', 'Start the day as the person who already knows'].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-x py-16 md:py-24">
          <Reveal>
            <SectionHeading label="How it works" title="Set it up once. Wake up to it forever." />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="card h-full">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                    <s.icon size={20} />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-mono text-xs text-accent">0{i + 1}</span>
                    <h3 className="text-[17px] font-semibold">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              <span className="text-sm text-muted">Built for</span>
              {roleChips.map((r) => (
                <span key={r.label} className="pill-quiet">
                  <r.icon size={13} /> {r.label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading
            label="Why it’s different"
            title="Not another newsletter you won’t read."
            sub="It’s the difference between knowing what happened and knowing what to do about it."
          />
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={(i % 2) * 90}>
              <div className="card flex h-full gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-bg">
                  <v.icon size={19} />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold">{v.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{v.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Listen */}
      <section id="listen" className="border-y border-line bg-surface/60">
        <div className="container-x grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <Reveal>
            <SectionHeading
              label="Listen"
              title="Here’s a real one."
              sub="This is today’s brief for a founder-leaning builder. Same morning, aimed at opportunity. Press play."
            />
            <div className="mt-6 flex items-center gap-3 text-sm text-muted">
              <Waveform bars={12} className="h-5" />
              <span>Real voice · real opinions · ~2 minutes</span>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <AudioPlayer episode={today} />
          </Reveal>
        </div>
      </section>

      {/* Delivery */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading center label="Delivery" title="However you start your day." />
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {delivery.map((d, i) => (
            <Reveal key={d.title} delay={i * 90}>
              <div className="card h-full text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                  <d.icon size={22} />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold">{d.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{d.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="container-x pb-4">
        <Reveal>
          <div className="mx-auto max-w-lg">
            <div className="card border-accent/25 text-center shadow-lift">
              <span className="pill">Simple pricing</span>
              <p className="h-display mt-4 text-5xl">
                ${BRAND.priceMonthly}
                <span className="font-sans text-lg font-medium text-muted">/month</span>
              </p>
              <p className="mt-2 text-sm text-muted">Less than one coffee. Cancel anytime.</p>
              <ul className="mx-auto mt-6 max-w-xs space-y-3 text-left text-[14.5px]">
                {['A new personalized brief every morning', 'Your private podcast feed + email', 'The full searchable archive', 'Tune the voice, length and topics'].map((t) => (
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
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading center title="Questions, answered." />
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

      {/* Final CTA */}
      <section className="container-x pb-8">
        <Reveal>
          <div className="dawn-night relative overflow-hidden rounded-[1.8rem] px-6 py-14 text-center sm:px-12">
            <Waveform bars={24} className="mx-auto mb-6 h-8 opacity-90" color="bg-accent" />
            <h2 className="h-display mx-auto max-w-2xl text-3xl leading-tight text-bg sm:text-[2.6rem]">
              Tomorrow morning, be the one who already knows.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-bg/70">
              Set it up in under a minute. Your first brief lands with your coffee.
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
