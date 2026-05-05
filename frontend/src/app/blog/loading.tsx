import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function BlogLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={5} />
    </PageShell>
  );
}
