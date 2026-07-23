import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { blogPosts } from "../../content";
import { standaloneBlogPosts } from "../../standalone-content";
import { generateBreadcrumbSchema, generateCollectionPageSchema, SITE_BASE_URL } from "@/lib/seo";

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
    description: "Evidence-based analysis of information overload, attention economics, and calm technology — grounded in academic research.",
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

  const title = `${meta.label} — Trace Blog`;
  const description = meta.description;
  const url = `${SITE_BASE_URL}/blog/category/${category}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
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
    `${meta.label} — Trace Blog`,
    meta.description,
    categoryUrl,
    posts.map((p) => `${SITE_BASE_URL}/blog/${p.slug}`),
  );

  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl pt-12 pb-8 sm:pt-20 sm:pb-10">
          <div className="max-w-3xl">
            {/* Breadcrumb link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af] transition-colors hover:text-[#111827]"
            >
              <ArrowLeft size={12} />
              All articles
            </Link>

            <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">
              {meta.label}
            </p>
            <h1 className="mt-3 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.75rem]">
              {meta.label}
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-[1.8] landing-muted">
              {meta.description}
            </p>
          </div>
        </div>
      </section>

      {/* Category nav */}
      <section className="px-4 sm:px-6 lg:px-8 pb-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_META).map(([key, cat]) => (
              <Link
                key={key}
                href={`/blog/category/${key}`}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                  key === category
                    ? "bg-[#2563eb] text-white border-[#2563eb]"
                    : "border-[#e5e7eb] bg-white text-[#6b7280] hover:text-[#111827] hover:border-[#d1d5db]"
                }`}
              >
                {cat.label}
              </Link>
            ))}
            <Link
              href="/blog"
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                !category
                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                  : "border-[#e5e7eb] bg-white text-[#6b7280] hover:text-[#111827] hover:border-[#d1d5db]"
              }`}
            >
              All Posts
            </Link>
          </div>
        </div>
      </section>

      {/* Post list */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl">
          {posts.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[15px] landing-muted">No articles in this category yet.</p>
              <Link
                href="/blog"
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#2563eb] hover:text-[#1d4ed8]"
              >
                Browse all articles <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group landing-card block overflow-hidden transition-all hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image}
                      alt={post.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2563eb]">
                      {post.tag}
                    </p>
                    <h2 className="mt-2 text-[15px] font-bold leading-snug text-[#111827]">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-[12px] leading-[1.6] landing-muted line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-[11px] text-[#9ca3af]">{post.author}</span>
                      <span className="flex items-center gap-1 text-[11px] text-[#9ca3af]">
                        <Clock size={10} />
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer variant="landing" />
    </div>
  );
}
