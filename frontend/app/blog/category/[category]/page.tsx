import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { ArticleImage } from "@/components/ArticleImage";
import { blogPosts } from "../../content";
import { standaloneBlogPosts } from "../../standalone-content";
import {
  DEFAULT_OPEN_GRAPH,
  DEFAULT_TWITTER_IMAGE,
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  SITE_BASE_URL,
} from "@/lib/seo";
import { HOME_CSS } from "@/lib/home-css";
import { BLOG_CSS } from "@/lib/blog-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

type PageProps = {
  params: Promise<{
    category: string;
  }>;
};

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  comparisons: {
    label: "Tools & Comparisons",
    description: "Side-by-side comparisons of tech news tools, RSS readers, AI digests, and productivity apps. Honest pros, cons, and pricing to help you choose.",
  },
  guides: {
    label: "Guides",
    description: "Practical guides for staying informed, beating information overload, and building a tech news routine that works for you.",
  },
  "ai-tools": {
    label: "AI & Tech",
    description: "Deep dives into AI-powered news tools, AI summarization accuracy, and how to use AI for smarter information consumption.",
  },
  research: {
    label: "Research",
    description: "Evidence-based analysis of information overload, attention economics, and calm technology, grounded in academic research.",
  },
};

export function generateStaticParams() {
  return Object.keys(CATEGORY_META).map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const meta = CATEGORY_META[category];

  if (!meta) {
    return { title: "Category Not Found | Trace Blog" };
  }

  const title = `${meta.label} | Trace Blog`;
  const description = meta.description;
  const url = `${SITE_BASE_URL}/blog/category/${category}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      title,
      description,
      url,
      siteName: "Trace",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  const meta = CATEGORY_META[category];

  if (!meta) {
    notFound();
  }

  const posts = [
    ...blogPosts.filter((p) => p.category === category),
    ...standaloneBlogPosts
      .filter((p) => p.category === category)
      .map((post) => ({ ...post, author: "Trace Editorial" })),
  ]
    .filter((post, index, all) => all.findIndex((candidate) => candidate.slug === post.slug) === index)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const categoryUrl = `${SITE_BASE_URL}/blog/category/${category}`;

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Trace", url: SITE_BASE_URL },
    { name: "Blog", url: `${SITE_BASE_URL}/blog` },
    { name: meta.label, url: categoryUrl },
  ]);

  const collectionSchema = generateCollectionPageSchema(
    `${meta.label} | Trace Blog`,
    meta.description,
    categoryUrl,
    posts.map((p) => `${SITE_BASE_URL}/blog/${p.slug}`),
  );

  return (
    <div className={`hp bl bl-gray-end ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{BLOG_CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <PublicHeader />

      <main>
        {/* Hero */}
        <div className="hp-top">
          <section className="hp-hero bl-hero">
            {/* Breadcrumb link */}
            <Link href="/blog" className="bl-crumb">
              <ArrowLeft size={14} aria-hidden="true" />
              All articles
            </Link>

            <p className="bl-tag" data-cat={category}>
              {meta.label}
            </p>
            <h1 className="hp-h1">{meta.label}</h1>
            <p className="hp-hero-p">{meta.description}</p>
          </section>
        </div>

        <div className="bl-band">
          <div className="bl-wrap">
            {/* Category nav */}
            <div className="bl-chips">
              {Object.entries(CATEGORY_META).map(([key, cat]) => (
                <Link
                  key={key}
                  href={`/blog/category/${key}`}
                  className={`bl-chip${key === category ? " is-active" : ""}`}
                >
                  {cat.label}
                </Link>
              ))}
              <Link href="/blog" className={`bl-chip${!category ? " is-active" : ""}`}>
                All Posts
              </Link>
            </div>

            {/* Post list */}
            {posts.length === 0 ? (
              <div className="bl-empty">
                <p>No articles in this category yet.</p>
                <Link href="/blog">
                  Browse all articles <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="bl-grid">
                {posts.map((post) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="bl-card">
                    <div className="bl-card-img">
                      <ArticleImage
                        thumbnail={post.image}
                        title={post.title}
                        alt={post.title}
                        className="bl-img"
                      />
                    </div>
                    <div className="bl-card-body">
                      <p className="bl-tag" data-cat={post.category}>
                        {post.tag}
                      </p>
                      <h2 className="bl-card-title">{post.title}</h2>
                      <p className="bl-card-ex">{post.excerpt}</p>
                      <div className="bl-meta">
                        <span>{post.author}</span>
                        <span>
                          <Clock size={13} aria-hidden="true" />
                          {post.readTime}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer variant="landing" />
    </div>
  );
}
