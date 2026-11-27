import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { SPONSOR_PLACEMENTS, SPONSOR_SLOTS, type SponsorPlacement } from '@/lib/sponsor-link';

// Counts sponsor views (sent as one beacon per page by useSponsorView) in
// sponsor_views/{sponsorId}_{YYYY-MM-DD}: a daily total of views on the site
// plus one count per placement. The daily email adds `emails` to the same doc
// (backend send_audience_newsletter). The sponsor's stats page reads them.
// Body: {"views": [[sponsorId, placement], ...]}.

const BOT = /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|headless/i;
// Only the site's own cards send this; the email and the extension count elsewhere.
const SITE_PLACEMENTS: SponsorPlacement[] = SPONSOR_PLACEMENTS.filter((p) => p !== 'email' && p !== 'extension');
const MAX_VIEWS = SPONSOR_SLOTS * SITE_PLACEMENTS.length;

const skip = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  try {
    // A dev server reads the live database: only production counts.
    if (process.env.NODE_ENV !== 'production') return skip();
    if (BOT.test(request.headers.get('user-agent') || '')) return skip();
    // Browsers say where a request came from; another site's page can't add views.
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return skip();
    const body = JSON.parse((await request.text()).slice(0, 2000) || '{}');
    const views: [string, SponsorPlacement][] = Array.isArray(body.views) ? body.views : [];
    if (
      views.length === 0 ||
      views.length > MAX_VIEWS ||
      !views.every(
        (v) => Array.isArray(v) && /^[A-Za-z0-9_-]{8,64}$/.test(String(v[0])) && SITE_PLACEMENTS.includes(v[1]),
      )
    ) {
      return NextResponse.json({ error: 'Bad view' }, { status: 400 });
    }
    if (!adminDb) throw new Error('Firestore not initialized');
    const db = adminDb;

    // One write per sponsor, with every spot it was seen in.
    const bySponsor = new Map<string, Set<SponsorPlacement>>();
    for (const [id, placement] of views) bySponsor.set(id, (bySponsor.get(id) ?? new Set()).add(placement));
    const day = new Date().toISOString().slice(0, 10);
    await Promise.all(
      [...bySponsor].map(async ([id, placements]) => {
        const data = (await db.collection('promoted_tools').doc(id).get()).data();
        // Same rule as /api/tools/go: an ended spot isn't counted, even on a cached page.
        const expires = data?.expires_at?.toDate?.() ?? (data?.expires_at ? new Date(data.expires_at) : null);
        if (data?.status !== 'active' || (expires && expires.getTime() <= Date.now())) return;
        const fields: Record<string, unknown> = {
          sponsor_id: id,
          day,
          views: FieldValue.increment(placements.size),
          updated_at: new Date(),
        };
        for (const placement of placements) fields[`views_${placement}`] = FieldValue.increment(1);
        await db.collection('sponsor_views').doc(`${id}_${day}`).set(fields, { merge: true });
      }),
    );
    return skip();
  } catch (err) {
    console.error('Sponsor view error:', err);
    return skip();
  }
}
