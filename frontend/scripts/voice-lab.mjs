// Voice creation lab: design voices from text prompts (Runway voices.preview) + clone one into the
// real brief via seed_audio. Answers "can I create my own voice on Runway (free)?"
// Run: node --env-file=.env frontend/scripts/voice-lab.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import RunwayML from '@runwayml/sdk';

const ROOT = '/Users/ttomar/Documents/personal/claudia';
const OUT_DIR = path.join(ROOT, 'brief-samples');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The grounded Alteon brief from the last run.
const SCRIPT = `Alteon, a Bengaluru startup, aims to keep aircraft aloft for a year. They just secured $2.5 million in pre-seed funding led by Lachy Groom. They're using dynamic soaring, inspired by the albatross, to harness energy from wind shear over oceans. This technique could make energy-neutral flight a reality and has been tested in over 200 flights. Initially, they're targeting maritime surveillance, offering governments persistent real-time monitoring. If Alteon achieves energy-neutral, year-long flight, it could redefine expectations for autonomous aircraft. I'll be watching to see if their technology can scale beyond maritime focus.`;

const DESIGNS = [
  { label: 'calm-intellectual', prompt: 'A calm, thoughtful man in his late twenties. Measured, unhurried pace with natural pauses. Warm but intellectual, like a curious podcast host explaining something he finds genuinely fascinating. Neutral American accent, soft-spoken, no radio-announcer polish.' },
  { label: 'soft-contemplative', prompt: 'A soft, articulate male voice, early thirties, contemplative and understated. Speaks slowly and clearly, like someone thinking out loud. Slight warmth, dry intelligence, intimate and close-miked, no hype and no drama.' },
  { label: 'npr-narrator', prompt: 'A gentle, intelligent documentary narrator, mid-tone male, relaxed and reassuring. NPR style, precise diction, calm and steady, the sound of someone you trust telling you what matters.' },
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
  console.log(`[design]  ${label.padEnd(18)} -> ${path.relative(ROOT, file)}  (${p.durationSecs}s, ${kb} KB)`);
  return { label, url: p.url };
}

async function seedClone(refUrl, label) {
  const call = client.textToSpeech.create({
    model: 'seed_audio',
    promptText: SCRIPT,
    voice: { audioUri: refUrl, type: 'reference-audio' },
    speechRate: -0.05, // a touch slower = calmer
    outputFormat: 'mp3',
  });
  const created = await call;
  let task;
  for (let i = 0; i < 90; i++) {
    task = await client.tasks.retrieve(created.id);
    if (task.status === 'SUCCEEDED' || task.status === 'FAILED') break;
    await sleep(2000);
  }
  if (!task || task.status !== 'SUCCEEDED') throw new Error(`seed clone status=${task?.status}`);
  const url = Array.isArray(task.output) ? task.output[0] : task.output;
  const file = path.join(OUT_DIR, `brief-seedclone-${label}.mp3`);
  const kb = await download(url, file);
  console.log(`[clone]   ${label.padEnd(18)} -> ${path.relative(ROOT, file)}  (${created?.estimatedCost?.credits} cr, ${kb} KB, full brief)`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const designs = [];
  for (const d of DESIGNS) {
    try { designs.push(await designPreview(d)); }
    catch (e) { console.log(`[design]  ${d.label} FAILED: ${e.message}`); }
  }
  // Clone the first successful designed voice into the actual brief so you hear it on real content.
  if (designs[0]) {
    try { await seedClone(designs[0].url, designs[0].label); }
    catch (e) { console.log(`[clone] FAILED: ${e.message}`); }
  }
  console.log('\nDesigned-voice previews say a canned line (judge the timbre). The seedclone speaks the real brief.');
}

main().catch((e) => { console.error('VOICE LAB FAILED:', e); process.exit(1); });
