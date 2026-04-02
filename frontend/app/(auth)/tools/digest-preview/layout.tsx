import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Digest Preview - See What You'd Get | Trace",
  description:
    "Preview your personalized daily digest. Pick your interests and see exactly what articles you'd receive each morning. Free to try.",
  keywords: [
    "daily digest",
    "news digest",
    "personalized newsletter",
    "content curation",
    "morning briefing",
    "reading list",
    "Trace",
  ],
  openGraph: {
    title: "Preview Your Daily Digest | Trace",
    description:
      "Pick your interests and see what your personalized daily reading list would look like.",
    url: "https://www.yourtrace.online/tools/digest-preview",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Preview Your Daily Digest | Trace",
    description:
      "Pick your interests and see what your personalized daily reading list would look like.",
  },
};

export default function DigestPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
