import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { useCasesContent } from "./content";

export const metadata: Metadata = {
  title: "Trace for Every Role in Tech | Use Cases | Trace",
  description:
    "From founders to developers to investors — see how each role uses Trace to stay current without the noise.",
  alternates: { canonical: "https://www.yourtrace.online/use-cases" },
  openGraph: {
    title: "Trace for Every Role in Tech | Use Cases | Trace",
    description:
      "See how founders, developers, PMs, and more use Trace to stay current without the noise.",
    url: "https://www.yourtrace.online/use-cases",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trace for Every Role in Tech | Use Cases | Trace",
    description:
      "See how each role uses Trace to stay current without the noise.",
  },
};

export default function UseCasesHubPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-6xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Use Cases</p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.75rem]">
              Trace for every<br className="hidden sm:block" />
              role in tech
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-[#6b7280]">
              Whether you&apos;re a founder, developer, PM, or investor — Trace adapts to how you work.
              Pick your role and see what a day with Trace looks like.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <Link href="/solutions" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
                Solutions
              </Link>
              <Link href="/compare" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
                Compare Tools
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {useCasesContent.map((item) => (
              <Link
                key={item.slug}
                href={`/use-cases/${item.slug}`}
                className="landing-card p-7 transition-all hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#9ca3af]">
                  Use Case
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#111827]">
                  {item.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#6b7280]">
                  {item.shortDescription}
                </p>
                <div className="mt-6 text-sm font-semibold text-[#2563eb]">
                  See how →
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
