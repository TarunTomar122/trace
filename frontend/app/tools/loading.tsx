import { PageShell, GenericListSkeleton } from '@/components/PageSkeleton';

export default function ToolsLoading() {
  return (
    <PageShell>
      <GenericListSkeleton rows={4} />
    </PageShell>
  );
}
