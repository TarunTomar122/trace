"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ChevronRight,
  Mail,
  Clock,
  ExternalLink,
  Check,
  ArrowRight,
  Zap,
} from "lucide-react";
import { consumePendingPostAuthIntent, getPostAuthDestination, useAuth } from "@/contexts/AuthContext";
import { getArticleImage } from "@/lib/fallback-images";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

// Interest options
const INTERESTS = [
  { id: "ai", label: "AI", keywords: ["ai", "gpt", "llm", "machine", "learning", "openai", "anthropic", "neural", "agent"] },
  { id: "tech", label: "Tech", keywords: ["tech", "software", "google", "apple", "microsoft", "meta", "amazon", "device", "platform"] },
  { id: "startups", label: "Startups", keywords: ["startup", "founder", "vc", "funding", "saas", "entrepreneur", "launch"] },
  { id: "markets", label: "Markets", keywords: ["business", "market", "earnings", "revenue", "stock", "deal", "acquisition"] },
  { id: "engineering", label: "Engineering", keywords: ["engineering", "code", "developer", "programming", "architecture", "system", "security", "cloud"] },
  { id: "product-design", label: "Product & Design", keywords: ["design", "ux", "ui", "figma", "interface", "user", "experience", "product"] },
  { id: "marketing", label: "Marketing", keywords: ["marketing", "growth", "seo", "ads", "distribution", "creator", "brand"] },
  { id: "fintech", label: "Fintech", keywords: ["finance", "crypto", "bitcoin", "bank", "payment", "trading", "fintech"] },
];

type TrendingItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  thumbnail?: string;
};

function InterestPill({
  interest,
  selected,
  onToggle,
}: {
  interest: { id: string; label: string };
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
        selected
          ? "bg-amber-500 text-white shadow-md"
          : "bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {selected && <Check size={14} className="inline mr-1.5 -mt-0.5" />}
      {interest.label}
    </button>
  );
}

function DigestArticleCard({ item, index }: { item: TrendingItem; index: number }) {
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const host = (() => {
    try {
      return new URL(item.url).hostname.replace("www.", "");
    } catch {
      return item.source || "";
    }
  })();

  return (
    <motion.a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
    >
      {/* Image */}
      <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-amber-600">{host}</span>
          <span className="text-xs text-secondary/40">•</span>
          <span className="text-xs text-secondary/40">3 min read</span>
        </div>
        <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-secondary/60 line-clamp-1 mt-1">
          {item.summary}
        </p>
      </div>

      <ExternalLink size={16} className="text-secondary/30 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-1" />
    </motion.a>
  );
}

function DigestPreview({
  items,
  interests,
}: {
  items: TrendingItem[];
  interests: string[];
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const interestLabels = INTERESTS
    .filter((i) => interests.includes(i.id))
    .map((i) => i.label);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/60 shadow-xl overflow-hidden">
      {/* Email Header */}
      <div className="bg-gray-900 dark:bg-gray-950 px-6 py-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center">
            <img src="/trace.webp" alt="Trace" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Your Daily Digest</h2>
            <p className="text-white/60 text-sm">{today}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {interestLabels.map((label) => (
            <span
              key={label}
              className="px-2.5 py-1 bg-white/10 rounded-full text-xs font-medium text-white/80"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Digest Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Zap size={16} className="text-amber-500" />
          <span className="text-sm font-medium text-secondary/70">
            {items.length} stories matched to your interests
          </span>
        </div>

        <div className="divide-y divide-border/40">
          {items.map((item, i) => (
            <DigestArticleCard key={item.id || i} item={item} index={i} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-border/40">
        <p className="text-xs text-secondary/50 text-center">
          This is a preview. Sign up to get this delivered to your inbox daily.
        </p>
      </div>
    </div>
  );
}

export default function DigestPreviewPage() {
  const router = useRouter();
  const { user, profile, profileResolved, signInWithGoogle } = useAuth();
  const [step, setStep] = useState<"select" | "preview">("select");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [allItems, setAllItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch trending on mount
  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch("/api/public/trending");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setAllItems(data.items);
          }
        }
      } catch (err) {
        console.error("Failed to fetch trending:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, []);

  useEffect(() => {
    if (!user || !profileResolved) return;
    const pendingIntent = consumePendingPostAuthIntent();
    if (!pendingIntent) return;
    router.push(getPostAuthDestination(profile, pendingIntent));
  }, [user, profileResolved, profile, router]);

  const handleSignIn = async () => {
    const result = await signInWithGoogle('read');
    if (result.status === 'success') {
      router.push(getPostAuthDestination(result.profile, result.intent));
    }
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Filter items based on selected interests
  const filteredItems = (() => {
    if (selectedInterests.length === 0) return allItems.slice(0, 6);

    const selectedKeywords = INTERESTS
      .filter((i) => selectedInterests.includes(i.id))
      .flatMap((i) => i.keywords);

    const matched = allItems.filter((item) => {
      const titleLower = item.title.toLowerCase();
      const summaryLower = (item.summary || "").toLowerCase();
      return selectedKeywords.some(
        (kw) => titleLower.includes(kw) || summaryLower.includes(kw)
      );
    });

    // If not enough matches, fill with remaining items
    if (matched.length < 4) {
      const remaining = allItems.filter((item) => !matched.includes(item));
      return [...matched, ...remaining].slice(0, 6);
    }

    return matched.slice(0, 6);
  })();

  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />

      <main className="container mx-auto px-4 max-w-4xl py-12">
        <AnimatePresence mode="wait">
          {step === "select" ? (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              {/* Hero */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-700 dark:text-amber-400 text-sm font-medium mb-4">
                  <Mail size={16} />
                  Preview your digest
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  What do you want to read about?
                </h1>
                <p className="text-secondary/70 text-lg">
                  Pick a few topics and we'll show you what your daily digest would look like.
                </p>
              </div>

              {/* Interest Grid */}
              <div className="flex flex-wrap gap-3 justify-center mb-10">
                {INTERESTS.map((interest) => (
                  <InterestPill
                    key={interest.id}
                    interest={interest}
                    selected={selectedInterests.includes(interest.id)}
                    onToggle={() => toggleInterest(interest.id)}
                  />
                ))}
              </div>

              {/* CTA */}
              <div className="text-center">
                <button
                  onClick={() => setStep("preview")}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-base font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Show my digest"}
                  <ChevronRight size={18} />
                </button>
                <p className="text-sm text-secondary/50 mt-3">
                  {selectedInterests.length === 0
                    ? "Skip selection to see trending articles"
                    : `${selectedInterests.length} topic${selectedInterests.length > 1 ? "s" : ""} selected`}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Back button */}
              <button
                onClick={() => setStep("select")}
                className="text-sm text-secondary/60 hover:text-foreground transition-colors mb-6 flex items-center gap-1"
              >
                <ChevronRight size={16} className="rotate-180" />
                Change interests
              </button>

              {/* Preview */}
              <div className="grid lg:grid-cols-[1fr,320px] gap-8">
                {/* Digest */}
                <DigestPreview items={filteredItems} interests={selectedInterests} />

                {/* Sidebar CTA */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 rounded-2xl p-6 border border-amber-200/50 dark:border-amber-800/30">
                    <Sparkles size={24} className="text-amber-500 mb-3" />
                    <h3 className="font-bold text-lg mb-2">Get this daily</h3>
                    <p className="text-sm text-secondary/70 mb-4">
                      Sign up for free and get a personalized digest delivered every morning at 6 AM.
                    </p>
                    <ul className="space-y-2 mb-5">
                      {[
                        "Personalized For You feed",
                        "High-signal trending topics",
                        "AI-powered summaries",
                        "No spam, unsubscribe anytime",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <Check size={14} className="text-amber-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => void handleSignIn()}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      Start reading for free
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-secondary/50">
                      Free forever. Premium features available.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
