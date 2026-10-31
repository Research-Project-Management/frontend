import { WorkspaceRowListSkeleton } from '@/shared/components/layout/WorkspaceSkeleton';

export default function ExperimentsLoading() {
  return <WorkspaceRowListSkeleton rows={10} variant="work-items" />;
}
