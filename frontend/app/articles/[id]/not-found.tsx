import Link from "next/link";
import { FileQuestion } from "lucide-react";

const ACCENT = "#F59E0B";

export default function ArticleNotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4 max-w-2xl h-14 flex items-center">
          <Link href="/" className="font-bold text-lg tracking-tight">
            Trace
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${ACCENT}15` }}
          >
            <FileQuestion size={32} style={{ color: ACCENT }} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Article not found</h1>
          <p className="text-secondary/60 mb-6">
            This article may have been removed or the link might be incorrect.
          </p>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            Explore your feed
          </Link>
        </div>
      </main>
    </div>
  );
}
