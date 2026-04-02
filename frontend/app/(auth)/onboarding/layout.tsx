import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started | Trace",
  description: "Personalize your Trace experience. Tell us about your interests and we'll curate the perfect intelligence feed for you.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

