"use client";

import { useState } from "react";

const SAMPLE_TODAY = [
  {
    title: "Anthropic raises $40B at $170B valuation",
    summary: "Anthropic closed a $40B round led by SoftBank to scale Claude and buy TSMC capacity. The deal prices compute as the moat.",
    sources: ["TechCrunch filing"],
    entities: ["Anthropic", "TSMC", "SoftBank"],
  },
  {
    title: "OpenAI ships o3 reasoning model",
    summary: "o3 scores 92% on MATH and shows chain-of-thought traces. Safety team noted a quiet pivot on evals.",
    sources: ["The Verge", "ArXiv 2312.04567"],
    entities: ["OpenAI", "o3"],
  },
  {
    title: "Wired: GPU prices spike again",
    summary: "Spot H100s up 18% week over week as fab allocation tightens. TSMC memo from March flagged this.",
    sources: ["Wired", "Reuters"],
    entities: ["TSMC", "Wired"],
  },
];

export default function StudioPage() {
  const [storiesJson, setStoriesJson] = useState(JSON.stringify(SAMPLE_TODAY, null, 2));
  const [script, setScript] = useState<string>("");
  const [memory, setMemory] = useState<any[]>([]);
  const [callbacks, setCallbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  async function generate(withAudio = false) {
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const stories = JSON.parse(storiesJson);
      const res = await fetch("/api/pod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stories, withAudio }),
      });
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("audio/mpeg")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const xScript = res.headers.get("X-Script");
        if (xScript) setScript(decodeURIComponent(xScript));
        const xMem = res.headers.get("X-Memory");
        if (xMem) setMemory(JSON.parse(decodeURIComponent(xMem)));
      } else {
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setScript(json.script);
        setMemory(json.usedMemory ?? []);
        setCallbacks(json.callbacks ?? []);
        if (json.audio) setError(json.audio);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function seedMock() {
    const mock30 = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return {
        date: d,
        title: i % 3 === 0 ? "TSMC memo: why fabs decide model pricing" : i % 3 === 1 ? "OpenAI o3 early eval" : "Anthropic compute bet scales",
        summary: i % 3 === 0 ? "TSMC internal memo argued fab allocation is the real pricing lever for frontier models." : i % 3 === 1 ? "o3 showed reasoning gains but safety evals were light." : "Anthropic bet $1.2B on reserved compute for Claude 4.",
        sources: ["Wired"],
        entities: ["TSMC", "Anthropic", "OpenAI"],
      };
    });
    const res = await fetch("/api/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stories: mock30 }) });
    const j = await res.json();
    alert(`Seeded: ${j.stories} stories, ${j.threads} threads. Now generate today's.`);
  }

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-[#131413]">
      <div className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-eb-garamond text-[28px] font-normal tracking-[-0.02em] text-[#131413]" style={{ fontFamily: "var(--font-eb-garamond)" }}>
            Better Pod Studio <span className="font-figtree text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9aa09c]">MVP</span>
          </h1>
          <a href="/" className="rounded-full border border-[#e6ebe3] bg-white px-4 py-2 font-figtree text-[13px] font-medium text-[#131413]">
            Back to landing
          </a>
        </div>
        <p className="mt-2 max-w-[680px] font-figtree text-[13px] leading-[1.6] text-[#7a8178]">
          1. Paste today’s 7 stories. 2. Memory pulls last 30 days. 3. Script weaves callbacks. 4. TTS if you add OPENAI_API_KEY. No key needed to test script and memory.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={seedMock} className="rounded-full border border-[#131413] bg-white px-4 py-2 font-figtree text-[13px] font-semibold text-[#131413]">
            Seed 30-day mock history
          </button>
          <a href="/api/memory" target="_blank" className="rounded-full bg-[#131413] px-4 py-2 font-figtree text-[13px] font-semibold text-white">
            View memory →
          </a>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <label className="font-figtree text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9aa09c]">Today’s stories JSON (edit and generate)</label>
            <textarea value={storiesJson} onChange={(e) => setStoriesJson(e.target.value)} rows={18} className="mt-2 w-full rounded-[16px] border-[1.5px] border-[#e6ebe3] bg-white p-4 font-mono text-[12px] leading-[1.6] text-[#131413] focus:border-[#131413] focus:outline-none" />
            <div className="mt-3 flex gap-2">
              <button onClick={() => generate(false)} disabled={loading} className="rounded-[12px] border-[1.5px] border-[#131413] bg-[#ddf08a] px-5 py-3 font-figtree text-[13px] font-semibold text-[#131413] disabled:opacity-50">
                {loading ? "Generating..." : "Generate script (no audio)"}
              </button>
              <button onClick={() => generate(true)} disabled={loading} className="rounded-[12px] border border-[#e6ebe3] bg-white px-5 py-3 font-figtree text-[13px] font-semibold text-[#131413] disabled:opacity-50">
                Generate + TTS
              </button>
            </div>
            {error && <p className="mt-3 rounded-[12px] bg-[#ffeaea] px-4 py-3 font-figtree text-[12px] text-[#9a2a2a]">{error}</p>}
          </div>

          <div>
            <div className="rounded-[16px] border border-[#e6ebe3] bg-white p-5">
              <h3 className="font-figtree text-[13px] font-semibold text-[#131413]">Script (humanized)</h3>
              <p className="mt-1 font-figtree text-[11px] text-[#9aa09c]">Cold open with callback, 7 stories woven, no em dashes, no delving.</p>
              <pre className="mt-3 max-h-[380px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] bg-[#f6f8f1] p-4 font-figtree text-[13px] leading-[1.7] text-[#131413]">{script || "— generate to see script —"}</pre>
              {audioUrl && (
                <div className="mt-4">
                  <p className="font-figtree text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9aa09c]">Audio</p>
                  <audio controls src={audioUrl} className="mt-2 w-full" />
                </div>
              )}
            </div>

            <div className="mt-4 rounded-[16px] border border-[#e6ebe3] bg-[#f6f8f1] p-5">
              <h4 className="font-figtree text-[12px] font-semibold text-[#131413]">Memory used (30 days)</h4>
              <div className="mt-2 space-y-2">
                {memory.length ? (
                  memory.map((m: any, i: number) => (
                    <div key={i} className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-[#e6ebe3]">
                      <p className="font-figtree text-[11px] font-semibold text-[#9aa09c]">{m.date}</p>
                      <p className="font-figtree text-[12px] font-medium text-[#131413]">{m.oneLine}</p>
                    </div>
                  ))
                ) : (
                  <p className="font-figtree text-[12px] text-[#9aa09c]">No memory yet — seed 30-day history above.</p>
                )}
              </div>
              {callbacks.length > 0 && (
                <>
                  <h4 className="mt-4 font-figtree text-[12px] font-semibold text-[#131413]">Callbacks woven</h4>
                  <div className="mt-2 space-y-1">
                    {callbacks.map((c: any, i: number) => (
                      <p key={i} className="font-figtree text-[11px] leading-[1.5] text-[#5a5f5a]">
                        <span className="font-semibold text-[#131413]">{c.storyTitle.slice(0, 32)}:</span> {c.memoryLine.slice(0, 80)}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
