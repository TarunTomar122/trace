import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/feed-v2/PageShell";

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
    <PageShell>
      <section style={{ textAlign: "center", padding: "72px 0 40px" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1d9bf0" }}>
          404
        </p>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          Page not found
        </h1>
        <p style={{ margin: "14px auto 0", maxWidth: 480, fontSize: 16, lineHeight: 1.65, color: "#536471" }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <div style={{ marginTop: 28 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 26px", borderRadius: 9999, background: "#1d9bf0", color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
            Back to home
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
