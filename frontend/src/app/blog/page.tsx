import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Calendar } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { blogPosts } from "./content";

export const metadata: Metadata = {
  title: "Blog | Trace — Tech News, Productivity & AI Insights",
  description:
    "Read expert guides on staying updated with tech news, beating information overload, and building better news consumption habits. AI-powered tools, RSS readers, and productivity tips for developers and tech professionals.",
  alternates: {
    canonical: "https://www.yourtrace.online/blog"
  },
  openGraph: {
    title: "Blog | Trace — Tech News, Productivity & AI Insights",
    description:
      "Expert guides on staying updated with tech news, beating information overload, and building better news consumption habits.",
    url: "https://www.yourtrace.online/blog",
    siteName: "Trace",
    type: "website",
    images: [{ url: "https://www.yourtrace.online/opengraph-image", width: 1200, height: 630, alt: "Trace Blog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Trace",
    description:
      "Expert guides on staying updated with tech news, beating information overload, and building better news consumption habits.",
    images: ["https://www.yourtrace.online/twitter-image"],
  }
};

const CATEGORIES = [
  { key: "all", label: "All Posts" },
  { key: "comparisons", label: "Tools & Comparisons" },
  { key: "guides", label: "Guides" },
  { key: "ai-tools", label: "AI & Tech" },
  { key: "research", label: "Research" },
] as const;

export default function BlogPage() {
  const featuredPost = blogPosts[0];
  const remainingPosts = blogPosts.slice(1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">Blog</p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[3.75rem]">
              Guides & insights for<br className="hidden sm:block" />
              smarter tech reading
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-secondary">
              Expert guides on tech news aggregation, productivity, AI tools, and building better information diets.
              Written for developers, founders, and anyone drowning in tabs.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/blog/${featuredPost.slug}`}
            className="group relative block overflow-hidden rounded-[24px] border border-border/[0.08] bg-surface/30 transition-all hover:border-border/15 hover:shadow-[0_8px_40px_rgba(0,0,0,0.06)]"
          >
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/20 md:hidden" />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30 mb-3">
                  {featuredPost.tag}
                </p>
                <h2 className="text-[1.5rem] font-bold tracking-[-0.025em] leading-tight sm:text-[1.75rem]">
                  {featuredPost.title}
                </h2>
                <p className="mt-3 text-[15px] leading-[1.7] text-secondary line-clamp-3">
                  {featuredPost.excerpt}
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground/60 transition-colors group-hover:text-foreground">
                    Read article
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-secondary/30">
                    <Clock size={11} />
                    {featuredPost.readTime}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-secondary/30">
                    <Calendar size={11} />
                    {featuredPost.date}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Category Pills */}
      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.key}
                href={cat.key === "all" ? "/blog" : `/blog?category=${cat.key}`}
                className="rounded-full border border-border/[0.08] px-4 py-2 text-[13px] font-medium text-secondary/60 transition-all hover:text-foreground hover:border-border/20"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* All Posts Grid */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {remainingPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-[20px] border border-border/[0.06] bg-surface/30 transition-all hover:bg-surface/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-border/15"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image}
                    alt={post.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/30">
                      {post.tag}
                    </p>
                  </div>
                  <h2 className="text-[1.1rem] font-bold tracking-[-0.015em] leading-snug text-foreground transition-colors group-hover:text-foreground/80">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-[13px] leading-[1.7] text-secondary line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/[0.04]">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground/60 transition-colors group-hover:text-foreground">
                      Read article
                      <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-secondary/25">
                      <Clock size={10} />
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[24px] border border-border/[0.08] bg-surface/50 p-10 text-center sm:p-14">
          <h2 className="text-[1.5rem] font-bold tracking-[-0.025em] sm:text-[1.75rem]">
            Get the latest posts in your inbox
          </h2>
          <p className="mt-3 text-[15px] leading-[1.7] text-secondary">
            Weekly guides on tech news, productivity, and AI tools. No spam, just useful stuff.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/profile?tab=subscription"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-3 text-[14px] font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10"
            >
              Subscribe to Trace
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/trending"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border/[0.12] px-8 py-3 text-[14px] font-semibold text-foreground transition-all hover:bg-surface"
            >
              Browse trending topics
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
