import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, Sparkles, Moon, Filter, Newspaper, Rocket, PenTool,
  Terminal, TrendingUp, BookOpen, FileText, MessageCircle, Podcast, Mail, Clock,
} from 'lucide-react';
import { BRAND } from '../lib/brand';
import { MOCK_EPISODES } from '../lib/mock';
import { AudioPlayer } from '../components/AudioPlayer';
import { Waveform } from '../components/Waveform';
import { Reveal, SectionHeading } from '../components/ui';

const journey = [
  'Tell it who you are',
  'It reads the night shift',
  'It writes it for you',
  'However you start your day',
];

const roleChips = [
  { icon: Terminal, label: 'Engineer' },
  { icon: PenTool, label: 'Designer' },
  { icon: Rocket, label: 'Founder' },
  { icon: TrendingUp, label: 'Investor' },
  { icon: BookOpen, label: 'Learning' },
];

const goalChips = ['Ship my own thing', 'Catch opportunities', 'Get better', 'Stay current'];

const nightSources = [
  { icon: Rocket, label: 'Launches and product drops' },
  { icon: FileText, label: 'Research papers worth reading' },
  { icon: TrendingUp, label: 'Funding rounds and who’s hiring' },
  { icon: MessageCircle, label: 'The threads people are arguing about' },
];

const lenses = [
  {
    icon: Rocket,
    who: 'For a founder',
    title: 'Here’s the platform opening',
    body: 'A $399 robot selling out means the hardware barrier just fell. The money moves next to whoever owns the software on top — the apps, the skills, the marketplace. That’s a company-shaped gap, and it’s wide open this week.',
  },
  {
    icon: PenTool,
    who: 'For a designer',
    title: 'Here’s what it means for your craft',
    body: 'Cheap, capable robots means a wave of physical products that have never had a real interface. Motion, feedback, trust, the first-run moment — that’s suddenly your territory. Worth getting fluent in before everyone else does.',
  },
];

const delivery = [
  { icon: Podcast, title: 'In your podcast app', body: 'Add your private feed to Apple Podcasts, Spotify or Overcast — tomorrow’s episode just appears.' },
  { icon: Mail, title: 'In your inbox', body: 'A short email each morning: the play button, and the three lines that matter, right up top.' },
  { icon: MessageCircle, title: 'On WhatsApp', body: 'Optional. The day’s brief lands as a voice note, right where you already talk.' },
];

export default function HowItWorks() {
  return (
    <div>
      {/* Hero / header */}
      <section className="dawn relative overflow-hidden">
        <div className="container-x pb-16 pt-14 text-center md:pb-20 md:pt-20">
          <Reveal>
            <SectionHeading
              center
              label="How it works"
              title="How Vantage works"
              sub="The same news everyone else is drowning in — read overnight, filtered hard, and rewritten for the person you actually are. Here’s the whole thing, start to finish."
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2">
              {journey.map((j, i) => (
                <span key={j} className="pill-quiet">
                  <span className="font-mono text-accent">0{i + 1}</span> {j}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* The morning problem, briefly */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading
            center
            label="Why this exists"
            title="Ten tabs never actually made you ahead."
            sub="X, Hacker News, five newsletters, three Discords. An hour gone, and you still can’t say which two things mattered for what you’re building. More feeds was never the fix — the fix is someone reading all of it and keeping only the part that moves your world."
          />
        </Reveal>
        <Reveal delay={100}>
          <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {['X', 'Hacker News', 'Newsletters', 'Discords', 'Reddit', 'Podcasts'].map((t) => (
              <span key={t} className="pill-quiet text-muted/70 line-through decoration-line">{t}</span>
            ))}
            <ArrowRight size={16} className="text-muted" />
            <span className="pill"><Sparkles size={13} /> One 5-minute brief</span>
          </div>
        </Reveal>
      </section>

      {/* Step 1 — Tell it who you are */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-x grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <Reveal>
            <SectionHeading
              label="Step 1"
              title="Tell it who you are"
              sub="No long questionnaire. Two questions — what you do, and what you’re chasing — and the brief is already yours. Change either one whenever your focus shifts."
            />
            <p className="mt-5 text-[14.5px] leading-relaxed text-muted">
              That’s the whole setup. Under a minute, and then you never think about it again.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="card shadow-lift">
              <div>
                <p className="text-[13px] font-semibold text-muted">What do you do?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roleChips.map((r, i) => (
                    <span key={r.label} className={i === 2 ? 'pill' : 'pill-quiet'}>
                      <r.icon size={13} /> {r.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <p className="text-[13px] font-semibold text-muted">What are you chasing?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {goalChips.map((g, i) => (
                    <span key={g} className={i === 0 ? 'pill' : 'pill-quiet'}>{g}</span>
                  ))}
                </div>
              </div>
              <p className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-[13px] text-muted">
                <Check size={15} className="shrink-0 text-accent" /> Founder, chasing “Ship my own thing.” Brief tuned.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Step 2 — It reads the night shift */}
      <section className="container-x py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal className="md:order-2">
            <SectionHeading
              label="Step 2"
              title="It reads the night shift"
              sub={`While you sleep, ${BRAND.name} goes through the whole AI and tech firehose — the launches, the papers, the funding, the threads people are actually arguing about — and throws out almost all of it.`}
            />
            <p className="mt-5 text-[14.5px] leading-relaxed text-muted">
              What’s left is the short list of things genuinely worth five of your minutes. No 40-headline skim. No quiet fear you missed the one that mattered.
            </p>
          </Reveal>
          <Reveal delay={120} className="md:order-1">
            <div className="dawn-night relative overflow-hidden rounded-[1.6rem] p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-bg/70">
                  <Moon size={15} /> Overnight, while you sleep
                </span>
                <Waveform bars={7} className="h-4" color="bg-accent" />
              </div>
              <ul className="mt-5 space-y-3">
                {nightSources.map((s) => (
                  <li key={s.label} className="flex items-center gap-3 text-[14px] text-bg/85">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg/10 text-bg">
                      <s.icon size={15} />
                    </span>
                    {s.label}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center justify-between rounded-xl border border-bg/15 bg-bg/5 px-4 py-3">
                <span className="text-[13px] text-bg/60">214 scanned overnight</span>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
                  <Filter size={14} /> 4 kept for you
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Step 3 — It writes it for YOU */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-x py-16 md:py-24">
          <Reveal>
            <SectionHeading
              center
              label="Step 3"
              title="It writes it for you"
              sub={`This is the part nothing else does. Two people open ${BRAND.name} on the same morning and hear two different briefs — because the news isn’t the point. What it means for you is.`}
            />
          </Reveal>

          <Reveal delay={80}>
            <div className="mx-auto mt-12 max-w-xl">
              <div className="card border-accent/25 text-center shadow-lift">
                <span className="pill mx-auto"><Newspaper size={13} /> Same morning</span>
                <p className="h-display mt-3 text-[1.3rem] leading-snug">“A $399 robot sold out in days.”</p>
                <p className="mt-2 text-[13.5px] text-muted">One story. Now watch where it points.</p>
              </div>
              <div className="mx-auto h-8 w-px bg-line" />
            </div>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-2">
            {lenses.map((l, i) => (
              <Reveal key={l.who} delay={i * 120}>
                <div className="card h-full">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-dark">
                      <l.icon size={19} />
                    </span>
                    <span className="pill">{l.who}</span>
                  </div>
                  <h3 className="h-display mt-4 text-[1.15rem] leading-snug">{l.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{l.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Step 4 — However you start your day */}
      <section className="container-x py-16 md:py-24">
        <Reveal>
          <SectionHeading
            center
            label="Step 4"
            title="However you start your day"
            sub="The brief comes to you, wherever you already are. Pick one, pick all three — it’s the same five minutes."
          />
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

      {/* Sounds human, not AI */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-x grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <Reveal>
            <SectionHeading
              label="One more thing"
              title="It sounds human, not AI."
              sub="No flat robot narration. It talks like a sharp friend who read everything and is catching you up — with pauses, a point of view, and the occasional opinion you might argue with."
            />
            <div className="mt-6 flex items-center gap-3 text-sm text-muted">
              <Waveform bars={12} className="h-5" />
              <span>Real voice · real opinions · about 5 minutes</span>
            </div>
            <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
              Don’t take our word for it. Here’s a real brief — press play.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <AudioPlayer episode={MOCK_EPISODES[0]} />
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container-x py-16 md:pb-24">
        <Reveal>
          <div className="dawn-night relative overflow-hidden rounded-[1.8rem] px-6 py-14 text-center sm:px-12">
            <Waveform bars={24} className="mx-auto mb-6 h-8 opacity-90" color="bg-accent" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-bg/15 bg-bg/5 px-3 py-1 text-xs font-medium text-bg/70">
              <Clock size={12} /> Set up once · under a minute
            </span>
            <h2 className="h-display mx-auto mt-5 max-w-2xl text-3xl leading-tight text-bg sm:text-[2.6rem]">
              Tomorrow, wake up already ahead.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-bg/70">
              Answer two questions tonight. Your first brief lands with your coffee.
            </p>
            <Link to="/onboarding" className="btn-primary btn-lg mt-8">
              Start free <ArrowRight size={18} />
            </Link>
            <p className="mt-3 text-xs text-bg/50">First brief on us. No card to start.</p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
