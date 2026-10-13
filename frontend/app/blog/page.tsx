import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Calendar } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { ArticleImage } from "@/components/ArticleImage";
import { blogPosts } from "./content";
import { standaloneBlogPosts } from "./standalone-content";
import { generateCollectionPageSchema, SITE_BASE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog | Trace | Tech News, Productivity & AI Insights",
  description:
    "Read expert guides on staying updated with tech news, beating information overload, and building better news consumption habits. AI-powered tools, RSS readers, and productivity tips for developers and tech professionals.",
  alternates: {
    canonical: "https://www.yourtrace.online/blog"
  },
  openGraph: {
    title: "Blog | Trace | Tech News, Productivity & AI Insights",
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
  const allPosts = [
    ...blogPosts.map((post) => ({ ...post, isStandalone: false })),
    ...standaloneBlogPosts.map((post) => ({ ...post, isStandalone: true })),
  ]
    .filter((post, index, posts) => posts.findIndex((candidate) => candidate.slug === post.slug) === index)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const [featuredPost, ...remainingPosts] = allPosts;

  const collectionSchema = generateCollectionPageSchema(
    "Blog | Trace | Tech News, Productivity & AI Insights",
    "Expert guides on staying updated with tech news, beating information overload, and building better information consumption habits.",
    `${SITE_BASE_URL}/blog`,
    [
      ...blogPosts.map((p) => `${SITE_BASE_URL}/blog/${p.slug}`),
      ...standaloneBlogPosts.map((p) => `${SITE_BASE_URL}/blog/${p.slug}`),
    ],
  );

  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <PublicHeader variant="landing" ctaLabel="Start reading free" ctaHref="/feed" />

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl pt-12 pb-10 sm:pt-20 sm:pb-14">
          <div className="max-w-3xl">
            <p className="public-kicker">Blog</p>
            <h1 className="public-title mt-4">
              Guides & insights for<br className="hidden sm:block" />
              smarter tech reading
            </h1>
            <p className="public-deck mt-5">
              Expert guides on tech news aggregation, productivity, AI tools, and building better information diets.
              Written for developers, founders, and anyone drowning in tabs.
            </p>
            <Link
              href="/feed?utm_source=blog&utm_medium=hero&utm_campaign=blog_index"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0f1419] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#29313a]"
            >
              Read today&apos;s tech brief <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href={`/blog/${featuredPost.slug}`}
            className="group landing-card relative block overflow-hidden transition-all hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]"
          >
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden">
                <ArticleImage
                  thumbnail={featuredPost.image}
                  title={featuredPost.title}
                  alt={featuredPost.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-10">
                <p className="public-kicker mb-3">
                  {featuredPost.tag}
                </p>
                <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] leading-tight text-foreground sm:text-[2rem]">
                  {featuredPost.title}
                </h2>
                <p className="mt-4 text-[16px] leading-[1.72] text-secondary">
                  {featuredPost.excerpt}
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <span className="public-link inline-flex items-center gap-1.5 text-[13px]">
                    Read article
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="public-meta flex items-center gap-1">
                    <Clock size={11} />
                    {featuredPost.readTime}
                  </span>
                  <span className="public-meta flex items-center gap-1">
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
                href={cat.key === "all" ? "/blog" : `/blog/category/${cat.key}`}
                className="public-chip"
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
                className="group landing-card flex flex-col overflow-hidden transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <ArticleImage
                    thumbnail={post.image}
                    title={post.title}
                    alt={post.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="public-kicker">
                      {post.tag}
                    </p>
                  </div>
                  <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] leading-snug text-foreground">
                    {post.title}
                  </h2>
                  <p className="mt-3 flex-1 text-[15px] leading-[1.7] text-secondary">
                    {post.excerpt}
                  </p>
                  <div className="public-rule mt-5 flex items-center justify-between border-t pt-4">
                    <span className="public-link inline-flex items-center gap-1.5 text-[12px]">
                      Read article
                      <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="public-meta flex items-center gap-1">
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
        <div className="mx-auto max-w-3xl landing-card p-10 text-center sm:p-14">
          <h2 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[2rem]">
            Get the latest posts in your inbox
          </h2>
          <p className="public-body mx-auto mt-3 max-w-xl">
            Weekly guides on tech news, productivity, and AI tools. No spam, just useful stuff.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/feed?utm_source=blog&utm_medium=index_cta"
              className="landing-btn landing-btn-primary landing-btn-lg inline-flex"
            >
              Open today&apos;s briefing
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <Footer variant="landing" />
    </div>
  );
}
