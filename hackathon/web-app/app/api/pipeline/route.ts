import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10 min timeout

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) {
    return new Response('Missing URL', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const scriptPath = path.join(process.cwd(), '..', 'pipeline.py');
      const proc = spawn('python3', [scriptPath, url], {
        env: {
          ...process.env,
          RUNWAYML_API_SECRET: process.env.RUNWAYML_API_SECRET || '',
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
          PATH: process.env.PATH || '',
        },
        cwd: path.join(process.cwd(), '..'),
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            JSON.parse(line); // validate JSON
            send(line);
          } catch {
            send(JSON.stringify({ step: 'log', status: 'info', message: line }));
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
          send(JSON.stringify({ step: 'log', status: 'warn', message: text }));
        }
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          send(JSON.stringify({ step: 'error', status: 'error', message: `Pipeline exited with code ${code}` }));
        }
        controller.close();
      });

      proc.on('error', (err) => {
        send(JSON.stringify({ step: 'error', status: 'error', message: err.message }));
        controller.close();
      });

      req.signal.addEventListener('abort', () => {
        proc.kill();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
