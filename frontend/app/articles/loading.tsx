import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function ArticlesLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={4} />
    </PageShell>
  );
}
