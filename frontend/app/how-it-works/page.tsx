import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import HowItWorksContent from "./HowItWorksContent";

export const metadata: Metadata = {
  title: "How Trace Turns Noise Into a Daily Brief | Trace",
  description:
    "From sources to signal — see how Trace groups, summarizes, and delivers what matters. A visual walkthrough of how your chaotic feeds become a clean daily brief.",
  alternates: { canonical: "https://www.yourtrace.online/how-it-works" },
  openGraph: {
    title: "How Trace Turns Noise Into a Daily Brief | Trace",
    description:
      "From sources to signal — see how Trace groups, summarizes, and delivers what matters.",
    url: "https://www.yourtrace.online/how-it-works",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Trace Turns Noise Into a Daily Brief | Trace",
    description:
      "From sources to signal — see how Trace groups, summarizes, and delivers what matters.",
  },
};

export default function HowItWorksPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-3xl pt-16 pb-10 sm:pt-24 sm:pb-14 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">
            How It Works
          </p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.25rem]">
            How Trace turns noise into a daily brief
          </h1>
          <p className="mt-5 text-[16px] leading-[1.8] text-[#6b7280] sm:text-[17px] max-w-xl mx-auto">
            From scattered sources to a clean, scannable pulse — see how Trace
            groups, summarizes, and delivers what matters in under 10 minutes.
          </p>
        </section>

        <HowItWorksContent />
      </main>
      <Footer />
    </div>
  );
}
