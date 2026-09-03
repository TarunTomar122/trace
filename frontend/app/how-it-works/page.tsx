import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import HowItWorksContent from "./HowItWorksContent";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How Trace Turns Noise Into a Daily Brief | Trace",
  description:
    "From sources to signal. See how Trace groups, summarizes, and delivers what matters. A visual walkthrough of how your chaotic feeds become a clean daily brief.",
  alternates: { canonical: "https://www.yourtrace.online/how-it-works" },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "How Trace Turns Noise Into a Daily Brief | Trace",
    description:
      "From sources to signal. See how Trace groups, summarizes, and delivers what matters.",
    url: "https://www.yourtrace.online/how-it-works",
    siteName: "Trace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Trace Turns Noise Into a Daily Brief | Trace",
    description:
      "From sources to signal. See how Trace groups, summarizes, and delivers what matters.",
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export default function HowItWorksPage() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/feed" />
      <main className="px-4 sm:px-6">
        <section className="mx-auto max-w-3xl pt-16 pb-10 sm:pt-24 sm:pb-14 text-center">
          <p className="public-kicker">
            How It Works
          </p>
          <h1 className="public-title public-title-detail mx-auto mt-4">
            How Trace turns noise into a daily brief
          </h1>
          <p className="public-deck mx-auto mt-5">
            From scattered sources to a clean, scannable pulse. See how Trace
            groups, summarizes, and delivers what matters in under 10 minutes.
          </p>
        </section>

        <HowItWorksContent />
      </main>
      <Footer />
    </div>
  );
}
