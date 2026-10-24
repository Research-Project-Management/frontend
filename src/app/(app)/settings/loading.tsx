import { WorkspaceRowListSkeleton } from '@/shared/components/layout/WorkspaceSkeleton';

export default function AccountSettingsSubrouteLoading() {
  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 w-full">
      <WorkspaceRowListSkeleton rows={6} variant="work-items" className="p-0" />
    </div>
  );
}
