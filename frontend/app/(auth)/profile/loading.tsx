import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function ProfileLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={3} />
    </PageShell>
  );
}
