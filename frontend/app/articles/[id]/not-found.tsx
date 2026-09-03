import Link from "next/link";
import { FileQuestion } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

export default function ArticleNotFound() {
  return (
    <div className="landing-page landing-grid-bg min-h-screen flex flex-col">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/feed" />

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eff6ff]">
            <FileQuestion size={32} className="text-[#2563eb]" />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[#2563eb]">
            Not found
          </p>
          <h1 className="mt-4 text-[2rem] font-bold tracking-[-0.03em] text-[#111827]">
            Article not found
          </h1>
          <p className="mt-4 text-[16px] leading-[1.8] text-[#6b7280]">
            This article may have been removed or the link might be incorrect.
          </p>
          <div className="mt-8">
            <Link href="/feed" className="landing-btn landing-btn-primary landing-btn-sm">
              Explore your feed
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
