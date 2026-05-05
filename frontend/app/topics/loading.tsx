import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function TopicsLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={5} />
    </PageShell>
  );
}
