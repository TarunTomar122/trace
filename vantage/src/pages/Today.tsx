import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Sparkles, ChevronDown, Check, ArrowRight, Podcast } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { MOCK_EPISODES, fmtDate } from '../lib/mock';
import { AudioPlayer } from '../components/AudioPlayer';
import { startCheckout } from '../lib/checkout';
import { BRAND } from '../lib/brand';

const today = MOCK_EPISODES[0];

const highlights = [
  { topic: 'Security', text: '40% of MCP servers are exploitable — the tool layer is the new attack surface, and a founder-shaped gap nobody’s filled.' },
  { topic: 'Big tech', text: 'Apple’s trade-secret suit against OpenAI is really a warning about hiring from frontier labs.' },
  { topic: 'Hardware', text: 'A $399 robot sold out in days. Hardware stopped being the hard part; the software around it is the opening.' },
];

const transcript = `Hey, morning. So 40% of the MCP servers someone checked had exploitable holes — which is less a security headline and more a founder-shaped opening. That tool layer everyone wired their agents into? It’s the soft underbelly now, and the boring, unglamorous fix is exactly the kind of thing that gets bought.

Apple’s going hard at OpenAI in court over a former employee and some trade secrets. Read past the drama: if you’re hiring out of a big lab, clean rooms and provenance just became your problem from day one.

And the fun one — a $399 programmable robot sold ten thousand units in days. Hardware quietly stopped being the hard part. The people who ship the software, the behaviors, the content on top of cheap sensor-rich bots are the ones who’ll actually make the money…`;

export default function Today() {
  const { user, subscribed, subscribe } = useAuth();
  const [showTranscript, setShowTranscript] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">{fmtDate(today.date)}</p>
          <h1 className="h-display mt-1 text-[1.8rem] leading-tight sm:text-4xl">
            {greeting}{user?.name ? `, ${user.name}` : ''}.
          </h1>
        </div>
        <span className="pill shrink-0">
          <Flame size={13} /> 5-day streak
        </span>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {today.topics.map((t) => (
            <span key={t} className="pill-quiet">{t}</span>
          ))}
        </div>
        <h2 className="h-display text-2xl leading-tight">{today.title}</h2>
        <div className="mt-4">
          <AudioPlayer episode={today} />
        </div>
      </div>

      {/* Highlights */}
      <div className="mt-8">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <Sparkles size={17} className="text-accent" /> In this brief
        </h3>
        <div className="mt-3 grid gap-3">
          {highlights.map((h) => (
            <div key={h.topic} className="card flex gap-3.5 p-4">
              <span className="pill h-fit shrink-0">{h.topic}</span>
              <p className="text-[14.5px] leading-relaxed text-ink/85">{h.text}</p>
            </div>
          ))}
        </div>

        <button
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-3 text-sm font-medium text-muted transition hover:text-ink"
          onClick={() => setShowTranscript((v) => !v)}
        >
          {showTranscript ? 'Hide' : 'Read the'} transcript
          <ChevronDown size={16} className={`transition ${showTranscript ? 'rotate-180' : ''}`} />
        </button>
        {showTranscript && (
          <div className="card mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/85">{transcript}</div>
        )}
      </div>

      {/* Membership / delivery */}
      {!subscribed ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-accent/30 bg-accent-soft/40 p-6">
          <h3 className="h-display text-xl">This one’s on us. Want one every morning?</h3>
          <p className="mt-2 max-w-md text-[14.5px] text-muted">
            Membership is ${BRAND.priceMonthly}/month — a fresh brief tuned to you daily, your private podcast feed,
            email delivery, and the full archive.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="btn-primary btn-lg" onClick={() => startCheckout(subscribe)}>
              Start membership — ${BRAND.priceMonthly}/mo <ArrowRight size={18} />
            </button>
            <Link to="/pricing" className="btn-ghost">See what’s included</Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
            <Check size={18} className="text-accent" /> You’re a member. Tomorrow’s brief lands at 7am.
          </p>
          <Link to="/profile" className="btn-secondary">
            <Podcast size={16} /> Delivery settings
          </Link>
        </div>
      )}
    </div>
  );
}
