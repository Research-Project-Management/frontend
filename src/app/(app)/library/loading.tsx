import { WorkspaceRowListSkeleton } from '@/shared/components/layout/WorkspaceSkeleton';

export default function LibrarySubrouteLoading() {
  return (
    <WorkspaceRowListSkeleton
      rows={10}
      variant="library"
      showTableHeader={true}
    />
  );
}
