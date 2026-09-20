'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useProjectOverview } from '../hooks/use-project-overview';
import { ProjectHeaderCard } from '../components/ProjectHeaderCard';
import { WorkItemProgressCard } from '../components/WorkItemProgressCard';
import { ActiveCycleCard } from '../components/ActiveCycleCard';
import { RecentActivityList } from '../components/RecentActivityList';
import { ProjectPropertiesSidebar } from '../components/ProjectPropertiesSidebar';
import { ProjectStatusCard } from '../components/ProjectStatusCard';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Compass, AlertCircle, RefreshCw } from 'lucide-react';

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
        <header className="h-11 border-b border-border px-4 flex items-center bg-background shrink-0 select-none">
          <Skeleton className="h-6 w-32" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col gap-6">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Unable to load project overview
          </h2>
          <p className="text-xs text-muted-foreground">
            {(error as any)?.message || 'An error occurred while fetching the project overview data.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-2 gap-1 text-xs"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const { project, metrics, activeCycle, recentActivities, currentUpdate } = data;

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
      {/* Top Header with Switcher */}
      <header className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2 bg-background shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-10">
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Left Column (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <ProjectHeaderCard project={project} />

            <ProjectStatusCard
              projectId={project.id}
              currentUpdate={currentUpdate}
            />

            <WorkItemProgressCard projectId={project.id} metrics={metrics} />

            <ActiveCycleCard projectId={project.id} activeCycle={activeCycle} />

            <RecentActivityList activities={recentActivities} />
          </div>

          {/* Sidebar Right Column (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <ProjectPropertiesSidebar
              project={project}
              currentUpdate={currentUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
