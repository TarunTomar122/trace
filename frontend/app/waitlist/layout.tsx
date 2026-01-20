import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Waitlist | Trace",
  description: "Join Trace and get early access to your personalized intelligence feed. Be the first to experience adaptive content curation.",
  openGraph: {
    title: "Join the Waitlist | Trace",
    description: "Join Trace and get early access to your personalized intelligence feed. Be the first to experience adaptive content curation.",
    url: "https://www.yourtrace.online/waitlist",
  },
  twitter: {
    title: "Join the Waitlist | Trace",
    description: "Join Trace and get early access to your personalized intelligence feed.",
  },
};

export default function WaitlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

