import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  const outputsDir = path.join(process.cwd(), '..', 'outputs', videoId);

  if (!fs.existsSync(outputsDir)) {
    return NextResponse.json({ ok: false, error: 'No outputs found' });
  }

  // Check if avatar_id.json exists (saved by pipeline)
  const avatarInfoPath = path.join(outputsDir, 'avatar_info.json');
  if (fs.existsSync(avatarInfoPath)) {
    const info = JSON.parse(fs.readFileSync(avatarInfoPath, 'utf-8'));
    return NextResponse.json({ ok: true, ...info });
  }

  return NextResponse.json({ ok: false, error: 'No avatar found' });
}

export async function POST(req: NextRequest) {
  const { videoId, avatarId, name } = await req.json();

  if (!videoId || !avatarId) {
    return NextResponse.json({ error: 'Missing videoId or avatarId' }, { status: 400 });
  }

  const outputsDir = path.join(process.cwd(), '..', 'outputs', videoId);
  fs.mkdirSync(outputsDir, { recursive: true });

  const info = { avatarId, name: name || 'Character', videoId, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(outputsDir, 'avatar_info.json'), JSON.stringify(info));

  return NextResponse.json({ ok: true });
}
