import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Feed | Trace",
  description: "Explore your personalized intelligence feed. Curated content from YouTube, arXiv, GitHub, and more, tailored to your interests.",
  openGraph: {
    title: "Your Feed | Trace",
    description: "Explore your personalized intelligence feed. Curated content from YouTube, arXiv, GitHub, and more, tailored to your interests.",
    url: "https://www.yourtrace.online/feed",
  },
  twitter: {
    title: "Your Feed | Trace",
    description: "Explore your personalized intelligence feed. Curated content from YouTube, arXiv, GitHub, and more, tailored to your interests.",
  },
};

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

