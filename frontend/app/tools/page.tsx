import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Sparkles, ArrowRight } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Free Tools | Trace",
  description:
    "Free tools to help you read smarter. Preview your daily digest, summarize articles, and more.",
  openGraph: {
    title: "Free Tools | Trace",
    description: "Free tools to help you read smarter.",
    url: "https://www.yourtrace.online/tools",
  },
};

const TOOLS = [
  {
    id: "digest-preview",
    title: "Daily Digest Preview",
    description:
      "Pick your interests and see exactly what your personalized daily digest would look like.",
    icon: Mail,
    href: "/tools/digest-preview",
  },
];

export default function ToolsPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />

      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-4xl pt-16 pb-10 sm:pt-24 sm:pb-14">
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">Tools</p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.25rem]">
            Free tools to read smarter
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-[#6b7280]">
            Helpful utilities to improve how you consume content. No sign-up required.
          </p>
        </section>

        <section className="mx-auto max-w-4xl pb-20">
          <div className="grid gap-6 md:grid-cols-2">
            {TOOLS.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className="group landing-card p-6 transition-all hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2563eb]">
                  <tool.icon size={22} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-[#111827] mb-2 group-hover:text-[#2563eb] transition-colors">
                  {tool.title}
                </h2>
                <p className="mb-4 text-[#6b7280]">{tool.description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#2563eb]">
                  Try it free
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-16 flex justify-center">
            <div className="landing-card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:gap-6">
              <Sparkles size={20} className="shrink-0 text-[#2563eb]" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#111827]">Want all of this daily?</p>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  Sign up for Trace and get personalized content delivered every morning.
                </p>
              </div>
              <Link href="/" className="landing-btn landing-btn-primary landing-btn-sm shrink-0">
                Get started
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
