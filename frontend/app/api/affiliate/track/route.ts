import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) return null;
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = normalizeCode(body?.code);
    const target = typeof body?.target === 'string' ? body.target.slice(0, 64) : 'landing';
    const landingPath = typeof body?.landingPath === 'string' ? body.landingPath.slice(0, 256) : '/';

    if (!code || !adminDb) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const codeDoc = await adminDb.collection('affiliate_codes').doc(code).get();
    if (codeDoc.exists && codeDoc.get('active') === false) {
      return NextResponse.json({ ok: true });
    }

    await adminDb.collection('affiliate_clicks').add({
      code,
      target,
      landingPath,
      utmSource: typeof body?.utmSource === 'string' ? body.utmSource : null,
      utmCampaign: typeof body?.utmCampaign === 'string' ? body.utmCampaign : null,
      utmMedium: typeof body?.utmMedium === 'string' ? body.utmMedium : null,
      userAgent: request.headers.get('user-agent') || null,
      referer: request.headers.get('referer') || null,
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Affiliate tracking error:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
