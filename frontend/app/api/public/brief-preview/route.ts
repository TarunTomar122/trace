import { NextResponse } from 'next/server';
import { formatEditionDate, listDailyEditions } from '@/lib/daily-editions';

// The newest daily brief's top three headlines, for the email card in blog
// posts: readers see what the email is before they're asked for an address.

export const revalidate = 600;

export type BriefPreview = { date: string; label: string; stories: { title: string; href: string }[] };

export async function GET() {
  try {
    const [edition] = await listDailyEditions(1);
    if (!edition || edition.stories.length < 3) return NextResponse.json({ preview: null });
    const preview: BriefPreview = {
      date: edition.date,
      label: formatEditionDate(edition.date, 'short'),
      stories: edition.stories.slice(0, 3).map((story, index) => ({
        title: story.title,
        href: `/brief/${edition.date}#story-${index + 1}`,
      })),
    };
    return NextResponse.json({ preview });
  } catch (err) {
    console.error('[brief-preview]', err);
    return NextResponse.json({ preview: null });
  }
}
