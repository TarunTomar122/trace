import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  const { videoId, message, history } = await req.json();

  if (!videoId || !message) {
    return NextResponse.json({ error: 'Missing videoId or message' }, { status: 400 });
  }

  const scriptPath = path.join(process.cwd(), '..', 'steps.py');
  const escapedMsg = message.replace(/"/g, '\\"').replace(/\\/g, '\\\\');

  try {
    const output = execSync(`python3 "${scriptPath}" chat "${videoId}" "${escapedMsg}"`, {
      env: {
        ...process.env,
        RUNWAYML_API_SECRET: process.env.RUNWAYML_API_SECRET || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        PATH: process.env.PATH || '',
      },
      cwd: path.join(process.cwd(), '..'),
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });

    const result = JSON.parse(output.toString().trim());
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'Chat failed' }, { status: 500 });
  }
}
