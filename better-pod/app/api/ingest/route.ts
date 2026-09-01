import { NextRequest, NextResponse } from "next/server";
import { ingestStories } from "@/lib/memory";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stories = body.stories as { date: string; title: string; summary: string; sources: string[]; entities: string[] }[];
    if (!Array.isArray(stories) || stories.length === 0) {
      return NextResponse.json({ error: "Provide { stories: [{date,title,summary,sources,entities}] }" }, { status: 400 });
    }
    const store = await ingestStories(stories);
    return NextResponse.json({ ok: true, stories: store.stories.length, threads: store.threads.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
