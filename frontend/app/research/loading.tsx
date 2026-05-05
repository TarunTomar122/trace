import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function ResearchLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={5} />
    </PageShell>
  );
}
