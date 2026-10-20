import Link from "next/link";
import {
  Newspaper,
  GitMerge,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import HpJoinBox from "@/components/HpJoinBox";
import { HandArrow } from "@/components/feed-v2/home-art";

const IN_SHORT = [
  { title: "Scan", body: "We read over a hundred tech sources every morning." },
  { title: "Group", body: "We fold every outlet’s take on a story into one." },
  { title: "Summarise", body: "We sum each one up in a few lines, sources attached." },
];

const STEPS = [
  {
    num: 1,
    icon: Newspaper,
    title: "Sources",
    body: "Trace scans 100+ news sites, communities, and platforms, including TechCrunch, Hacker News, Reddit, Product Hunt, GitHub, and Twitter/X, so you don't have to open each one separately.",
  },
  {
    num: 2,
    icon: GitMerge,
    title: "Grouping",
    body: "Identical stories across sources get collapsed into one item. No more reading the same OpenAI launch on five different sites. One story, one brief, links to all the original coverage.",
  },
  {
    num: 3,
    icon: Sparkles,
    title: "AI Summaries",
    body: "Each story group gets a short brief, key takeaways, and a timeline, so you get the full picture in seconds. Deep dive links are there if you want more, but you won't need them most days.",
  },
  {
    num: 4,
    icon: TrendingUp,
    title: "Signal Boost",
    body: "Community discussions, hot takes, and trending topics get ranked by engagement and relevance, not clickbait. See what people are actually saying and which takes have substance.",
  },
  {
    num: 5,
    icon: Zap,
    title: "Your Daily Pulse",
    body: "Everything lands in one scannable feed and a morning email. About five minutes, linked to sources, with nothing you don't need. One tab, one brief, and you're caught up for the day.",
  },
];

const FAQS = [
  {
    q: "Where do the stories come from?",
    a: "Trace scans 100+ news sites, communities, and platforms every morning, including TechCrunch, Hacker News, Reddit, Product Hunt, GitHub, and X. Sources are always linked so you can verify anything in one tap.",
  },
  {
    q: "How is this different from an RSS reader?",
    a: "RSS readers show you everything. Trace groups identical stories into one item, writes a short brief with key takeaways, and ranks the day so the top stories cover what matters. You read one page, not fifty feeds.",
  },
  {
    q: "What do I get?",
    a: "Everything is included: every ranked story with its full brief, Pulse discussions and tools, the archive, bookmarks that sync, your personalised ranking, and read-only agent access. Free for everyone, and open source.",
  },
  {
    q: "How does personalisation work?",
    a: "Pick your interests in your profile and your For You feed is ordered around them. They only change the ordering, nothing else. No black box: the same transparent ranking, weighted to your topics.",
  },
  {
    q: "Is there an app or email version?",
    a: "Trace is web-first today at yourtrace.online/feed, with a Chrome extension that puts the ranked feed in every new tab and an Android app. A free daily email brief lands every morning, and you can pick its topics, length (5, 10 or 15 stories) and format at yourtrace.online/brief/customize.",
  },
];

export default function HowItWorksContent() {
  return (
    <>
      <section className="hp-how-wrap" aria-labelledby="in-short-title">
        <div className="hp-how">
          <h2 className="hp-hand" id="in-short-title">In <br />short</h2>
          <HandArrow variant="in" />
          <ol className="hp-how-steps">
            {IN_SHORT.map((step) => (
              <li key={step.title}>
                <h3 className="hp-how-title">{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <HandArrow variant="down" />
        </div>
      </section>

      <section className="hw-section" aria-labelledby="steps-title">
        <div className="hw-head">
          <p className="hw-note" aria-hidden="true">every morning</p>
          <h2 className="hp-h2" id="steps-title">Five steps, from a hundred sources to one page</h2>
          <p>What happens between the first headline and the brief you read.</p>
        </div>
        <ol className="hw-steps">
          {STEPS.map((step) => (
            <li key={step.num} className="hw-step">
              <div className="hw-num" aria-hidden="true">
                <span className="hw-digit">{step.num}</span>
                <span className="hw-icon"><step.icon size={26} strokeWidth={1.8} /></span>
              </div>
              <div className="hw-copy">
                <p className="hp-kicker">Step {step.num}</p>
                <h3 className="hp-h3">{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="hw-cta" aria-labelledby="cta-title">
        <h2 className="hp-h2" id="cta-title">Ready to see it in action?</h2>
        <p>
          The best way to understand Trace is to try it. Read today&apos;s brief and see how much you catch in about five minutes.
        </p>
        <div className="hp-btns">
          <Link href="/brief" className="hp-btn hp-btn-dark">Read today&apos;s brief</Link>
          <Link href="/feed?utm_source=site&utm_medium=how_it_works" className="hp-btn hp-btn-line">Open the feed</Link>
        </div>
      </section>

      <section className="hp-faq" aria-labelledby="faq-title">
        <h2 className="hp-h2" id="faq-title">How Trace works, answered</h2>
        <div className="hp-faq-list">
          {FAQS.map((faq) => (
            <details key={faq.q} className="hp-faq-item">
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <HpJoinBox heading="Get the brief in your inbox every morning" source="how_it_works" />
    </>
  );
}
