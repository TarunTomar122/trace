import { NextRequest, NextResponse } from "next/server";
import { generateScript } from "@/lib/script";
import { ingestStories } from "@/lib/memory";
import { synthesizeToBuffer } from "@/lib/tts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stories, withAudio } = body as {
      stories: { title: string; summary: string; sources: string[]; entities: string[] }[];
      withAudio?: boolean;
    };
    if (!Array.isArray(stories) || stories.length === 0) {
      return NextResponse.json({ error: "Provide { stories: [...] }" }, { status: 400 });
    }

    // also ingest today's stories so memory grows (idempotent for MVP)
    const today = new Date().toISOString().slice(0, 10);
    await ingestStories(
      stories.map((s) => ({
        date: today,
        title: s.title,
        summary: s.summary,
        sources: s.sources,
        entities: s.entities,
      }))
    );

    const { script, callbacks, usedMemory } = await generateScript(stories);

    if (withAudio && process.env.OPENAI_API_KEY) {
      try {
        const buf = await synthesizeToBuffer(script);
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": "audio/mpeg",
            "X-Script": encodeURIComponent(script.slice(0, 2000)),
            "X-Memory": encodeURIComponent(JSON.stringify(usedMemory.slice(0, 3))),
          },
        });
      } catch (e: any) {
        // fall through to JSON
        return NextResponse.json({ script, callbacks, usedMemory, audioError: e.message });
      }
    }

    return NextResponse.json({ script, callbacks, usedMemory, audio: withAudio ? "add OPENAI_API_KEY to synthesize" : undefined });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

// GET for audio streaming when client already has script
export async function GET(req: NextRequest) {
  const script = req.nextUrl.searchParams.get("script");
  if (!script) return NextResponse.json({ error: "Provide ?script=" }, { status: 400 });
  try {
    const buf = await synthesizeToBuffer(decodeURIComponent(script));
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
