// Text-only brief generator, personalized for one profile.
// Run: node --env-file=.env frontend/scripts/brief-text.mjs [profiles/hackathon-founder.v1.json]
// Enrichment (optional): FIRECRAWL_URL=https://<your-firecrawl>  [FIRECRAWL_API_KEY=...]
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import OpenAI from 'openai';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(ROOT, 'brief-samples', 'text');
const MODELS = (process.env.BRIEF_MODELS || 'gpt-5,gpt-4.1,gpt-4o').split(',').map((m) => m.trim());

const profileArg = process.argv[2] || 'profiles/hackathon-founder.v1.json';
const PROFILE = JSON.parse(await readFile(path.join(HERE, profileArg), 'utf8'));

async function getItems() {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.startsWith('.')
    ? path.join(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT_PATH.slice(2))
    : process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(ROOT, 'anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json');
  if (!getApps().length) initializeApp({ credential: cert(saPath) });
  const db = getFirestore();
  const snap = await db.collection('v3_user_feeds').doc('_global').collection('daily').orderBy('__name__', 'desc').limit(1).get();
  const trending = snap.docs[0].data().trending || [];
  return trending.map((it) => {
    const sa = it?.summary?.short_article || {};
    return {
      title: it.title, url: it.url || '',
      source: it.source_name || '', interest_id: it.interest_id || '',
      hot: !!it?.metadata?.is_hot, trend_score: it?.metadata?.trend_score || 0,
      published: it.published_date || '',
      subtitle: sa.subtitle || '',
      takeaways: Array.isArray(sa.key_takeaways) ? sa.key_takeaways : [],
      body: (sa.body || it.description || '').replace(/\s+/g, ' ').trim(),
    };
  }).filter((x) => x.title);
}

const KW = {
  'AI models': ['claude', 'gpt', 'openai', 'anthropic', 'gemini', 'model', 'llm', 'deepmind', 'agent'],
  'Startups': ['startup', 'founder', 'launch', 'app', 'yc'],
  'Funding': ['raise', 'funding', 'valuation', 'round', 'ipo', 'acqui', 'revenue', 'earnings'],
  'Big tech': ['apple', 'google', 'microsoft', 'amazon', 'meta', 'nvidia', 'oracle'],
  'Agents & tools': ['agent', 'automation', 'api', 'workflow', 'copilot', 'no-code', 'vibe'],
  'Hardware & robotics': ['chip', 'semiconductor', 'hardware', 'robot', 'gpu', 'data center', 'server'],
  'Security': ['security', 'hack', 'breach', 'cyber', 'vulnerability'],
  'Dev tooling': ['developer', 'code', 'coding', 'sdk', 'framework', 'repo'],
  'Design & UX': ['design', 'ux', 'interface', 'design'],
  'Open source': ['open-source', 'opensource', 'oss'],
  'Markets': ['stock', 'shares', 'market', 'etf', 'fund'],
  'Policy': ['policy', 'regulation', 'law'],
};

function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'); }

function scoreItem(it, profile) {
  let s = 0;
  const id = norm(it.interest_id);
  const hay = (it.title + ' ' + it.body + ' ' + it.subtitle).toLowerCase();
  for (const interest of profile.interests) {
    if (id === norm(interest) || id.includes(norm(interest).slice(0, 4))) s += 2;
    if ((KW[interest] || []).some((k) => hay.includes(k))) s += 1;
  }
  if (it.hot && it.trend_score >= 3) s += 1;
  const ageH = (Date.now() - new Date(it.published).getTime()) / 36e5;
  if (ageH <= 24) s += 0.5;
  return s;
}

async function firecrawlText(item) {
  if (!process.env.FIRECRAWL_URL || !item.url || item.url.includes('bloomberg')) return null;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.FIRECRAWL_API_KEY) headers['X-API-Key'] = process.env.FIRECRAWL_API_KEY;
    const res = await fetch(`${process.env.FIRECRAWL_URL.replace(/\/$/, '')}/v2/markdown`, {
      method: 'POST', headers, body: JSON.stringify({ url: item.url }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const md = (data?.data?.markdown || '').replace(/\s+/g, ' ').trim();
    return md.length > 400 ? md.slice(0, 1500) : null;
  } catch { return null; }
}

async function writeScript(notes, profile) {
  const L = profile.listener, V = profile.voice, W = profile.worldJson, I = profile.interests;
  const system = `You're the friend everyone texts to make sense of AI — not to hear about it. You read everything, you're great at turning news into something human. Strong opinions, said plainly. A little funny. No fluff, no press release, no "at the end of the day", no wrap-up bow — point made, you stop.

WHO YOU'RE TALKING TO (this is everything): one specific person.
- ${W.life}
- Their fear: ${W.fear}
- What they need: ${W.need}
- Never do: ${W.traps}

YOUR VALUE IS THE SO-WHAT FOR THEM:
- ${V.translation}
- ${V.soWhat}
- Vary how you land every story: sometimes an opportunity, sometimes a heads-up, sometimes a doubt, sometimes just "this is the kind of thing that ends up mattering." Never the same shape twice, and no labels like ${V.noLabels.join(', ')}.
- ${V.noKick[0]}. No rule-of-three lists. You're talking to ONE person, so just say "you".

How you talk:
- ${V.greeting} Then straight in. No meta-windup ("the biggest thing", "this week").
- Out loud, like a person. Contractions, easy rhythm, the odd aside. Swing sentence length. One flowing conversation, no section titles.
- Respect their time. Every line earns its place.

On facts: the insight is yours, the specifics are the notes'. Use your own understanding freely for the so-what, but don't name-drop a company, product, person, number, or date that isn't in today's notes. Vague-but-true beats specific-but-made-up.

About ${profile.minimum.targetWords} words.`;

  const itemList = notes.map((s, i) => {
    const parts = [`[${i + 1}] ${s.title}${s.source ? ` (${s.source})` : ''}`];
    if (s.subtitle) parts.push(`    ${s.subtitle}`);
    if (s.takeaways.length) parts.push(`    Key: ${s.takeaways.join('; ')}`);
    if (s.body) parts.push(`    ${s.body}`);
    return parts.join('\n');
  }).join('\n\n');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const user = `Today's notes:\n\n${itemList}\n\nCatch me up. Five minutes, no jargon, tell me what actually matters for me and why.`;
  for (const model of MODELS) {
    try {
      const base = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
      let res;
      try { res = await openai.chat.completions.create({ ...base, temperature: 0.8 }); }
      catch (e) { if (/temperature|unsupported/i.test(String(e.message))) res = await openai.chat.completions.create(base); else throw e; }
      const out = res.choices?.[0]?.message?.content?.trim();
      if (out) { console.error(`[model] ${model}`); return out; }
    } catch (e) { console.error(`[model] ${model} unavailable: ${String(e.message).slice(0, 80)}`); }
  }
  throw new Error('no model worked');
}

async function main() {
  const items = await getItems();
  const scored = items.map((it) => ({ ...it, score: scoreItem(it, PROFILE) })).sort((a, b) => b.score - a.score);
  console.error(`feed: ${items.length} items | picked: ${scored.sort((a, b) => b.score - a.score).slice(0, 4).map((it) => `${it.title.slice(0, 45)} (${it.score})`).join(' | ')}`);
  const picked = scored.slice(0, 4);

  let enriched = 0;
  if (process.env.FIRECRAWL_URL) {
    await Promise.all(picked.map(async (it, i) => {
      const text = await firecrawlText(it);
      if (text) { picked[i] = { ...it, body: `${it.body}\n    (article) ${text}` }; enriched++; }
    }));
    console.error(`firecrawl: ${enriched}/${picked.length} stories enriched`);
  }

  const script = await writeScript(picked, PROFILE);
  const words = script.split(/\s+/).length;
  const date = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${date}-${PROFILE.id}.md`);
  await writeFile(outPath, `# ${PROFILE.id} v${PROFILE.version} — ${date} (${words} words)\n\n${script}\n`);
  console.log(`\n===== BRIEF (${words} words) =====\n${script}\n==============================\nSaved -> ${outPath}`);
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
