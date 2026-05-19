import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  const { step, videoId, speaker, voiceStart, voiceEnd, voiceId, frameIndex } = await req.json();

  const scriptPath = path.join(process.cwd(), '..', 'steps.py');
  const args = [scriptPath, step, videoId || ''];

  if (speaker) args.push(speaker);
  if (voiceStart !== undefined) args.push(String(voiceStart));
  if (voiceEnd !== undefined) args.push(String(voiceEnd));
  if (voiceId) args.push(voiceId);
  if (frameIndex !== undefined) args.push(String(frameIndex));

  try {
    const output = execSync(`python3 ${args.map(a => `"${a}"`).join(' ')}`, {
      env: {
        ...process.env,
        RUNWAYML_API_SECRET: process.env.RUNWAYML_API_SECRET || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        PATH: process.env.PATH || '',
      },
      cwd: path.join(process.cwd(), '..'),
      timeout: 300000,
      maxBuffer: 1024 * 1024,
    });

    const result = JSON.parse(output.toString().trim());
    return NextResponse.json(result);
  } catch (e: any) {
    try {
      const err = JSON.parse(e.stdout?.toString()?.trim() || '{}');
      return NextResponse.json(err, { status: 500 });
    } catch {
      return NextResponse.json({ ok: false, error: e.message || 'Step failed' }, { status: 500 });
    }
  }
}
