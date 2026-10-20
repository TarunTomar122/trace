import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today's tech & AI news | Trace",
  description: "Today's biggest stories in tech and AI, ranked and explained in five minutes.",
  openGraph: {
    title: "Today's tech & AI news | Trace",
    description: "Today's biggest stories in tech and AI, ranked and explained in five minutes.",
    url: "https://www.yourtrace.online/feed",
    images: [{
      url: "https://www.yourtrace.online/opengraph-image?v=10-big-things",
      width: 1200,
      height: 630,
      alt: "Today's tech & AI news | Trace",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Today's tech & AI news | Trace",
    description: "Today's biggest stories in tech and AI, ranked and explained in five minutes.",
    images: ["https://www.yourtrace.online/twitter-image?v=10-big-things"],
  },
};

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
