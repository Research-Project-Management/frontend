'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useProjectOverview } from '../hooks/use-project-overview';
import { CleanProjectOverview } from '../components/CleanProjectOverview';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
import { Skeleton } from '@/shared/components/ui/skeleton';
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

  if (isLoading) {
    return (
      <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
        <header className="h-11 border-b border-border px-3 sm:px-4 flex items-center bg-transparent shrink-0 select-none">
          <Skeleton className="h-6 w-36 rounded-md" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-5xl mx-auto w-full">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <Skeleton className="md:col-span-8 h-64 w-full rounded-lg" />
              <Skeleton className="md:col-span-4 h-64 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <PlaneErrorState
        title="Unable to load project overview"
        description="Could not connect to the backend server or project overview data is unavailable. Navigation and other workspaces remain safe."
        error={error}
        reset={() => refetch()}
      />
    );
  }

  const { project } = data;

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
      {/* Top Header with Switcher matching work-items and pages */}
      <header
        className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2.5 bg-transparent shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-20"
        style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
      >
        <Switcher
          project={{
            id: project.id,
            name: project.name,
            avatar: project.avatar,
          }}
          moduleTitle="Overview"
          moduleIcon={Compass}
        />
      </header>

      {/* Main Clean Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 w-full">
        <CleanProjectOverview data={data} />
      </div>
    </div>
  );
}

export default ProjectOverviewPage;
