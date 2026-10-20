import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import HowItWorksContent from "./HowItWorksContent";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE } from "@/lib/seo";
import { HOME_CSS } from "@/lib/home-css";
import { HOW_CSS } from "@/lib/how-css";
import { HOME_FONT_VARS } from "@/lib/home-fonts";

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
    <div className={`hp hw ${HOME_FONT_VARS}`}>
      <style>{HOME_CSS}</style>
      <style>{HOW_CSS}</style>
      <PublicHeader subscribeHref="#join" />
      <main>
        <div className="hp-top">
          <section className="hp-hero">
            <h1 className="hp-h1">How Trace turns noise into a daily brief</h1>
            <p className="hp-hero-p">
              From scattered sources to one calm page. Trace reads <strong>over a hundred sources every morning</strong>,
              groups the stories everyone is covering and sums each one up, so you are caught up in about five minutes.
            </p>
          </section>
        </div>

        <HowItWorksContent />
      </main>
      <Footer variant="landing" />
    </div>
  );
}
