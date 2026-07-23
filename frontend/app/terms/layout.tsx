import { Metadata } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service | Trace",
  description: "Read Trace's terms of service and understand your rights and responsibilities when using our personalized intelligence feed.",
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Terms of Service | Trace",
    description: "Read Trace's terms of service and understand your rights and responsibilities.",
    url: "https://www.yourtrace.online/terms",
    type: "website",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
