// Brief spike v4 — real feed -> ONE-pass script (research-backed anti-AI prompt) -> seed_audio clone into both voices.
// Run: node --env-file=.env frontend/scripts/brief-spike.mjs
// ponytail: single pass, good model. Prompt built from humanizing research (voice samples > rules, rhythm swing, take a position).

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import RunwayML from '@runwayml/sdk';

const ROOT = '/Users/ttomar/Documents/personal/claudia';
const OUT_DIR = path.join(ROOT, 'brief-samples');
const SERVICE_ACCOUNT = path.join(ROOT, 'anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json');
const OPENAI_MODEL = process.env.BRIEF_OPENAI_MODEL || 'gpt-4o';
const TARGET_WORDS = 150;
const SPEECH_RATE = 2;

const VOICE_SETS = [
  { ref: 'design-npr-natural.mp3', label: 'npr-natural' },
  { ref: 'design-npr-podcast.mp3', label: 'npr-podcast' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FALLBACK_ITEMS = [
  { title: 'Anthropic details three unauthorized-access incidents on Claude', subtitle: 'Third-party misconfigs let attackers reach model internals.', takeaways: ['A leadership letter calls for industry coordination on AI safety.'], body: '', source: 'Anthropic' },
];

async function getItems() {
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (!getApps().length) initializeApp({ credential: cert(SERVICE_ACCOUNT) });
    const db = getFirestore();
    const snap = await db.collection('v3_user_feeds').doc('_global').collection('daily').orderBy('__name__', 'desc').limit(1).get();
    if (snap.empty) throw new Error('no global daily doc');
    const trending = Array.isArray(snap.docs[0].data().trending) ? snap.docs[0].data().trending : [];
    const items = trending.map((it) => {
      const sa = it?.summary?.short_article || {};
      return {
        title: it?.title,
        subtitle: sa.subtitle || '',
        takeaways: Array.isArray(sa.key_takeaways) ? sa.key_takeaways : [],
        body: (sa.body || it?.description || '').replace(/\s+/g, ' ').slice(0, 700),
        source: it?.metadata?.why_relevant?.split('•').pop()?.trim() || '',
      };
    }).filter((x) => x.title).slice(0, 8);
    if (!items.length) throw new Error('no items');
    console.log(`[feed] real feed: ${items.length} items from _global/${snap.docs[0].id}`);
    return items;
  } catch (e) {
    console.log(`[feed] fallback (${e.message})`);
    return FALLBACK_ITEMS;
  }
}

const SYSTEM = `You write a spoken ~${TARGET_WORDS}-word daily tech & AI brief. One voice, first person. You're a sharp friend who's obsessed with AI, catching someone up on their commute: calm, curious, opinionated. You react and think out loud. You do NOT summarize and you do NOT hype.

PICK: from the stories, choose the 2-3 a sharp tech person would actually care about today. Prefer real AI capability, research, or frontier-lab news over generic business, funding, or legal items.

FOR EACH: give the concrete fact fast (the real names and numbers), then say what YOU think about it, the non-obvious read: what it connects to, a second-order effect, a genuine doubt, or a small bet. Take an actual position on at least one story. One real opinion beats ten polished sentences.

SOUND LIKE A PERSON (this matters most):
- Write only words you'd say out loud. If you wouldn't say it to a friend, cut it.
- Swing the rhythm hard. Put a 4-word sentence next to a 28-word one. A one-word sentence is fine. Fragments are fine. Never let three sentences in a row have the same length or shape.
- Contractions always. Start sentences with And, But, or So when it's natural.
- Open cold, mid-thought, on the most interesting concrete detail. No "welcome", no "today", no rhetorical question, no scene-setting.
- Move between stories like someone connecting dots, not a list.
- Close on one thing you're actually watching or betting on. Never "the real question is" (that's a dodge). Say what you think.

AVOID (these are the tells):
- No rule-of-three (groups of three adjectives or phrases for rhythm).
- No "not just X, but Y" and no "it's not X, it's Y" constructions.
- No smoothing words: furthermore, moreover, additionally, it's worth noting, that said, in conclusion, ultimately.
- No: game-changer, underscores, landscape, realm, delve, dive in, keep an eye on, high-stakes, "data is currency", revolutionize, unlock, harness. No simile about speed or change. No exclamation-hype.
- Invent nothing. Only facts from the input: no date, number, or quote that isn't there.

Match THIS register (real lines from the writer, match the voice not the topic):
"I think the LLMs of today are magical. But the reason the Fortune 500 aren't using them to transform their workflows isn't because management is too stodgy."
"I'm skeptical. Given what little I know, here's why I'd bet against this."
"My probability distributions are super wide. And I do believe in probability distributions."

Output ONLY the spoken words. About ${TARGET_WORDS} words.`;

async function writeScript(items) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const itemList = items.map((s, i) => {
    const parts = [`[${i + 1}] ${s.title}${s.source ? ` (${s.source})` : ''}`];
    if (s.subtitle) parts.push(`    ${s.subtitle}`);
    if (s.takeaways.length) parts.push(`    Key: ${s.takeaways.join('; ')}`);
    if (s.body) parts.push(`    ${s.body}`);
    return parts.join('\n');
  }).join('\n\n');

  for (const model of [OPENAI_MODEL, 'gpt-4o-mini']) {
    try {
      const res = await openai.chat.completions.create({
        model, temperature: 0.85,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Today's stories:\n\n${itemList}\n\nWrite the brief now.` }],
      });
      const out = res.choices?.[0]?.message?.content?.trim();
      if (out) return { final: out, model };
    } catch (e) { console.log(`[llm] ${model} failed: ${e.message}`); }
  }
  throw new Error('LLM failed on all models');
}

async function seedClone(script, { ref, label }) {
  const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY });
  const b64 = (await readFile(path.join(OUT_DIR, ref))).toString('base64');
  const call = client.textToSpeech.create({
    model: 'seed_audio',
    promptText: script,
    voice: { audioUri: `data:audio/mp3;base64,${b64}`, type: 'reference-audio' },
    speechRate: SPEECH_RATE,
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
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const file = path.join(OUT_DIR, `brief-${label}.mp3`);
  await writeFile(file, buf);
  return { label, file, credits: created?.estimatedCost?.credits, kb: (buf.length / 1024).toFixed(0) };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const items = await getItems();
  const { final, model } = await writeScript(items);
  const words = final.split(/\s+/).length;
  console.log(`\n===== SCRIPT (${model}, ${words} words, ~${Math.round(words / 2.5)}s) =====\n${final}\n==================\n`);

  const settled = await Promise.all(VOICE_SETS.map(async (set) => {
    try {
      const r = await seedClone(final, set);
      console.log(`[voice] ${set.label.padEnd(12)} -> ${path.relative(ROOT, r.file)}  (${r.credits} cr, ${r.kb} KB)`);
      return r;
    } catch (e) { console.log(`[voice] ${set.label.padEnd(12)} FAILED: ${e.message}`); return null; }
  }));
  console.log(`\nDone. ${settled.filter(Boolean).length}/${VOICE_SETS.length} episodes. Listen: brief-npr-natural.mp3, brief-npr-podcast.mp3`);
}

main().catch((e) => { console.error('SPIKE FAILED:', e); process.exit(1); });
