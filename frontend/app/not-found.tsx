import type { Metadata } from "next";
import Link from "next/link";
import StatusPage from "@/components/StatusPage";

export const metadata: Metadata = {
  title: "404 — Page Not Found | Trace",
  description: "The page you are looking for does not exist.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <StatusPage
      note="nothing at this address"
      title="Page not found"
      lede="The page you are looking for does not exist or has moved."
      actions={
        <>
          <Link href="/" className="st-btn st-btn-dark">
            Back to home
          </Link>
          <Link href="/brief" className="st-btn st-btn-line">
            Read today&rsquo;s brief
          </Link>
        </>
      }
      cards={[
        { title: "The Feed", text: "Every story ranked, every source attached", href: "/feed", tint: "cyan" },
        { title: "How it works", text: "From a hundred sources to one calm page", href: "/how-it-works", tint: "pink" },
        { title: "Guides", text: "Plain tips for beating news overload", href: "/blog", tint: "green" },
      ]}
    />
  );
}
