import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Profile | Trace",
  description: "Manage your Trace profile, preferences, and subscription. Customize your personalized intelligence feed.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

