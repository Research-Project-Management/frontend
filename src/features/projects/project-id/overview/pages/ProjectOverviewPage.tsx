'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useProjectOverview } from '../hooks/use-project-overview';
import { useProjectDetails } from '@/features/projects/project-id/work-items/hooks/use-work-items-query';
import { CleanProjectOverview } from '../components/CleanProjectOverview';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  WorkspaceOverviewSkeleton,
  WorkspaceViewTransition,
} from '@/shared/components/layout/WorkspaceSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { Compass } from 'lucide-react';

export function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectOverview(projectId);

  const { data: detailsData } = useProjectDetails(projectId);
  const cachedProject =
    detailsData && 'project' in detailsData && detailsData.project
      ? detailsData.project
      : undefined;

  const activeProject = data?.project ?? cachedProject;

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
      {/* Persistent Top Header with Switcher matching work-items and pages */}
      <header
        className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2.5 bg-transparent shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-20"
        style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
      >
        {activeProject ? (
          <Switcher
            project={{
              id: activeProject.id,
              name: activeProject.name,
              avatar: activeProject.avatar,
            }}
            moduleTitle="Overview"
            moduleIcon={Compass}
          />
        ) : (
          <Skeleton className="h-6 w-36 rounded-md" />
        )}
      </header>

      {/* Main Content Area */}
      {isLoading ? (
        <WorkspaceOverviewSkeleton />
      ) : isError || !data ? (
        <PlaneErrorState
          title="Unable to load project overview"
          description="Could not connect to the backend server or project overview data is unavailable. Navigation and other workspaces remain safe."
          error={error}
          reset={() => refetch()}
        />
      ) : (
        <WorkspaceViewTransition className="flex-1 overflow-y-auto p-4 sm:p-6 w-full">
          <CleanProjectOverview data={data} />
        </WorkspaceViewTransition>
      )}
    </div>
  );
}

export default ProjectOverviewPage;
