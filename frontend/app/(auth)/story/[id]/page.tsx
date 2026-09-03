import StoryShare from '@/components/feed-v2/StoryShare';

export const dynamic = 'force-dynamic';

export default async function SharedStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoryShare id={id} />;
}
