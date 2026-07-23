import { Metadata } from "next";
import { DEFAULT_OPEN_GRAPH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy | Trace",
  description: "Learn how Trace protects your privacy and handles your data. Your personalized feed, your data, your control.",
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Privacy Policy | Trace",
    description: "Learn how Trace protects your privacy and handles your data.",
    url: "https://www.yourtrace.online/privacy-policy",
    type: "website",
  },
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
