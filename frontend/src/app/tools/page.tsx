import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Sparkles, ArrowRight } from "lucide-react";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Free Tools | Trace",
  description:
    "Free tools to help you read smarter. Preview your daily digest, summarize articles, and more.",
  openGraph: {
    title: "Free Tools | Trace",
    description: "Free tools to help you read smarter.",
    url: "https://www.yourtrace.online/tools",
  },
};

const TOOLS = [
  {
    id: "digest-preview",
    title: "Daily Digest Preview",
    description:
      "Pick your interests and see exactly what your personalized daily digest would look like.",
    icon: Mail,
    href: "/tools/digest-preview",
    color: "bg-amber-500",
  },
  // Future tools can be added here
  // {
  //   id: "summarizer",
  //   title: "Article Summarizer",
  //   description: "Paste any article URL and get an AI-powered summary with key takeaways.",
  //   icon: Sparkles,
  //   href: "/tools/summarize",
  //   color: "bg-purple-500",
  //   comingSoon: true,
  // },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <img src="/trace.webp" alt="Trace" className="h-7" />
              <span className="font-semibold text-lg">Trace</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/daily"
                className="text-secondary/60 hover:text-foreground transition-colors"
              >
                Daily
              </Link>
              <Link
                href="/trending"
                className="text-secondary/60 hover:text-foreground transition-colors"
              >
                Trending
              </Link>
              <Link
                href="/research"
                className="hidden text-secondary/60 hover:text-foreground transition-colors sm:inline"
              >
                Research
              </Link>
              <Link
                href="/compare"
                className="hidden text-secondary/60 hover:text-foreground transition-colors sm:inline"
              >
                Compare
              </Link>
              <Link
                href="/"
                className="text-secondary/60 hover:text-foreground transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-4xl py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Free Tools</h1>
          <p className="text-secondary/70 text-lg max-w-lg mx-auto">
            Helpful tools to improve how you consume content. No sign-up required.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="group p-6 rounded-2xl border border-border/60 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg transition-all bg-white dark:bg-gray-900"
            >
              <div
                className={`w-12 h-12 ${tool.color} rounded-xl flex items-center justify-center mb-4`}
              >
                <tool.icon size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-bold mb-2 group-hover:text-amber-600 transition-colors">
                {tool.title}
              </h2>
              <p className="text-secondary/70 mb-4">{tool.description}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
                Try it free
                <ArrowRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200/50 dark:border-amber-800/30">
            <Sparkles size={20} className="text-amber-500" />
            <div className="text-left">
              <p className="font-semibold text-sm">Want all of this daily?</p>
              <p className="text-xs text-secondary/60">
                Sign up for Trace and get personalized content delivered every morning.
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
