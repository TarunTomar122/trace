import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "How to Stay Updated on Tech Without Doomscrolling",
  description:
    "The average developer spends 2+ hours daily on news apps. Here's how to cut that to 30 minutes and still know everything that matters.",
  keywords: [
    "stay updated tech",
    "developer productivity",
    "news consumption habits",
    "avoid doomscrolling",
    "tech news efficiency",
    "information overload",
  ],
  openGraph: {
    type: "article",
    title: "How to Stay Updated on Tech Without Doomscrolling",
    description:
      "Cut your news consumption from 2 hours to 30 minutes without missing anything important.",
    url: "https://www.yourtrace.online/blog/how-to-stay-updated-on-tech-without-doomscrolling",
  },
};

export default function BlogPost() {
  return (
    <article className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link
          href="/blog"
          className="text-blue-600 dark:text-blue-400 hover:underline mb-8 inline-block"
        >
          ← Back to Blog
        </Link>

        <div className="mb-8">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Productivity
          </span>
          <h1
            className={`text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-4 ${spaceGrotesk.variable}`}
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            How to Stay Updated on Tech Without Doomscrolling
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-500">
            <span>May 2, 2026</span>
            <span>4 min read</span>
          </div>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            You open Twitter "for 5 minutes" and suddenly it's been an hour.
            Sound familiar? The average developer spends 2+ hours daily on news
            apps. Here's how to cut that to 30 minutes.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Problem
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            News apps are designed to keep you scrolling. They use infinite
            scroll, clickbait headlines, and algorithmic feeds to maximize
            engagement. The result? You spend hours scrolling and still don't
            know what actually happened.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The 30-Minute Rule
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Set a hard limit: 30 minutes per day for news. Here's how to make
            it work:
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            1. Use AI Summaries
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Instead of reading 10 articles, read 10 summaries. Apps like Trace
            aggregate news from 100+ sources and create 30-second AI summaries.
            You get the gist without the fluff.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            2. Set Specific Times
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Check news at 9 AM and 5 PM. No checking in between. This prevents
            the "I'll just check one more thing" spiral.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            3. Curate Your Sources
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Follow 5-10 high-quality sources instead of 50 mediocre ones. Quality
            beats quantity every time.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            4. Use Streak Trackers
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Build a reading habit with streak trackers. The goal isn't to read
            everything—it's to read the right things consistently.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            5. Set a Timer
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Literally set a 30-minute timer. When it goes off, close the app.
            No exceptions.
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Tools That Help
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            We built Trace specifically for this problem. It gets you informed
            in 30 seconds, not 30 minutes. No infinite scroll, no clickbait,
            no algorithmic rabbit holes.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            <a href="https://play.google.com/store/apps/details?id=online.yourtrace.app" className="text-blue-600 dark:text-blue-400 hover:underline">
              Try Trace free on Android →
            </a>
          </p>

          <h2 className={`text-2xl font-bold text-gray-900 dark:text-white ${spaceGrotesk.variable}`} style={{ fontFamily: "var(--font-space-grotesk)" }}>
            The Bottom Line
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Staying informed doesn't have to mean doomscrolling. Set limits,
            use AI summaries, curate your sources, and build a reading habit.
            Your time is worth more than infinite scroll.
          </p>
        </div>
      </div>
    </article>
  );
}
