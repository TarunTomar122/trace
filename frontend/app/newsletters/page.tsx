import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { newslettersContent } from "./content";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Tech Newsletter Reviews & Comparisons | Trace",
  description:
    "Honest reviews of the most popular tech newsletters. See ratings, pros, cons, and whether each one is worth your inbox space.",
  alternates: { canonical: "https://www.yourtrace.online/newsletters" },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Tech Newsletter Reviews & Comparisons | Trace",
    description:
      "Honest reviews of popular tech newsletters. Ratings, pros, cons — see which are worth your inbox space.",
    url: "https://www.yourtrace.online/newsletters",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech Newsletter Reviews & Comparisons | Trace",
    description:
      "Honest reviews of popular tech newsletters. See which are worth your time.",
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default function NewslettersHubPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-6xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Newsletter Reviews</p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.75rem]">
              Tech newsletters,<br className="hidden sm:block" />
              actually reviewed
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-[#6b7280]">
              Most &ldquo;best newsletters&rdquo; lists are just links. These are real reviews — ratings,
              pros, cons, and honest takes on whether each one earns its inbox real estate.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <Link href="/compare" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
                Compare Tools
              </Link>
              <Link href="/solutions" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
                Solutions
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {newslettersContent.map((item) => (
              <Link
                key={item.slug}
                href={`/newsletters/${item.slug}`}
                className="landing-card p-7 transition-all hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#9ca3af]">
                    Review
                  </div>
                  <span className="text-[#2563eb] text-sm tracking-tight">
                    {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                  </span>
                  <span className="text-[12px] font-medium text-[#6b7280]">
                    {item.rating}/5
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#111827]">
                  {item.name}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#6b7280]">
                  {item.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-medium text-[#2563eb]">
                    {item.frequency}
                  </span>
                  {item.topics.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[11px] text-[#6b7280]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-6 text-sm font-semibold text-[#2563eb]">
                  Read review →
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
