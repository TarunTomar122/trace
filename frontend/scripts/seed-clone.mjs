// Speak the real brief in a created voice via seed_audio cloning (cheap, Runway-only, audio path).
// Usage: node --env-file=.env frontend/scripts/seed-clone.mjs design-soft-contemplative.mp3
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RunwayML from '@runwayml/sdk';

const ROOT = '/Users/ttomar/Documents/personal/claudia';
const OUT_DIR = path.join(ROOT, 'brief-samples');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SCRIPT = `Alteon, a Bengaluru startup, aims to keep aircraft aloft for a year. They just secured $2.5 million in pre-seed funding led by Lachy Groom. They're using dynamic soaring, inspired by the albatross, to harness energy from wind shear over oceans. This technique could make energy-neutral flight a reality and has been tested in over 200 flights. Initially, they're targeting maritime surveillance, offering governments persistent real-time monitoring. If Alteon achieves energy-neutral, year-long flight, it could redefine expectations for autonomous aircraft. I'll be watching to see if their technology can scale beyond maritime focus.`;

const refName = process.argv[2] || 'design-soft-contemplative.mp3';
const refPath = path.isAbsolute(refName) ? refName : path.join(OUT_DIR, refName);
const label = path.basename(refPath, '.mp3').replace('design-', '');

const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY });

const b64 = (await readFile(refPath)).toString('base64');
const call = client.textToSpeech.create({
  model: 'seed_audio',
  promptText: SCRIPT,
  voice: { audioUri: `data:audio/mp3;base64,${b64}`, type: 'reference-audio' },
  outputFormat: 'mp3',
});
const created = await call;
let task;
for (let i = 0; i < 90; i++) {
  task = await client.tasks.retrieve(created.id);
  if (task.status === 'SUCCEEDED' || task.status === 'FAILED') break;
  await sleep(2000);
}
if (!task || task.status !== 'SUCCEEDED') throw new Error(`status=${task?.status} ${JSON.stringify(task?.failure || '').slice(0, 200)}`);
const url = Array.isArray(task.output) ? task.output[0] : task.output;
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
const out = path.join(OUT_DIR, `brief-seedclone-${label}.mp3`);
await writeFile(out, buf);
console.log(`seedclone(${label}) -> ${path.relative(ROOT, out)}  (${created?.estimatedCost?.credits} cr, ${(buf.length / 1024).toFixed(0)} KB)`);
