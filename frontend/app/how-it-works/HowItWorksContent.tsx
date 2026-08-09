import Link from "next/link";
import {
  Newspaper,
  GitMerge,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

const STEPS = [
  {
    num: 1,
    icon: Newspaper,
    title: "Sources",
    body: "Trace scans 50+ news sites, communities, and platforms, including TechCrunch, Hacker News, Reddit, Product Hunt, GitHub, and Twitter/X, so you don't have to open each one separately.",
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
    body: "Everything lands in one scannable feed. Under 10 minutes, linked to sources, with nothing you don't need. One tab, one brief, and you're caught up for the day.",
  },
];

export default function HowItWorksContent() {
  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="border-t border-border">
        {STEPS.map((step) => (
          <section key={step.num} className="grid gap-5 border-b border-border py-8 sm:grid-cols-[64px_1fr] sm:gap-8 sm:py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-surface text-accent">
              <step.icon size={23} strokeWidth={1.8} />
            </div>

            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="public-kicker">Step {step.num}</span>
                <h2 className="text-[1.625rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.875rem]">
                  {step.title}
                </h2>
              </div>
              <p className="public-body mt-3 max-w-[68ch]">{step.body}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="public-cta mt-12 p-8 text-center sm:p-10">
          <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-foreground">
            Ready to see it in action?
          </h2>
          <p className="public-body mx-auto mt-3 max-w-md">
            The best way to understand Trace is to try it. Read today&apos;s
            brief and see how much you catch in 10 minutes.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85"
          >
            Read today&apos;s brief
          </Link>
      </div>
    </div>
  );
}
