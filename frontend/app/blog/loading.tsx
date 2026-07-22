import { GenericListSkeleton, PageShell } from '@/components/PageSkeleton';

export default function BlogLoading() {
  return <PageShell><GenericListSkeleton rows={6} /></PageShell>;
}
