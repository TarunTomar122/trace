import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { comparePages } from "./content";

export const metadata: Metadata = {
  title: "News Reader Alternatives And Comparison Guides | Trace",
  description:
    "Compare Trace against RSS readers and traditional news apps. Find the right setup if you want less noise and faster context.",
  alternates: {
    canonical: "https://www.yourtrace.online/compare",
  },
  openGraph: {
    title: "News Reader Alternatives And Comparison Guides | Trace",
    description:
      "Comparison pages for people who want less noise, faster context, and a better way to follow tech news.",
    url: "https://www.yourtrace.online/compare",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "News Reader Alternatives And Comparison Guides | Trace",
    description:
      "Comparison pages for people who want less noise and faster context.",
  },
};

export default function CompareHubPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-6xl pt-24 pb-12 sm:pt-32 sm:pb-16">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-secondary/40">
              Comparison Guides
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Better ways to follow tech news without building another reading backlog
            </h1>
            <p className="mt-5 text-base leading-8 text-secondary sm:text-lg">
              These pages are for people comparing Trace with RSS readers, traditional news apps,
              and other ways of keeping up. The idea is simple: less scrolling, more context.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <Link href="/blog" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
                Research
              </Link>
              <Link href="/tools" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
                Tools
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {comparePages.map((page) => (
              <Link
                key={page.slug}
                href={`/compare/${page.slug}`}
                className="rounded-3xl border border-border/20 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:bg-gray-950"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/40">
                  Comparison
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                  {page.heroTitle}
                </h2>
                <p className="mt-4 text-sm leading-7 text-secondary">
                  {page.description}
                </p>
                <div className="mt-6 text-sm font-semibold text-foreground">
                  Read guide →
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
