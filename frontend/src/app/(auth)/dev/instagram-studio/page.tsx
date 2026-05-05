"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";

type CarouselCategory = "all" | "ai" | "tech" | "world";
type CarouselStyle = "mixed" | "editorial" | "signal" | "spotlight";

type StudioImageFormat = "square" | "portrait" | "story";

type Slide = {
  id: string;
  slideType: "cover" | "story" | "detail";
  style: Exclude<CarouselStyle, "mixed">;
  headline: string;
  kicker: string;
  body: string;
  imageUrl: string;
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
  title: string;
  tagline: string;
  count: number;
  caption: string;
  slides: Slide[];
};

const KEY = "trace_instagram_studio_key";

const CATEGORIES: Array<{ value: CarouselCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "tech", label: "Tech" },
  { value: "world", label: "World" },
];

const TEMPLATES: Array<{ value: CarouselStyle; label: string; desc: string }> = [
  { value: "mixed", label: "Mixed", desc: "Rotates all styles" },
  { value: "editorial", label: "Editorial", desc: "Warm cream" },
  { value: "signal", label: "Signal", desc: "Dark mode" },
  { value: "spotlight", label: "Spotlight", desc: "White + accent" },
];

const COUNTS = [4, 5, 6, 7, 8];

const IMAGE_FORMAT_OPTIONS: Array<{ value: StudioImageFormat; label: string; hint: string }> = [
  { value: "square", label: "Square", hint: "1080×1080 feed" },
  { value: "portrait", label: "4:5", hint: "1080×1350 feed" },
  { value: "story", label: "Story", hint: "1080×1920" },
];

function catTag(v: string) {
  return v === "ai" ? "AI" : v === "world" ? "World" : "Tech";
}

function slideKindLabel(slide: Slide) {
  if (slide.slideType === "cover") return "Cover";
  if (slide.slideType === "detail") return `${catTag(slide.category)} · Detail`;
  return `${catTag(slide.category)} · Intro`;
}

function srcLine(names: string[]) {
  if (!names.length) return "";
  return names.slice(0, 4).join(" · ");
}

export default function InstagramStudioPage() {
  const [keyInput, setKeyInput] = useState("");
  const [studioKey, setStudioKey] = useState("");
  const [category, setCategory] = useState<CarouselCategory>("all");
  const [style, setStyle] = useState<CarouselStyle>("mixed");
  const [slideCount, setSlideCount] = useState(5);
  const [deck, setDeck] = useState<CarouselDeck | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [imageFormat, setImageFormat] = useState<StudioImageFormat>("portrait");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(KEY) || "";
    if (saved) {
      setStudioKey(saved);
      setKeyInput(saved);
    }
  }, []);

  const withAuth = useCallback(
    (init?: RequestInit): RequestInit => {
      const headers = new Headers(init?.headers || {});
      if (studioKey) headers.set("x-studio-key", studioKey);
      return { ...init, headers };
    },
    [studioKey],
  );

  const generate = useCallback(async () => {
    if (!studioKey) {
      setError("Enter studio key.");
      return;
    }
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const params = new URLSearchParams({
        category,
        style,
        slides: String(slideCount),
      });
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
  }, [category, slideCount, studioKey, style, withAuth]);

  useEffect(() => {
    if (!studioKey) return;
    void generate();
  }, [generate, studioKey]);

  const unlock = () => {
    const k = keyInput.trim();
    if (!k) {
      setError("Enter a key.");
      return;
    }
    setError("");
    setStudioKey(k);
    if (typeof window !== "undefined")
      window.sessionStorage.setItem(KEY, k);
  };

  const lock = () => {
    setStudioKey("");
    setKeyInput("");
    setDeck(null);
    setSelectedId("");
    if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
  };

  const selected = useMemo(
    () =>
      deck?.slides.find((s) => s.id === selectedId) ||
      deck?.slides[0] ||
      null,
    [deck, selectedId],
  );

  const selectedIndex = useMemo(
    () =>
      deck && selected
        ? deck.slides.findIndex((s) => s.id === selected.id)
        : -1,
    [deck, selected],
  );

  const previewUrl = useMemo(() => {
    if (!selected || !studioKey || !deck) return "";
    const params = new URLSearchParams({
      mode: "carousel",
      format: imageFormat,
      style: selected.style,
      slideType: selected.slideType,
      headline: selected.headline,
      kicker: selected.kicker,
      body: selected.body,
      imageUrl: selected.imageUrl || "",
      sources: srcLine(selected.sourceNames),
      index: String(
        (deck.slides.findIndex((s) => s.id === selected.id) || 0) + 1,
      ),
      total: String(deck.slides.length),
      key: studioKey,
      t: String(Date.now()),
    });
    return `/api/dev/instagram/studio/render?${params}`;
  }, [deck, imageFormat, selected, studioKey]);

  const copyCaption = async () => {
    if (!deck?.caption) return;
    try {
      await navigator.clipboard.writeText(deck.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const move = (dir: -1 | 1) => {
    if (!deck?.slides?.length || selectedIndex < 0) return;
    const next =
      (selectedIndex + dir + deck.slides.length) % deck.slides.length;
    setSelectedId(deck.slides[next]?.id || "");
  };

  const buildSlideUrl = useCallback(
    (slide: Slide, index: number) => {
      if (!deck || !studioKey) return "";
      const params = new URLSearchParams({
        mode: "carousel",
        format: imageFormat,
        style: slide.style,
        slideType: slide.slideType,
        headline: slide.headline,
        kicker: slide.kicker,
        body: slide.body,
        imageUrl: slide.imageUrl || "",
        sources: srcLine(slide.sourceNames),
        index: String(index + 1),
        total: String(deck.slides.length),
        key: studioKey,
      });
      return `/api/dev/instagram/studio/render?${params}`;
    },
    [deck, imageFormat, studioKey],
  );

  const fetchAllSlideBlobs = useCallback(async (): Promise<File[]> => {
    if (!deck?.slides?.length) return [];
    const files = await Promise.all(
      deck.slides.map(async (slide, i) => {
        const url = buildSlideUrl(slide, i);
        if (!url) return null;
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], `trace-slide-${i + 1}.png`, {
          type: "image/png",
        });
      }),
    );
    return files.filter((f): f is File => f !== null);
  }, [deck, buildSlideUrl]);

  const [exporting, setExporting] = useState(false);

  const downloadAll = useCallback(async () => {
    if (!deck?.slides?.length) return;
    setExporting(true);
    try {
      const files = await fetchAllSlideBlobs();
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setExporting(false);
    }
  }, [deck, fetchAllSlideBlobs]);

  const canShare =
    typeof navigator !== "undefined" &&
    !!navigator.share &&
    !!navigator.canShare;

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
      if ((e as Error)?.name !== "AbortError") {
        await downloadAll();
      }
    } finally {
      setExporting(false);
    }
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
            Enter your access key to build Instagram carousels from today&apos;s
            strongest stories.
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
          {error && (
            <p className="text-red-600 text-[13px] mt-3">{error}</p>
          )}
        </div>
      </main>
    );
  }

  /* ─── Studio ─── */
  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-[1140px] mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight text-stone-900">
            Trace Studio
          </span>
          <button
            onClick={lock}
            className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
          >
            Lock
          </button>
        </div>
      </header>

      <div className="max-w-[1140px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 md:gap-8 items-start">
        {/* ─── Sidebar ─── */}
        <aside className="space-y-5">
          {/* Category */}
          <div>
            <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CATEGORIES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setCategory(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    category === o.value
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
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

          <div>
            <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Canvas
            </label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {IMAGE_FORMAT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setImageFormat(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    imageFormat === o.value
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                  title={o.hint}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
              Default is 4:5 portrait feed. Pick Square for 1:1 or Story for 9:16.
            </p>
          </div>

          {/* Slide count */}
          <div>
            <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Stories
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

          {/* Generate */}
          <button
            onClick={() => void generate()}
            disabled={loading}
            className="w-full rounded-xl bg-stone-900 text-white px-4 py-2.5 text-sm font-medium
                       disabled:opacity-40 hover:bg-stone-800 transition-colors"
          >
            {loading ? "Generating\u2026" : "Generate"}
          </button>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          {deck && (
            <div className="text-xs text-stone-400">
              {deck.date} · {deck.count} slides
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
                        active
                          ? "bg-stone-900 text-white"
                          : "text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <div className="flex items-baseline gap-2.5">
                        <span
                          className={`text-[11px] tabular-nums w-3 shrink-0 ${
                            active ? "text-stone-400" : "text-stone-400"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-[11px] ${
                              active ? "text-stone-400" : "text-stone-500"
                            }`}
                          >
                            {slideKindLabel(slide)}
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
              {/* Preview */}
              <div
                className={`rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 transition-opacity ${
                  loading ? "opacity-50" : ""
                }`}
              >
                <div
                  className={`max-w-[440px] mx-auto rounded-xl overflow-hidden border border-stone-100 relative bg-stone-50 ${
                    imageFormat === "square"
                      ? "aspect-square"
                      : imageFormat === "story"
                        ? "aspect-9/16"
                        : "aspect-4/5"
                  }`}
                >
                  <img
                    src={previewUrl}
                    alt={selected.headline}
                    className="w-full h-full object-contain"
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
                <button
                  onClick={() => move(-1)}
                  className="text-xs text-stone-400 hover:text-stone-900 transition-colors"
                >
                  ←
                </button>
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
                <button
                  onClick={() => move(1)}
                  className="text-xs text-stone-400 hover:text-stone-900 transition-colors"
                >
                  →
                </button>
              </div>

              {/* Caption */}
              <div className="mt-6 rounded-xl border border-stone-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
                  <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                    Caption
                  </span>
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
              <div className="mt-4 flex flex-wrap gap-2">
                {canShare ? (
                  <button
                    onClick={() => void shareAll()}
                    disabled={exporting}
                    className="text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800
                               disabled:opacity-40 rounded-lg px-4 py-2 transition-colors"
                  >
                    {exporting ? "Preparing\u2026" : "Share All Slides"}
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
            </>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white aspect-square max-w-[440px] mx-auto flex items-center justify-center">
              <span className="text-sm text-stone-400">
                Generate a deck to preview
              </span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
