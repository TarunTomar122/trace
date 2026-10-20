import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Calendar } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { BlogEmailCard } from "@/components/BlogCTA";
import { ArticleImage } from "@/components/ArticleImage";
import { blogPosts } from "./content";
import { standaloneBlogPosts } from "./standalone-content";
import { generateCollectionPageSchema, SITE_BASE_URL } from "@/lib/seo";
import { HOME_CSS } from "@/lib/home-css";
import { BLOG_CSS } from "@/lib/blog-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

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
    <div className={`hp bl ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{BLOG_CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <PublicHeader />

      <main>
        {/* Hero */}
        <div className="hp-top">
          <section className="hp-hero bl-hero">
            <p className="bl-tag">Blog</p>
            <h1 className="hp-h1">
              Guides & insights for{" "}<br className="hidden sm:block" />
              smarter tech reading
            </h1>
            <p className="hp-hero-p">
              Expert guides on tech news aggregation, productivity, AI tools, and building better information diets.
              Written for developers, founders, and anyone drowning in tabs.
            </p>
            <div className="hp-btns">
              <Link href="/feed?utm_source=blog&utm_medium=hero&utm_campaign=blog_index" className="hp-btn hp-btn-dark">
                Read today&apos;s tech brief <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>

        <div className="bl-band">
          <div className="bl-wrap">
            {/* Featured Post */}
            <Link href={`/blog/${featuredPost.slug}`} className="bl-feat">
              <div className="bl-feat-img">
                <ArticleImage
                  thumbnail={featuredPost.image}
                  title={featuredPost.title}
                  alt={featuredPost.title}
                  className="bl-img"
                />
              </div>
              <div className="bl-feat-body">
                <p className="bl-tag" data-cat={featuredPost.category}>
                  {featuredPost.tag}
                </p>
                <h2 className="bl-feat-title">{featuredPost.title}</h2>
                <p className="bl-feat-ex">{featuredPost.excerpt}</p>
                <div className="bl-meta">
                  <span className="bl-read">
                    Read article
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                  <span>
                    <Clock size={14} aria-hidden="true" />
                    {featuredPost.readTime}
                  </span>
                  <span>
                    <Calendar size={14} aria-hidden="true" />
                    {featuredPost.date}
                  </span>
                </div>
              </div>
            </Link>

            {/* Category Pills */}
            <div className="bl-chips">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.key}
                  href={cat.key === "all" ? "/blog" : `/blog/category/${cat.key}`}
                  className={`bl-chip${cat.key === "all" ? " is-active" : ""}`}
                >
                  {cat.label}
                </Link>
              ))}
            </div>

            {/* All Posts Grid */}
            <div className="bl-grid">
              {remainingPosts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="bl-card">
                  <div className="bl-card-img">
                    <ArticleImage
                      thumbnail={post.image}
                      title={post.title}
                      alt={post.title}
                      className="bl-img"
                      loading="lazy"
                    />
                  </div>
                  <div className="bl-card-body">
                    <p className="bl-tag" data-cat={post.category}>
                      {post.tag}
                    </p>
                    <h2 className="bl-card-title">{post.title}</h2>
                    <p className="bl-card-ex">{post.excerpt}</p>
                    <div className="bl-meta">
                      <span className="bl-read">
                        Read article
                        <ArrowRight size={13} aria-hidden="true" />
                      </span>
                      <span>
                        <Clock size={13} aria-hidden="true" />
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* The daily brief signup (there is no separate posts email). */}
        <section className="bl-end" aria-label="Subscribe to the daily brief">
          <BlogEmailCard slug="blog-index" placement="end" />
        </section>
      </main>

      <Footer variant="landing" />
    </div>
  );
}
