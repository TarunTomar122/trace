// Round 2: narrator voice, tuned faster + more human. Designs 3 variants + clones the liked
// narrator into the full brief at a brisker pace (seed_audio). Runway-only, free-ish.
// Run: node --env-file=.env frontend/scripts/voice-lab2.mjs
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import RunwayML from '@runwayml/sdk';

const ROOT = '/Users/ttomar/Documents/personal/claudia';
const OUT_DIR = path.join(ROOT, 'brief-samples');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SCRIPT = `Alteon, a Bengaluru startup, aims to keep aircraft aloft for a year. They just secured $2.5 million in pre-seed funding led by Lachy Groom. They're using dynamic soaring, inspired by the albatross, to harness energy from wind shear over oceans. This technique could make energy-neutral flight a reality and has been tested in over 200 flights. Initially, they're targeting maritime surveillance, offering governments persistent real-time monitoring. If Alteon achieves energy-neutral, year-long flight, it could redefine expectations for autonomous aircraft. I'll be watching to see if their technology can scale beyond maritime focus.`;

// All narrator-family, but pushed toward brisk + human/conversational.
const DESIGNS = [
  { label: 'npr-natural', prompt: 'A gentle, intelligent documentary narrator, mid-tone male, NPR style but conversational and human. Warm and relaxed, a natural brisk pace, sounds like a real person talking to you across a table, subtle natural breaths, not polished, not an announcer.' },
  { label: 'npr-brisk', prompt: 'A smart, warm male narrator, mid-tone, calm but with quiet energy and a fairly quick conversational pace. Human and easy, like a friend catching you up on the news, natural intonation and rhythm, no radio polish.' },
  { label: 'npr-podcast', prompt: 'An intelligent, personable male podcast host, mid-tone, clear and articulate with a lively but calm delivery. Human and natural, a touch faster than a documentary, engaging without any hype, like someone genuinely into the story.' },
];

const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY });

async function download(url, file) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(file, buf);
  return (buf.length / 1024).toFixed(0);
}

async function designPreview({ label, prompt }) {
  const p = await client.voices.preview({ model: 'eleven_ttv_v3', prompt });
  const file = path.join(OUT_DIR, `design-${label}.mp3`);
  const kb = await download(p.url, file);
  console.log(`[design] ${label.padEnd(14)} -> ${path.relative(ROOT, file)}  (${p.durationSecs.toFixed(0)}s, ${kb} KB)`);
}

async function seedClone(refName, label, speechRate) {
  const b64 = (await readFile(path.join(OUT_DIR, refName))).toString('base64');
  const call = client.textToSpeech.create({
    model: 'seed_audio',
    promptText: SCRIPT,
    voice: { audioUri: `data:audio/mp3;base64,${b64}`, type: 'reference-audio' },
    speechRate, // int: positive = faster
    outputFormat: 'mp3',
  });
  const created = await call;
  let task;
  for (let i = 0; i < 90; i++) {
    task = await client.tasks.retrieve(created.id);
    if (task.status === 'SUCCEEDED' || task.status === 'FAILED') break;
    await sleep(2000);
  }
  if (!task || task.status !== 'SUCCEEDED') throw new Error(`seedclone status=${task?.status}`);
  const url = Array.isArray(task.output) ? task.output[0] : task.output;
  const file = path.join(OUT_DIR, `brief-${label}.mp3`);
  const kb = await download(url, file);
  console.log(`[clone]  ${label.padEnd(14)} -> ${path.relative(ROOT, file)}  (${created?.estimatedCost?.credits} cr, ${kb} KB, FULL brief @ speed ${speechRate})`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all(DESIGNS.map((d) => designPreview(d).catch((e) => console.log(`[design] ${d.label} FAILED: ${e.message}`))));
  // Hear the narrator you liked on the real brief, a bit faster, via the cheap clone path.
  await seedClone('design-npr-narrator.mp3', 'seedclone-npr-fast', 2).catch((e) => console.log(`[clone] FAILED: ${e.message}`));
  console.log('\ndesign-* = new tuned variants (canned line). brief-seedclone-npr-fast = full brief in the narrator you liked.');
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
