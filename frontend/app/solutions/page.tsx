import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { solutionsContent } from "./content";

export const metadata: Metadata = {
  title: "Solutions for Every Tech Reading Workflow | Trace",
  description:
    "From information overload to morning briefing workflows — explore how Trace solves the biggest tech reading problems.",
  alternates: { canonical: "https://www.yourtrace.online/solutions" },
  openGraph: {
    title: "Solutions for Every Tech Reading Workflow | Trace",
    description:
      "Explore how Trace solves the biggest tech reading problems — from information overload to daily briefing workflows.",
    url: "https://www.yourtrace.online/solutions",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solutions for Every Tech Reading Workflow | Trace",
    description:
      "Explore how Trace solves the biggest tech reading problems.",
  },
};

export default function SolutionsHubPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-6xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Solutions</p>
            <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.75rem]">
              Fix the way you<br className="hidden sm:block" />
              read tech news
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-[#6b7280]">
              Every tech professional has a different workflow problem. Browse the solutions below — each
              one maps a common pain point to how Trace replaces the bad habit with a clean daily brief.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <Link href="/compare" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
                Compare Tools
              </Link>
              <Link href="/use-cases" className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[#6b7280] transition-colors hover:text-[#111827]">
                Use Cases
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-20">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {solutionsContent.map((item) => (
              <Link
                key={item.slug}
                href={`/solutions/${item.slug}`}
                className="landing-card p-7 transition-all hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#9ca3af]">
                  Solution
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
