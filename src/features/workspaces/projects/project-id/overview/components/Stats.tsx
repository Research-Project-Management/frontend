'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Users, HardDrive, CalendarDays } from 'lucide-react';
import { Progress, Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';
import { formatBytes } from '@/shared/utils/format';
import type { ProjectInfo, Stats as StatsType } from '../types/overview.types';

interface StatsProps {
  project: ProjectInfo;
  stats: StatsType;
  workspaceId: string;
  projectId: string;
}

export function Stats({
  project,
  stats,
  workspaceId,
  projectId,
}: StatsProps) {
  const router = useRouter();

  const daysActive = Math.max(
    1,
    Math.ceil(
      (Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const taskCompletionRate =
    stats.tasks.total > 0
      ? (stats.tasks.completed / stats.tasks.total) * 100
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Tasks */}
      <div
        onClick={() => router.push(`/${workspaceId}/projects/${projectId}/tasks`)}
        className="p-4 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-xs transition-all duration-200 cursor-pointer group flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-muted text-foreground transition-colors">
              <CheckSquare className="size-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tasks
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {stats.tasks.total}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Progress value={taskCompletionRate} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {stats.tasks.completed} done
          </span>
        </div>
      </div>

      {/* Team */}
      <div
        onClick={() => router.push(`/${workspaceId}/projects/${projectId}/settings/team`)}
        className="p-4 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-xs transition-all duration-200 cursor-pointer group flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-muted text-foreground transition-colors">
              <Users className="size-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Team
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {stats.members || project.members.length}
          </div>
        </div>
        <div className="flex -space-x-1.5 mt-4 overflow-hidden">
          {project.members.slice(0, 5).map((m, i) => (
            <Avatar key={i} className="size-6 border-2 border-background">
              {m.user.avatar && <AvatarImage src={m.user.avatar} alt={m.user.name} />}
              <AvatarFallback className="text-[9px]">
                {m.user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>

      {/* Files */}
      <div
        onClick={() => router.push(`/${workspaceId}/projects/${projectId}/storage`)}
        className="p-4 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-xs transition-all duration-200 cursor-pointer group flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-muted text-foreground transition-colors">
              <HardDrive className="size-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Files
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {stats.files.count}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          {formatBytes(stats.files.totalSize)} used
        </p>
      </div>

      {/* Active Age */}
      <div className="p-4 rounded-lg bg-card border border-border flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-lg bg-muted text-foreground">
              <CalendarDays className="size-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Age
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {daysActive}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Days since creation
        </p>
      </div>
    </div>
  );
}
