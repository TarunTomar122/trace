// Inspect what the global feed actually gives us per item (grounding check for the script).
// Run: node --env-file=.env frontend/scripts/dump-items.mjs
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SA = '/Users/ttomar/Documents/personal/claudia/anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json';
if (!getApps().length) initializeApp({ credential: cert(SA) });
const db = getFirestore();
const snap = await db.collection('v3_user_feeds').doc('_global').collection('daily').orderBy('__name__', 'desc').limit(1).get();
const data = snap.docs[0].data();
console.log(`doc: _global/${snap.docs[0].id}\ntrending count: ${(data.trending || []).length}\n`);
for (const [i, it] of (data.trending || []).slice(0, 6).entries()) {
  const sa = it?.summary?.short_article || {};
  console.log(`# ${i + 1}. ${it.title}`);
  console.log(`  why_relevant: ${it?.metadata?.why_relevant || '-'}`);
  console.log(`  subtitle: ${sa.subtitle || '-'}`);
  console.log(`  why_it_matters: ${sa.why_it_matters || '-'}`);
  console.log(`  key_takeaways: ${(sa.key_takeaways || []).join(' | ') || '-'}`);
  console.log(`  body[0:240]: ${(sa.body || it.description || '').slice(0, 240).replace(/\s+/g, ' ')}`);
  console.log(`  source: ${it?.sources?.[0]?.name || '-'}  | published: ${it?.published_date || it?.metadata?.published_date || '-'}\n`);
}
