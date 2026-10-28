import { timingSafeEqual } from 'node:crypto';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { CONTACT_EMAIL } from '@/lib/site-links';
import { SPONSOR_PLACEMENTS, type SponsorPlacement } from '@/lib/sponsor-link';

// A sponsor's private stats page: /sponsor/{id}?k={stats_token}. The link is
// in their welcome email (backend/v3/flows/send_sponsor_welcome.py writes the
// token). Clicks are Trace's own count (app/api/tools/click), by day and by
// where on the site they were clicked.

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sponsor stats — Trace', robots: { index: false, follow: false } };

const PLACES: Record<SponsorPlacement, string> = {
  desktop_tools: 'Feed, Tools column (desktop)',
  pulse_mobile: 'Feed, top of Top articles (phones)',
  home_feed_end: 'Feed, end of Home',
  brief_rail: 'Daily brief pages',
};

type Doc = Record<string, unknown>;

function when(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  const seconds = v.seconds ?? v._seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000);
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameToken(given: string, stored: unknown): boolean {
  if (typeof stored !== 'string' || stored.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

function stillRunning(status: unknown, ends: Date | null): boolean {
  return status === 'active' && (!ends || ends.getTime() > Date.now());
}

const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function SponsorStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  if (!adminDb || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) notFound();
  const snap = await adminDb.collection('promoted_tools').doc(id).get();
  const sponsor = (snap.exists ? snap.data() : null) as Doc | null;
  if (!sponsor || !sameToken(String(k || ''), sponsor.stats_token)) notFound();

  const rows = (await adminDb.collection('sponsor_clicks').where('sponsor_id', '==', id).get()).docs
    .map((d) => d.data() as Doc)
    .sort((a, b) => String(b.day).localeCompare(String(a.day)));
  const total = rows.reduce((sum, r) => sum + Number(r.clicks || 0), 0);
  const byPlace = SPONSOR_PLACEMENTS.map((p) => ({
    key: p,
    place: PLACES[p],
    clicks: rows.reduce((sum, r) => sum + Number(r[`clicks_${p}`] || 0), 0),
  })).filter((p) => p.clicks > 0);

  // created_at, not activated_at: a renewal payment resets activated_at.
  const started = when(sponsor.created_at) || when(sponsor.activated_at);
  const ends = when(sponsor.expires_at);
  const live = stillRunning(sponsor.status, ends);

  return (
    <div className="min-h-screen bg-white text-[#0f1419]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <main className="mx-auto max-w-[640px] px-5 py-14 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo */}
          <img src="/trace.webp" alt="" className="h-6 w-auto" />
          <span className="text-[17px] font-extrabold tracking-[-0.02em]">Trace</span>
        </Link>
        <p className="mt-10 text-[12px] font-bold uppercase tracking-[0.14em] text-[#1634cc]">Sponsor stats</p>
        <h1 className="mt-3 text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em]">{String(sponsor.title || '')}</h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-[#536471]">
          {live ? 'Live on Trace' : 'Ended'}
          {started ? ` since ${day(started)}` : ''}
          {live && ends ? `, until ${day(ends)}` : ''}.
        </p>

        <div className="mt-8 rounded-xl border border-[#e5e5e5] p-6">
          <p className="text-[48px] font-extrabold leading-none tracking-[-0.03em]">{total.toLocaleString('en-US')}</p>
          <p className="mt-2 text-[15px] text-[#536471]">clicks to {String(sponsor.host || sponsor.url || 'your site')}</p>
        </div>

        {byPlace.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[17px] font-bold">Where they clicked</h2>
            <table className="mt-3 w-full text-[15px]">
              <tbody>
                {byPlace.map((p) => (
                  <tr key={p.place} className="border-b border-[#eff3f4]">
                    <td className="py-2.5">
                      {p.place} <code className="ml-1 rounded bg-[#f4f4f5] px-1 text-[13px] text-[#536471]">{p.key}</code>
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{p.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {rows.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[17px] font-bold">By day (UTC)</h2>
            <table className="mt-3 w-full text-[15px]">
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.day)} className="border-b border-[#eff3f4]">
                    <td className="py-2.5">{day(new Date(`${String(r.day)}T00:00:00Z`))}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{Number(r.clicks || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-10 text-[14px] leading-[1.7] text-[#536471]">
          <p>
            These are clicks counted by Trace, from real visitors (known bots are left out). In your own analytics,
            visits from Trace arrive tagged <code className="rounded bg-[#f4f4f5] px-1">utm_source=trace</code> and{' '}
            <code className="rounded bg-[#f4f4f5] px-1">utm_medium=sponsored</code>, with the spot they came from in{' '}
            <code className="rounded bg-[#f4f4f5] px-1">utm_content</code> (the codes next to each spot above). Your numbers can run a little lower than
            ours: some visitors leave before your page loads, and some block analytics.
          </p>
          <p className="mt-4">
            Questions, or want to change your title, description or link? <a className="font-semibold text-[#1634cc]" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>
      </main>
    </div>
  );
}
