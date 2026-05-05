import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function BookmarksLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={5} />
    </PageShell>
  );
}
