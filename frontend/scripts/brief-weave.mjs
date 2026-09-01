// Script-only: news -> value, aimed at ONE ambitious time-poor tech listener. No formula. No audio.
// Run: node --env-file=.env frontend/scripts/brief-weave.mjs
import OpenAI from 'openai';

const ROOT = '/Users/ttomar/Documents/personal/claudia';
const SERVICE_ACCOUNT = `${ROOT}/anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json`;
const MODELS = (process.env.BRIEF_MODELS || 'gpt-5,gpt-4.1,gpt-4o').split(',').map((m) => m.trim());
const TARGET_WORDS = 280;

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

KILL THE FORMULA (most important): do NOT end story after story with "if you're X, do Y." You're talking to ONE person, so just say "you", or say what you think. If two stories in a row land the same way, rewrite one. No rule-of-three lists either.

How you talk:
- Short warm greeting ("Hey, morning"), then straight in. No meta-windup ("the biggest thing", "this week").
- Out loud, like a person. Contractions, easy rhythm, the odd aside. Swing sentence length hard. One flowing conversation, no labels, no section titles.
- No fluff, no "at the end of the day", no "that's what I'm watching", no wrap-up bow. Point made, you stop.
- Respect their time. Every line earns its place.

On facts: the insight is yours, the specifics are the notes'. Use your own understanding freely for the so-what. But don't name-drop a company, product, person, number, or date that isn't in today's notes. Vague-but-true beats specific-but-made-up.

About ${TARGET_WORDS} words. Talk to them like you want them to win.`;

async function complete(openai, model, user) {
  const base = { model, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] };
  try {
    const res = await openai.chat.completions.create({ ...base, temperature: 0.8 });
    return res.choices?.[0]?.message?.content?.trim();
  } catch (e) {
    if (/temperature|unsupported|max_tokens|max_completion/i.test(String(e.message))) {
      const res = await openai.chat.completions.create(base);
      return res.choices?.[0]?.message?.content?.trim();
    }
    throw e;
  }
}

async function main() {
  const items = await getItems();
  console.log(`\n----- RAW MATERIAL (${items.length} stories) -----`);
  items.forEach((s, i) => console.log(`${i + 1}. ${s.title}${s.source ? ` (${s.source})` : ''}`));
  const itemList = items.map((s, i) => {
    const parts = [`[${i + 1}] ${s.title}${s.source ? ` (${s.source})` : ''}`];
    if (s.subtitle) parts.push(`    ${s.subtitle}`);
    if (s.takeaways.length) parts.push(`    Key: ${s.takeaways.join('; ')}`);
    if (s.body) parts.push(`    ${s.body}`);
    return parts.join('\n');
  }).join('\n\n');
  const user = `Today's notes:\n\n${itemList}\n\nCatch me up. I've got no time and big plans, so tell me what actually matters for me and why.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  for (const model of MODELS) {
    try {
      const script = await complete(openai, model, user);
      if (!script) throw new Error('empty');
      const words = script.split(/\s+/).length;
      console.log(`\n===== SCRIPT (${model}, ${words} words, ~${Math.round(words / 2.5)}s) =====\n\n${script}\n`);
      return;
    } catch (e) {
      console.log(`[model] ${model} unavailable: ${String(e.message).slice(0, 90)}`);
    }
  }
  console.error('No model worked.');
  process.exit(1);
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
