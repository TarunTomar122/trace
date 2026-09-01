// TTS — OpenAI if key, else mock silent/URL
export async function synthesize(script: string): Promise<{ audioUrl: string | null; durationSec: number }> {
  const text = script.slice(0, 4000); // 12 min ~ 1800 words ~ 10k chars, trim for MVP
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { audioUrl: null, durationSec: Math.ceil(text.split(/\s+/).length / 2.5) }; // ~150 wpm
  }
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: key });
    // Note: in Next.js route we would return the MP3 bytes, here we just mock URL
    // For MVP we skip actual synthesis to avoid large payloads — caller can fetch via /api/pod?audio=1
    const mp3 = await client.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text.slice(0, 3500),
      speed: 1.0,
    });
    // we don't save file in this helper — route does
    // @ts-ignore — mp3 is Response
    const buf = Buffer.from(await (mp3 as any).arrayBuffer());
    const b64 = buf.toString("base64");
    return { audioUrl: `data:audio/mpeg;base64,${b64.slice(0, 80)}...`, durationSec: Math.ceil(text.split(/\s+/).length / 2.5) };
  } catch {
    return { audioUrl: null, durationSec: Math.ceil(text.split(/\s+/).length / 2.5) };
  }
}

// helper for API route to directly stream MP3
export async function synthesizeToBuffer(script: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key });
  const mp3 = await client.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: script.slice(0, 3800),
  });
  // @ts-ignore
  const buf = Buffer.from(await (mp3 as any).arrayBuffer());
  return buf;
}
