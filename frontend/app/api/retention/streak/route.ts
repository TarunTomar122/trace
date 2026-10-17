import { NextRequest, NextResponse, after } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { stampLastActive } from '@/lib/last-active';
import { getSignedInUid } from '@/lib/request-auth';

interface ReadingStreak {
  current_streak: number;
  longest_streak: number;
  last_read_date: string;
  total_days_read: number;
  streak_history: string[];
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const defaults = (): ReadingStreak => ({
  current_streak: 0,
  longest_streak: 0,
  last_read_date: '',
  total_days_read: 0,
  streak_history: [],
});

function normalize(data: Partial<ReadingStreak> | undefined): ReadingStreak {
  const base = defaults();
  if (!data) return base;
  return {
    current_streak: Number(data.current_streak) || 0,
    longest_streak: Number(data.longest_streak) || 0,
    last_read_date: String(data.last_read_date || ''),
    total_days_read: Number(data.total_days_read) || 0,
    streak_history: Array.isArray(data.streak_history)
      ? data.streak_history.filter((x) => typeof x === 'string').slice(0, 120)
      : [],
  };
}

function recordDay(existing: ReadingStreak): ReadingStreak {
  const today = todayDateStr();
  const yesterday = yesterdayDateStr();
  if (existing.last_read_date === today) return existing;

  let newStreak = 1;
  if (existing.last_read_date === yesterday) {
    newStreak = existing.current_streak + 1;
  }

  const history = [today, ...existing.streak_history.filter((d) => d !== today)].slice(0, 120);
  return {
    current_streak: newStreak,
    longest_streak: Math.max(existing.longest_streak, newStreak),
    last_read_date: today,
    total_days_read: existing.total_days_read + 1,
    streak_history: history,
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // The signed-in web feed asks for the streak on every load, and this is
    // its only request that knows who is reading: count it as activity.
    after(() => stampLastActive(uid));

    const snap = await adminFirestore.collection('user_streaks').doc(uid).get();
    const streak = snap.exists ? normalize(snap.data() as Partial<ReadingStreak>) : defaults();
    return NextResponse.json({ streak });
  } catch (error) {
    console.error('[api/retention/streak] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const uid = await getSignedInUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ref = adminFirestore.collection('user_streaks').doc(uid);
    const snap = await ref.get();
    const existing = snap.exists ? normalize(snap.data() as Partial<ReadingStreak>) : defaults();
    const updated = recordDay(existing);
    await ref.set(updated, { merge: true });
    return NextResponse.json({ streak: updated, milestone: updated.current_streak });
  } catch (error) {
    console.error('[api/retention/streak] POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
