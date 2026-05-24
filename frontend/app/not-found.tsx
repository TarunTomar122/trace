import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

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
    <div className="landing-page landing-grid-bg min-h-screen flex flex-col">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">
            404
          </p>
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] text-[#111827] sm:text-[3.5rem]">
            Page not found
          </h1>
          <p className="mt-4 max-w-md mx-auto text-[16px] leading-[1.8] text-[#6b7280]">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="mt-8">
            <Link href="/" className="landing-btn landing-btn-primary landing-btn-sm">
              Back to home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
