import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl pt-20 pb-14 sm:pt-28 sm:pb-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">Research</p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[3.5rem]">
              The thinking behind<br className="hidden sm:block" />
              a better tech pulse
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-secondary">
              We use research to think through the actual problems Trace is solving: too many sources, too little context,
              AI summaries without grounding, and the messy reality of staying current without drowning in feeds.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {[
                { href: "/daily", label: "Daily archive" },
                { href: "/trending", label: "Trending" },
                { href: "/compare", label: "Compare" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-border/[0.08] px-3.5 py-1.5 text-[12px] font-medium text-secondary/60 transition-all hover:text-foreground hover:border-border/20"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core concepts */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
              <div key={item.title} className="rounded-[16px] border border-border/[0.06] bg-surface/30 p-6">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
                  {item.title}
                </h2>
                <p className="mt-3 text-[14px] leading-[1.7] text-secondary">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {researchPosts.map((post) => (
              <Link
                key={post.title}
                href={`/research/${post.slug}`}
                className="group flex flex-col rounded-[18px] border border-border/[0.06] bg-surface/30 p-6 transition-all hover:bg-surface/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-border/15 sm:p-7"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">
                  {post.tag}
                </p>
                <h2 className="mt-3 text-[1.25rem] font-bold tracking-[-0.02em] leading-snug text-foreground transition-colors group-hover:text-foreground/80 sm:text-[1.4rem]">
                  {post.title}
                </h2>
                <p className="mt-3 flex-1 text-[14px] leading-[1.7] text-secondary">
                  {post.excerpt}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground/60 transition-colors group-hover:text-foreground">
                    Read article
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="text-[11px] text-secondary/30">
                    {post.author} · {post.readTime}
                  </span>
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
