import type { Metadata } from "next";
import Link from "next/link";

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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <main className="text-center px-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary/35">
          404
        </p>
        <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[3.5rem]">
          Page not found
        </h1>
        <p className="mt-4 max-w-md mx-auto text-[16px] leading-[1.8] text-secondary">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex rounded-full bg-foreground px-6 py-3 text-[13px] font-semibold text-background transition-all hover:bg-foreground/90"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
