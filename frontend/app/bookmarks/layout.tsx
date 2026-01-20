import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Bookmarks | Trace",
  description: "Access your saved bookmarks from your personalized Trace feed. All your favorite content in one place.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BookmarksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

