"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";

type CarouselCategory = "all" | "ai" | "tech" | "world";
type CarouselStyle = "mixed" | "editorial" | "signal" | "spotlight";
type CarouselMode = "smart" | "browse";

type Slide = {
  id: string;
  slideType: "cover" | "story";
  style: Exclude<CarouselStyle, "mixed">;
  headline: string;
  kicker: string;
  body: string;
  imageUrl: string;
  coverImages?: string[];
  category: "ai" | "tech" | "world";
  topicId?: string;
  articleCount?: number;
  sourceCount?: number;
  sourceNames: string[];
  storyUrl?: string;
};

type CarouselDeck = {
  ok: boolean;
  date: string;
  category: CarouselCategory;
  style: CarouselStyle;
  mode?: CarouselMode;
  title: string;
  tagline: string;
  count: number;
  caption: string;
  slides: Slide[];
};

type BrowseTopic = {
  id: string;
  title: string;
  thumbnail: string;
  category: "ai" | "tech" | "world";
  sourceCount: number;
  articleCount: number;
};

const KEY = "trace_instagram_studio_key";

const TEMPLATES: Array<{ value: CarouselStyle; label: string; desc: string }> = [
  { value: "mixed", label: "Mixed", desc: "Rotates all styles" },
  { value: "editorial", label: "Editorial", desc: "Warm cream" },
  { value: "signal", label: "Signal", desc: "Dark mode" },
  { value: "spotlight", label: "Spotlight", desc: "White + accent" },
];

const COUNTS = [4, 5, 6, 7, 8];

const CATEGORY_COLORS: Record<string, string> = {
  ai: "bg-violet-100 text-violet-700",
  tech: "bg-sky-100 text-sky-700",
  world: "bg-emerald-100 text-emerald-700",
};

function srcLine(names: string[]) {
  if (!names.length) return "";
  return names.slice(0, 4).join(" · ");
}

function catTag(v: string) {
  return v === "ai" ? "AI" : v === "world" ? "World" : "Tech";
}

export default function InstagramStudioPage() {
  const [keyInput, setKeyInput] = useState("");
  const [studioKey, setStudioKey] = useState("");

  // shared
  const [style, setStyle] = useState<CarouselStyle>("mixed");
  const [mode, setMode] = useState<CarouselMode>("smart");
  const [deck, setDeck] = useState<CarouselDeck | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // posting
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<{ ok: boolean; postId?: string; scheduled?: boolean; scheduledAt?: string | null; error?: string } | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  // smart mode
  const [slideCount, setSlideCount] = useState(5);

  // browse mode
  const [browseTopics, setBrowseTopics] = useState<BrowseTopic[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(KEY) || "";
    if (saved) { setStudioKey(saved); setKeyInput(saved); }
  }, []);

  const withAuth = useCallback((init?: RequestInit): RequestInit => {
    const headers = new Headers(init?.headers || {});
    if (studioKey) headers.set("x-studio-key", studioKey);
    return { ...init, headers };
  }, [studioKey]);

  // Load browse topics when entering browse mode
  const loadBrowseTopics = useCallback(async () => {
    if (!studioKey) return;
    setBrowseLoading(true);
    try {
      const res = await fetch("/api/dev/instagram/studio/topics", withAuth({ cache: "no-store" }));
      if (!res.ok) throw new Error("Failed to load topics");
      const data = await res.json();
      setBrowseTopics(data.topics || []);
    } catch {
      setBrowseTopics([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [studioKey, withAuth]);

  useEffect(() => {
    if (studioKey && mode === "browse" && !browseTopics.length) {
      void loadBrowseTopics();
    }
  }, [studioKey, mode, browseTopics.length, loadBrowseTopics]);

  const toggleTopic = (id: string) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = useCallback(async () => {
    if (!studioKey) { setError("Enter studio key."); return; }
    if (mode === "browse" && selectedTopicIds.size === 0) {
      setError("Select at least one story.");
      return;
    }
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const params = new URLSearchParams({ mode, style });
      if (mode === "smart") {
        params.set("slides", String(slideCount));
      } else {
        params.set("topicIds", [...selectedTopicIds].join(","));
      }
      const res = await fetch(
        `/api/dev/instagram/studio/carousel?${params}`,
        withAuth({ cache: "no-store" }),
      );
      const data = await res.json();
      if (res.status === 401) throw new Error("Invalid studio key");
      if (!res.ok) throw new Error(data?.error || "Failed to generate");
      const next = data as CarouselDeck;
      setDeck(next);
      setSelectedId(next.slides[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [mode, studioKey, style, slideCount, selectedTopicIds, withAuth]);

  const unlock = () => {
    const k = keyInput.trim();
    if (!k) { setError("Enter a key."); return; }
    setError("");
    setStudioKey(k);
    if (typeof window !== "undefined") window.sessionStorage.setItem(KEY, k);
  };

  const lock = () => {
    setStudioKey("");
    setKeyInput("");
    setDeck(null);
    setSelectedId("");
    if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
  };

  const selected = useMemo(
    () => deck?.slides.find((s) => s.id === selectedId) || deck?.slides[0] || null,
    [deck, selectedId],
  );

  const selectedIndex = useMemo(
    () => deck && selected ? deck.slides.findIndex((s) => s.id === selected.id) : -1,
    [deck, selected],
  );

  const previewUrl = useMemo(() => {
    if (!selected || !studioKey || !deck) return "";
    const params = new URLSearchParams({
      mode: "carousel",
      format: "portrait",
      style: selected.style,
      slideType: selected.slideType,
      headline: selected.headline,
      kicker: selected.kicker,
      body: selected.body,
      imageUrl: selected.imageUrl || "",
      sources: srcLine(selected.sourceNames),
      index: String((deck.slides.findIndex((s) => s.id === selected.id) || 0) + 1),
      total: String(deck.slides.length),
      key: studioKey,
      t: String(Date.now()),
    });
    return `/api/dev/instagram/studio/render?${params}`;
  }, [deck, selected, studioKey]);

  const copyCaption = async () => {
    if (!deck?.caption) return;
    try {
      await navigator.clipboard.writeText(deck.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const move = (dir: -1 | 1) => {
    if (!deck?.slides?.length || selectedIndex < 0) return;
    const next = (selectedIndex + dir + deck.slides.length) % deck.slides.length;
    setSelectedId(deck.slides[next]?.id || "");
  };

  const buildSlideUrl = useCallback((slide: Slide, index: number) => {
    if (!deck || !studioKey) return "";
    const params = new URLSearchParams({
      mode: "carousel", format: "portrait",
      style: slide.style, slideType: slide.slideType,
      headline: slide.headline, kicker: slide.kicker,
      body: slide.body, imageUrl: slide.imageUrl || "",
      sources: srcLine(slide.sourceNames),
      index: String(index + 1), total: String(deck.slides.length),
      key: studioKey,
    });
    return `/api/dev/instagram/studio/render?${params}`;
  }, [deck, studioKey]);

  const fetchAllSlideBlobs = useCallback(async (): Promise<File[]> => {
    if (!deck?.slides?.length) return [];
    const files = await Promise.all(
      deck.slides.map(async (slide, i) => {
        const url = buildSlideUrl(slide, i);
        if (!url) return null;
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], `trace-slide-${i + 1}.png`, { type: "image/png" });
      }),
    );
    return files.filter((f): f is File => f !== null);
  }, [deck, buildSlideUrl]);

  const downloadAll = useCallback(async () => {
    if (!deck?.slides?.length) return;
    setExporting(true);
    try {
      const files = await fetchAllSlideBlobs();
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url; a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally { setExporting(false); }
  }, [deck, fetchAllSlideBlobs]);

  const postToInstagram = useCallback(async () => {
    if (!deck?.slides?.length) return;
    setPosting(true);
    setPostResult(null);
    try {
      const body: Record<string, unknown> = {
        slides: deck.slides,
        caption: deck.caption,
        total: deck.slides.length,
      };
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();
      const res = await fetch("/api/dev/instagram/studio/postiz", withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to post");
      setPostResult({ ok: true, postId: data.postId, scheduled: data.scheduled, scheduledAt: data.scheduledAt });
    } catch (e) {
      setPostResult({ ok: false, error: e instanceof Error ? e.message : "Failed to post" });
    } finally {
      setPosting(false);
    }
  }, [deck, scheduledAt, withAuth]);

  const canShare = typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;

  const shareAll = useCallback(async () => {
    if (!deck?.slides?.length) return;
    setExporting(true);
    try {
      const files = await fetchAllSlideBlobs();
      const shareData = { files };
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await downloadAll();
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") await downloadAll();
    } finally { setExporting(false); }
  }, [deck, fetchAllSlideBlobs, downloadAll]);

  /* ─── Unlock ─── */
  if (!studioKey) {
    return (
      <main className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-6">
        <div className="w-full max-w-[360px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
            Trace Studio
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900 mt-2">
            Unlock studio
          </h1>
          <p className="text-[13px] text-stone-500 mt-2 leading-relaxed">
            Enter your access key to build Instagram carousels from today&apos;s strongest stories.
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            className="w-full mt-6 px-4 py-3 rounded-xl border border-stone-200 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
            placeholder="Access key"
          />
          <button
            onClick={unlock}
            className="mt-3 w-full rounded-xl bg-stone-900 text-white px-4 py-3 text-sm font-semibold
                       hover:bg-stone-800 transition-colors"
          >
            Unlock
          </button>
          {error && <p className="text-red-600 text-[13px] mt-3">{error}</p>}
        </div>
      </main>
    );
  }

  /* ─── Studio ─── */
  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight text-stone-900">Trace Studio</span>
          <button onClick={lock} className="text-xs text-stone-500 hover:text-stone-800 transition-colors">
            Lock
          </button>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 md:gap-8 items-start">
        {/* ─── Sidebar ─── */}
        <aside className="space-y-5">

          {/* Mode toggle */}
          <div>
            <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5 mt-2 bg-stone-100 rounded-xl p-1">
              {(["smart", "browse"] as CarouselMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                    mode === m
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {m === "smart" ? "✦ Smart Pick" : "Browse & Select"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
              {mode === "smart"
                ? "AI picks the best stories and rewrites headlines."
                : "Choose exactly which stories to include."}
            </p>
          </div>

          {/* Template */}
          <div>
            <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Template
            </label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TEMPLATES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setStyle(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    style === o.value
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  title={o.desc}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Smart mode: slide count */}
          {mode === "smart" && (
            <div>
              <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Slides
              </label>
              <div className="flex gap-1.5 mt-2">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSlideCount(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      slideCount === n
                        ? "bg-stone-900 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Browse mode: topic picker */}
          {mode === "browse" && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                  Stories
                </label>
                <div className="flex items-center gap-2">
                  {selectedTopicIds.size > 0 && (
                    <span className="text-[11px] font-semibold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-full">
                      {selectedTopicIds.size} selected
                    </span>
                  )}
                  <button
                    onClick={() => void loadBrowseTopics()}
                    className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-2 border border-stone-200 rounded-xl overflow-hidden bg-white">
                {browseLoading ? (
                  <div className="py-8 text-center text-xs text-stone-400">Loading stories…</div>
                ) : browseTopics.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">No stories found</div>
                ) : (
                  <div className="divide-y divide-stone-100 max-h-[420px] overflow-y-auto">
                    {browseTopics.map((topic) => {
                      const isSelected = selectedTopicIds.has(topic.id);
                      return (
                        <button
                          key={topic.id}
                          onClick={() => toggleTopic(topic.id)}
                          className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                            isSelected ? "bg-stone-50" : "hover:bg-stone-50"
                          }`}
                        >
                          {/* Thumbnail */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-stone-100 relative mt-0.5">
                            {topic.thumbnail ? (
                              <img
                                src={topic.thumbnail}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-stone-200" />
                            )}
                          </div>
                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${CATEGORY_COLORS[topic.category] || "bg-stone-100 text-stone-600"}`}>
                                {catTag(topic.category)}
                              </span>
                              {topic.sourceCount > 0 && (
                                <span className="text-[10px] text-stone-400">
                                  {topic.sourceCount} sources
                                </span>
                              )}
                            </div>
                            <div className={`text-[12px] leading-snug line-clamp-2 ${isSelected ? "text-stone-900 font-medium" : "text-stone-700"}`}>
                              {topic.title}
                            </div>
                          </div>
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-stone-900 border-stone-900"
                              : "border-stone-300"
                          }`}>
                            {isSelected && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedTopicIds.size > 0 && (
                <button
                  onClick={() => setSelectedTopicIds(new Set())}
                  className="mt-1.5 text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}

          {/* Generate */}
          <button
            onClick={() => void generate()}
            disabled={loading || (mode === "browse" && selectedTopicIds.size === 0)}
            className="w-full rounded-xl bg-stone-900 text-white px-4 py-2.5 text-sm font-medium
                       disabled:opacity-40 hover:bg-stone-800 transition-colors"
          >
            {loading
              ? "Generating\u2026"
              : mode === "smart"
              ? "Generate with AI"
              : selectedTopicIds.size === 0
              ? "Select stories first"
              : `Generate ${selectedTopicIds.size} slides`}
          </button>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          {deck && (
            <div className="text-xs text-stone-400">
              {deck.date} · {deck.count} slides
              {deck.mode && <span className="ml-1">· {deck.mode}</span>}
            </div>
          )}

          {/* Slide list */}
          {deck?.slides?.length ? (
            <div className="border-t border-stone-200 pt-4">
              <div className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">
                Slides
              </div>
              <div className="space-y-0.5">
                {deck.slides.map((slide, i) => {
                  const active = selected?.id === slide.id;
                  return (
                    <button
                      key={slide.id}
                      onClick={() => setSelectedId(slide.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-[11px] tabular-nums w-3 shrink-0 text-stone-400">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] ${active ? "text-stone-400" : "text-stone-500"}`}>
                            {slide.slideType === "cover" ? "Cover" : catTag(slide.category)}
                          </div>
                          <div className="text-[13px] font-medium truncate mt-0.5">
                            {slide.headline}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>

        {/* ─── Main ─── */}
        <div>
          {selected && previewUrl ? (
            <>
              <div className={`rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
                <div className="max-w-[440px] mx-auto aspect-4/5 rounded-xl overflow-hidden border border-stone-100 relative bg-stone-50">
                  <img
                    src={previewUrl}
                    alt={selected.headline}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const url = new URL(img.src, window.location.origin);
                      if (!url.searchParams.has("_noimg")) {
                        url.searchParams.set("imageUrl", "");
                        url.searchParams.set("_noimg", "1");
                        img.src = url.toString();
                      }
                    }}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <button onClick={() => move(-1)} className="text-xs text-stone-400 hover:text-stone-900 transition-colors">←</button>
                <div className="flex items-center gap-1.5">
                  {deck?.slides.map((slide) => (
                    <button
                      key={slide.id}
                      onClick={() => setSelectedId(slide.id)}
                      className={`rounded-full transition-all ${
                        selected.id === slide.id
                          ? "w-5 h-2 bg-stone-900"
                          : "w-2 h-2 bg-stone-300 hover:bg-stone-400"
                      }`}
                    />
                  ))}
                </div>
                <button onClick={() => move(1)} className="text-xs text-stone-400 hover:text-stone-900 transition-colors">→</button>
              </div>

              {/* Caption */}
              <div className="mt-6 rounded-xl border border-stone-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
                  <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Caption</span>
                  <button
                    onClick={copyCaption}
                    className="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <textarea
                  value={deck?.caption || ""}
                  readOnly
                  className="w-full px-4 py-3 text-[13px] text-stone-700 bg-transparent resize-none focus:outline-none"
                  rows={5}
                />
              </div>

              {/* Actions */}
              <div className="mt-4 space-y-3">
                {/* Post to Instagram */}
                <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
                    <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                      Post to Instagram
                    </span>
                    <button
                      onClick={() => { setShowSchedule((v) => !v); setPostResult(null); }}
                      className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      {showSchedule ? "Post now instead" : "Schedule"}
                    </button>
                  </div>

                  {showSchedule && (
                    <div className="px-4 py-3 border-b border-stone-100">
                      <label className="text-[11px] text-stone-500 block mb-1.5">Schedule for</label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-stone-900/10 bg-white"
                      />
                    </div>
                  )}

                  <div className="px-4 py-3">
                    {postResult ? (
                      postResult.ok ? (
                        <div className="flex items-start gap-2.5">
                          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                              <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[12px] font-medium text-stone-900">
                              {postResult.scheduled ? "Scheduled!" : "Posted to Instagram!"}
                            </p>
                            <p className="text-[11px] text-stone-400 mt-0.5">
                              {postResult.scheduled && postResult.scheduledAt
                                ? `Goes live ${new Date(postResult.scheduledAt).toLocaleString()}`
                                : `Post ID: ${postResult.postId}`}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2.5">
                          <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-red-500 text-[10px] font-bold">!</span>
                          </div>
                          <p className="text-[12px] text-red-600">{postResult.error}</p>
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => void postToInstagram()}
                        disabled={posting || !deck?.slides?.length}
                        className="w-full rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400
                                   text-white text-xs font-semibold py-2.5 px-4 disabled:opacity-50
                                   hover:opacity-90 transition-opacity"
                      >
                        {posting
                          ? "Rendering & posting\u2026"
                          : showSchedule && scheduledAt
                          ? `Schedule ${deck?.slides?.length ?? 0} slides`
                          : `Post ${deck?.slides?.length ?? 0} slides now`}
                      </button>
                    )}

                    {postResult && (
                      <button
                        onClick={() => setPostResult(null)}
                        className="mt-2 text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
                      >
                        Post again
                      </button>
                    )}
                  </div>
                </div>

                {/* Secondary actions */}
                <div className="flex flex-wrap gap-2">
                  {canShare ? (
                    <button
                      onClick={() => void shareAll()}
                      disabled={exporting}
                      className="text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200
                                 disabled:opacity-40 rounded-lg px-3 py-2 transition-colors"
                    >
                      {exporting ? "Preparing\u2026" : "Share All"}
                    </button>
                  ) : null}
                  <button
                    onClick={() => void downloadAll()}
                    disabled={exporting}
                    className="text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200
                               disabled:opacity-40 rounded-lg px-3 py-2 transition-colors"
                  >
                    {exporting ? "Downloading\u2026" : "Download All"}
                  </button>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200
                               rounded-lg px-3 py-2 transition-colors"
                  >
                    Open render ↗
                  </a>
                  {selected.storyUrl ? (
                    <a
                      href={selected.storyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200
                                 rounded-lg px-3 py-2 transition-colors"
                    >
                      View topic ↗
                    </a>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white aspect-4/5 max-w-[440px] mx-auto flex flex-col items-center justify-center gap-3 text-center px-6">
              {loading ? (
                <>
                  <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
                  <p className="text-sm text-stone-500">
                    {mode === "smart" ? "AI is picking and rewriting stories…" : "Building your carousel…"}
                  </p>
                </>
              ) : (
                <span className="text-sm text-stone-400">
                  {mode === "browse" && selectedTopicIds.size === 0
                    ? "Select stories from the left, then generate"
                    : "Generate a deck to preview"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
