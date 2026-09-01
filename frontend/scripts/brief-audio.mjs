// Full episode: listener-persona insight script (gpt-5) -> seed_audio clone (npr-podcast, NATIVE pace) -> stitch.
// Run: node --env-file=.env frontend/scripts/brief-audio.mjs
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import OpenAI from 'openai';
import RunwayML from '@runwayml/sdk';

const exec = promisify(execFile);
const ROOT = '/Users/ttomar/Documents/personal/claudia';
const OUT_DIR = path.join(ROOT, 'brief-samples');
const SERVICE_ACCOUNT = path.join(ROOT, 'anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json');
const MODELS = (process.env.BRIEF_MODELS || 'gpt-5,gpt-4.1,gpt-4o').split(',').map((m) => m.trim());
const VOICE_REF = 'design-npr-podcast.mp3';
const SPEECH_RATE = 2;      // int; seed_audio NATIVE pace. No atempo — atempo squashes the natural pauses.
const TARGET_WORDS = 260;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getItems() {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(SERVICE_ACCOUNT) });
  const db = getFirestore();
  const snap = await db.collection('v3_user_feeds').doc('_global').collection('daily').orderBy('__name__', 'desc').limit(1).get();
  const trending = Array.isArray(snap.docs[0].data().trending) ? snap.docs[0].data().trending : [];
  return trending.map((it) => {
    const sa = it?.summary?.short_article || {};
    return {
      title: it?.title, subtitle: sa.subtitle || '',
      takeaways: Array.isArray(sa.key_takeaways) ? sa.key_takeaways : [],
      body: (sa.body || it?.description || '').replace(/\s+/g, ' ').slice(0, 700),
      source: it?.metadata?.why_relevant?.split('•').pop()?.trim() || '',
    };
  }).filter((x) => x.title).slice(0, 10);
}

const SYSTEM = `You're the friend everyone texts to understand AI, not just hear about it. You work in the field, you read everything, and you're great at turning news into something useful. You explain like a smart human, never a press release. Strong opinions, said plainly. A little funny. You can't stand fluff.

WHO YOU'RE TALKING TO (this is everything): one specific person. Sharp, ambitious, short on time. They're in tech, maybe an engineer, a designer, a founder-in-waiting. They want to do their own thing one day, get better at their craft, and not miss an opportunity while they're heads-down shipping. You know them. So you're not lecturing "builders" in general, you're telling THIS person what's actually worth their attention, and why it matters for where they're trying to go.

Your value is the so-what FOR THEM:
- Is there an opening here someone like them could run at? A skill or shift worth getting ahead of? A signal about where things are heading that they can use? A trap to sidestep?
- Give the event in one line, then the point: what it means for them, what you'd watch, what you'd learn or build. A real opinion, or a concrete bet.
- Vary how you land every story. Sometimes an opportunity, sometimes a heads-up, sometimes a doubt, sometimes just "this is the kind of thing that ends up mattering." Never the same shape twice.

KILL THE FORMULA (most important): do NOT end story after story with "if you're X, do Y." You're talking to ONE person, so just say "you", or say what you think. If two stories in a row land the same way, rewrite one. No rule-of-three lists either. Don't prefix insights with labels like "Translation:", "Signal:", "Opportunity:" — just say it.

How you talk:
- Start with a short warm greeting ("Hey, morning"), then straight in. No meta-windup ("the biggest thing", "this week").
- Out loud, like a person. Contractions, easy rhythm, the odd aside. Swing sentence length hard. One flowing conversation, no labels, no section titles.
- No fluff, no "at the end of the day", no "that's what I'm watching", no wrap-up bow. Point made, you stop.
- Respect their time. Every line earns its place.

On facts: the insight is yours, the specifics are the notes'. Use your own understanding freely for the so-what. But don't name-drop a company, product, person, number, or date that isn't in today's notes. Vague-but-true beats specific-but-made-up.

About ${TARGET_WORDS} words. Talk to them like you want them to win.`;

async function writeScript(items) {
  const itemList = items.map((s, i) => {
    const parts = [`[${i + 1}] ${s.title}${s.source ? ` (${s.source})` : ''}`];
    if (s.subtitle) parts.push(`    ${s.subtitle}`);
    if (s.takeaways.length) parts.push(`    Key: ${s.takeaways.join('; ')}`);
    if (s.body) parts.push(`    ${s.body}`);
    return parts.join('\n');
  }).join('\n\n');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const user = `Today's notes:\n\n${itemList}\n\nCatch me up. I've got no time and big plans, so tell me what actually matters for me and why.`;
  for (const model of MODELS) {
    try {
      const base = { model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] };
      let res;
      try { res = await openai.chat.completions.create({ ...base, temperature: 0.8 }); }
      catch (e) { if (/temperature|unsupported/i.test(String(e.message))) res = await openai.chat.completions.create(base); else throw e; }
      const out = res.choices?.[0]?.message?.content?.trim();
      if (out) { console.log(`[model] ${model}`); return out; }
    } catch (e) { console.log(`[model] ${model} unavailable: ${String(e.message).slice(0, 80)}`); }
  }
  throw new Error('no model worked');
}

function splitTwo(script) {
  const sentences = script.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [script];
  const half = script.split(/\s+/).length / 2;
  const a = []; const b = []; let count = 0;
  for (const s of sentences) {
    if (count < half) { a.push(s); count += s.split(/\s+/).length; } else b.push(s);
  }
  return [a.join('').trim(), b.join('').trim()].filter(Boolean);
}

async function seedChunk(text, refB64, idx) {
  const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY });
  const call = client.textToSpeech.create({
    model: 'seed_audio', promptText: text,
    voice: { audioUri: `data:audio/mp3;base64,${refB64}`, type: 'reference-audio' },
    speechRate: SPEECH_RATE, outputFormat: 'mp3',
  });
  const created = await call;
  let task;
  for (let i = 0; i < 90; i++) {
    task = await client.tasks.retrieve(created.id);
    if (task.status === 'SUCCEEDED' || task.status === 'FAILED') break;
    await sleep(2000);
  }
  if (!task || task.status !== 'SUCCEEDED') throw new Error(`chunk ${idx} status=${task?.status}`);
  const url = Array.isArray(task.output) ? task.output[0] : task.output;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const file = path.join(OUT_DIR, `._chunk${idx}.mp3`);
  await writeFile(file, buf);
  return { file, credits: created?.estimatedCost?.credits };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const items = await getItems();
  const script = await writeScript(items);
  const words = script.split(/\s+/).length;
  console.log(`\n===== SCRIPT (${words} words) =====\n${script}\n==================\n`);

  const refB64 = (await readFile(path.join(OUT_DIR, VOICE_REF))).toString('base64');
  const chunks = words <= 285 ? [script] : splitTwo(script);
  const parts = await Promise.all(chunks.map((c, i) => seedChunk(c, refB64, i)));
  const credits = parts.reduce((s, p) => s + (p.credits || 0), 0);

  const out = path.join(OUT_DIR, 'brief-npr-podcast-2min.mp3');
  if (parts.length === 1) {
    await exec('cp', [parts[0].file, out]); // no re-encode, cleanest audio
  } else {
    const inputs = parts.flatMap((p) => ['-i', p.file]);
    const filter = `${parts.map((_, i) => `[${i}:a]`).join('')}concat=n=${parts.length}:v=0:a=1[out]`;
    await exec('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-b:a', '128k', out]);
  }
  await exec('rm', ['-f', ...parts.map((p) => p.file)]);
  const dur = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).catch(() => ({ stdout: '?' }));
  console.log(`Done -> brief-samples/brief-npr-podcast-2min.mp3  (~${credits} cr, ${String(dur.stdout).trim()}s, native pace)`);
  await exec('open', [out]).catch(() => {});
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
