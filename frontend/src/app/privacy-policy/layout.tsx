import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Trace",
  description: "Learn how Trace protects your privacy and handles your data. Your personalized feed, your data, your control.",
  openGraph: {
    title: "Privacy Policy | Trace",
    description: "Learn how Trace protects your privacy and handles your data.",
    url: "https://www.yourtrace.online/privacy-policy",
  },
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

