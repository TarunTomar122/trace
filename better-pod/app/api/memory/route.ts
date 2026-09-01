import { NextRequest, NextResponse } from "next/server";
import { getStore, clearStore, queryMemory } from "@/lib/memory";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const k = Number(req.nextUrl.searchParams.get("k") ?? 8);
  const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
  if (q) {
    const res = await queryMemory(q, k, days);
    return NextResponse.json(res);
  }
  const store = await getStore();
  return NextResponse.json({
    stories: store.stories.length,
    threads: store.threads.length,
    storiesList: store.stories.slice(-20),
    threadsList: store.threads.slice(-20),
  });
}

export async function DELETE() {
  await clearStore();
  return NextResponse.json({ ok: true });
}
