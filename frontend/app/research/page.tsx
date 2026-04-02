import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import ScrollCTABanner from "@/components/ScrollCTABanner";
import { researchPosts } from "./content";

export const metadata: Metadata = {
  title: "Research | Trace",
  description:
    "Research-backed essays on tech pulse, source grouping, AI summaries with context, and building products that help people catch up faster.",
  alternates: {
    canonical: "https://www.yourtrace.online/research"
  },
  openGraph: {
    title: "Research | Trace",
    description:
      "Research-backed essays on tech pulse, source grouping, AI summaries with context, and faster catch-up.",
    url: "https://www.yourtrace.online/research",
    siteName: "Trace",
    type: "website",
    images: [{ url: "https://www.yourtrace.online/opengraph-image", width: 1200, height: 630, alt: "Trace — Research" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Research | Trace",
    description:
      "Research-backed essays on tech pulse, source grouping, AI summaries with context, and faster catch-up.",
    images: ["https://www.yourtrace.online/twitter-image"],
  }
};

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-2 selection:bg-primary/20 selection:text-primary">
      <PublicHeader />
      <section className="relative pt-32 md:pt-36 lg:pt-40 pb-16 md:pb-24 overflow-hidden z-10">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-10 md:mb-14">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
              Research behind a better tech pulse
            </h1>
            <p className="text-secondary text-base md:text-lg max-w-2xl mx-auto">
              We use research to think through the actual problems Trace is solving: too many sources, too little context,
              AI summaries without grounding, and the messy reality of staying current without drowning in feeds.
            </p>
          </div>

          <div className="rounded-3xl border border-border/20 bg-white dark:bg-gray-950 p-6 md:p-7 shadow-sm mb-8 md:mb-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  title: "Tech pulse",
                  body: "Why staying current gets harder when the same story is scattered across too many places.",
                },
                {
                  title: "Source grouping",
                  body: "Why multi-source context beats one-link reading when the story is moving fast.",
                },
                {
                  title: "AI with context",
                  body: "Why summaries help only when they preserve enough depth, comparison, and source grounding.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary/45">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm md:text-[15px] leading-7 text-secondary">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {researchPosts.map((post) => (
              <Link
                key={post.title}
                href={`/research/${post.slug}`}
                className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-7 shadow-sm hover:shadow-md dark:shadow-gray-900/50 transition-shadow block group"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
                  {post.tag}
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-3 group-hover:text-foreground/80 transition-colors">
                  {post.title}
                </h2>
                <p className="text-secondary text-sm md:text-base leading-relaxed mb-4">
                  {post.excerpt}
                </p>
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
                  Read article →
                </div>
                <div className="text-xs text-secondary uppercase tracking-wider">
                  {post.author} · {post.readTime} · {post.date}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <ScrollCTABanner />
    </div>
  );
}
