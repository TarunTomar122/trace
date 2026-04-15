import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Trace",
  description: "Read Trace's terms of service and understand your rights and responsibilities when using our personalized intelligence feed.",
  openGraph: {
    title: "Terms of Service | Trace",
    description: "Read Trace's terms of service and understand your rights and responsibilities.",
    url: "https://www.yourtrace.online/terms",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

