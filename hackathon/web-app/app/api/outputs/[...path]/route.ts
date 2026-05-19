import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;
  const filePath = path.join(process.cwd(), '..', 'outputs', ...pathSegments);

  if (!existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = filePath.split('.').pop()?.toLowerCase();
  const mime: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', mp3: 'audio/mpeg',
  };

  return new NextResponse(readFileSync(filePath), {
    headers: { 'Content-Type': mime[ext || ''] || 'application/octet-stream', 'Cache-Control': 'no-cache' },
  });
}
