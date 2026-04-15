import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TrendingTopicRedirect({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  permanentRedirect(`/topics/${topic}`);
}
