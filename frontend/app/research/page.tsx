import type { Metadata } from "next";
import Link from "next/link";
import MainNav from "@/components/MainNav";
import { researchPosts } from "./content";

export const metadata: Metadata = {
  title: "Research | Trace",
  description:
    "Research-backed essays on attention, information overload, and signal-first learning for modern builders.",
  alternates: {
    canonical: "https://www.yourtrace.online/research"
  },
  openGraph: {
    title: "Research | Trace",
    description:
      "Research-backed essays on attention, information overload, and signal-first learning for modern builders.",
    url: "https://www.yourtrace.online/research",
    siteName: "Trace",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Research | Trace",
    description:
      "Research-backed essays on attention, information overload, and signal-first learning for modern builders."
  }
};

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-2 selection:bg-primary/20 selection:text-primary">
      <MainNav showBanner={false} />
      <section className="relative pt-32 md:pt-36 lg:pt-40 pb-16 md:pb-24 overflow-hidden z-10">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="text-center mb-10 md:mb-14">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-4">
              Research on brain rot, attention, and signal
            </h1>
            <p className="text-secondary text-base md:text-lg max-w-2xl mx-auto">
              We summarize peer-reviewed studies and public health guidance so you can see what the evidence says about
              attention decay, information overload, and the habits that reverse it.
            </p>
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
    </div>
  );
}
