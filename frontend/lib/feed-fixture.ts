/**
 * Dev only: TRACE_FEED_FIXTURE names a JSON file of global feed docs
 * ({"docs": [{"id": "2026-11-05", "data": {...}}]}), newest first, to render
 * instead of Firestore, so a candidate feed can be previewed without writing
 * it anywhere (analysis/feed-council/build_fixture.py writes one). Never read
 * in production builds.
 */
export async function feedFixtureSnapshot(): Promise<{
  empty: boolean;
  docs: Array<{ id: string; data: () => Record<string, unknown> }>;
} | null> {
  const path = process.env.TRACE_FEED_FIXTURE;
  if (!path || process.env.NODE_ENV === 'production') return null;
  const { readFile } = await import('node:fs/promises');
  const parsed = JSON.parse(await readFile(path, 'utf8')) as { docs: Array<{ id: string; data: Record<string, unknown> }> };
  const docs = parsed.docs.map((doc) => ({ id: doc.id, data: () => doc.data }));
  return { empty: docs.length === 0, docs };
}
