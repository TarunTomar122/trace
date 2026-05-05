import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function DailyLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={8} />
    </PageShell>
  );
}
