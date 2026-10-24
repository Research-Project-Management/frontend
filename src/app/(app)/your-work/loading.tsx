import { WorkspaceRowListSkeleton } from '@/shared/components/layout/WorkspaceSkeleton';

export default function YourWorkSubrouteLoading() {
  return (
    <div className="max-w-6xl mx-auto p-6 w-full">
      <WorkspaceRowListSkeleton rows={8} variant="your-work" className="p-0" />
    </div>
  );
}
