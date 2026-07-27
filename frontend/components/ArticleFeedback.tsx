"use client";

import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { trackFeedItemDownvoted, trackFeedItemUpvoted } from "@/lib/posthog";

type Vote = "like" | "dislike";
type StoredVotes = Record<string, Vote>;
const STORAGE_KEY = "trace_article_votes";

function fakeCounts(articleId: string) {
  let hash = 0;
  for (const char of articleId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { likes: (hash % 34) + 4, dislikes: ((hash >>> 3) % 10) + 2 };
}

function readVotes(): StoredVotes {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function ArticleFeedback({ articleId }: { articleId: string }) {
  const base = fakeCounts(articleId);
  const [vote, setVote] = useState<Vote | null>(null);
  const [counts, setCounts] = useState(base);
  const { user, loading, signInWithGoogle } = useAuth();

  useEffect(() => {
    const storedVote = readVotes()[articleId];
    if (!storedVote) return;
    setVote(storedVote);
    setCounts({
      likes: base.likes + (storedVote === "like" ? 1 : 0),
      dislikes: base.dislikes + (storedVote === "dislike" ? 1 : 0),
    });
  }, [articleId]);

  const choose = (nextVote: Vote) => {
    if (!user) {
      if (!loading) void signInWithGoogle("read");
      return;
    }

    const previousVote = vote;
    if (previousVote === nextVote) return;
    setVote(nextVote);
    setCounts((current) => ({
      likes: current.likes + (nextVote === "like" ? 1 : 0) - (previousVote === "like" ? 1 : 0),
      dislikes: current.dislikes + (nextVote === "dislike" ? 1 : 0) - (previousVote === "dislike" ? 1 : 0),
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readVotes(), [articleId]: nextVote }));
    } catch {
      // Keep the interaction working for this session if storage is unavailable.
    }
    (nextVote === "like" ? trackFeedItemUpvoted : trackFeedItemDownvoted)(articleId, "article");
  };

  return (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`Like article (${counts.likes})`}
        title="Like article"
        onClick={() => choose("like")}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-colors ${vote === "like" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-border/25 text-secondary/65 hover:text-foreground"}`}
      >
        <ThumbsUp size={13} className={vote === "like" ? "fill-current" : ""} />
        {counts.likes}
      </button>
      <button
        type="button"
        aria-label={`Dislike article (${counts.dislikes})`}
        title="Dislike article"
        onClick={() => choose("dislike")}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-colors ${vote === "dislike" ? "border-rose-500/40 bg-rose-500/10 text-rose-700" : "border-border/25 text-secondary/65 hover:text-foreground"}`}
      >
        <ThumbsDown size={13} className={vote === "dislike" ? "fill-current" : ""} />
        {counts.dislikes}
      </button>
    </div>
  );
}
