'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui';
import { useOverview } from '../hooks/use-overview';
import { Topbar } from '../components/Topbar';
import { Stats } from '../components/Stats';
import { Team } from '../components/Team';

function OverviewSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-2 w-full rounded" />
          </div>
        ))}
      </div>

      <div className="p-5 rounded-lg border border-border bg-card space-y-4">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { projectId, workspaceId } = useParams() as { projectId: string; workspaceId: string };
  const { data, isLoading, isError, error } = useOverview(projectId);

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  if (isError || !data?.project) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 text-center gap-3">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="font-semibold text-foreground">Failed to load overview</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error instanceof Error ? error.message : 'An unexpected error occurred while fetching the overview.'}
        </p>
      </div>
    );
  }

  const { project, stats } = data;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      <Topbar project={{ name: project.name, avatar: project.avatar }} />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {project.description && (
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {project.description}
          </p>
        )}

        <Stats
          project={project}
          stats={stats}
          workspaceId={workspaceId}
          projectId={projectId}
        />

        <Team members={project.members} />
      </div>
    </div>
  );
}
