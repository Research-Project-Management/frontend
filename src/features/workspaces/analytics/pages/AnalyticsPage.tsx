'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  Folder,
  Layers,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  FileText,
  Cloud,
  ChevronDown,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Skeleton,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ProjectAvatar,
} from '@/shared/components/ui';
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { AnalyticsService } from '../services/analytics.service';
import { cn } from '@/shared/lib/utils';

export interface AnalyticsPageProps {
  initialProjectId?: string;
}

export default function AnalyticsPage({ initialProjectId }: AnalyticsPageProps) {
  const params = useParams() as { projectId?: string };
  const searchParams = useSearchParams();
  const urlProjectId = initialProjectId || params?.projectId || searchParams?.get('projectId') || '';

  const [selectedProjectId, setSelectedProjectId] = useState<string>(urlProjectId);

  // 1. Fetch available projects
  const { projects = [], isLoading: isProjectsLoading } = useProjects();

  // 2. Fetch Aggregated stats
  const {
    data: workspaceData,
    isLoading: isWorkspaceLoading,
    refetch: refetchWorkspace,
  } = useQuery({
    queryKey: ['workspace-analytics'],
    queryFn: () => AnalyticsService.getWorkspaceOverview(),
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch Project dimensional analytics (if a specific project is selected)
  const {
    data: projectDist,
    isLoading: isProjectDistLoading,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ['project-analytics-dist', selectedProjectId],
    queryFn: () => AnalyticsService.getProjectAnalytics(selectedProjectId),
    enabled: Boolean(selectedProjectId),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Fetch Project overview stats (if a specific project is selected)
  const {
    data: projectOverviewData,
    isLoading: isProjectOverviewLoading,
  } = useQuery({
    queryKey: ['project-overview-stats', selectedProjectId],
    queryFn: () => AnalyticsService.getProjectOverview(selectedProjectId),
    enabled: Boolean(selectedProjectId),
    staleTime: 5 * 60 * 1000,
  });

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const stats = workspaceData?.stats;
  const projectStats = projectOverviewData?.stats;

  // Compute tasks metrics
  const totalTasks = selectedProjectId
    ? projectStats?.totalTasks ?? (projectDist?.assignee?.reduce((sum, a) => sum + a.count, 0) || 0)
    : stats?.tasks || 0;

  const completedTasks = selectedProjectId
    ? projectStats?.completedTasks ?? (projectDist?.state?.['done'] || 0)
    : projectStats?.completedTasks ?? 0;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleRefresh = () => {
    if (selectedProjectId) {
      refetchProject();
    } else {
      refetchWorkspace();
    }
  };

  const isLoading = (selectedProjectId ? isProjectDistLoading || isProjectOverviewLoading : isWorkspaceLoading);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-background overflow-hidden select-none">
      {/* ── Topbar Header ── */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BarChart3 className="size-4 text-primary shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Analytics</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">
            {selectedProject ? selectedProject.name : 'Workspace Overview'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Project Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-2 text-foreground hover:bg-muted font-normal cursor-pointer"
              >
                {selectedProject ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ProjectAvatar avatar={selectedProject.avatar} name={selectedProject.name} size="xs" />
                    <span className="truncate max-w-[130px] font-medium">{selectedProject.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-muted-foreground shrink-0" />
                    <span>All Projects (Workspace)</span>
                  </div>
                )}
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
              <DropdownMenuItem
                onClick={() => setSelectedProjectId('')}
                className={cn('cursor-pointer font-medium flex items-center justify-between', !selectedProjectId && 'bg-muted font-semibold')}
              >
                <div className="flex items-center gap-2">
                  <Layers className="size-3.5 text-muted-foreground shrink-0" />
                  <span>All Projects</span>
                </div>
                {!selectedProjectId && <Check className="size-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>

              {projects.length > 0 && <div className="h-px bg-border my-1" />}

              {projects.map((p) => {
                const isSelected = p.id === selectedProjectId;
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={cn('cursor-pointer font-medium flex items-center justify-between', isSelected && 'bg-muted font-semibold')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ProjectAvatar avatar={p.avatar} name={p.name} size="xs" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh Action */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Refresh analytics data"
          >
            <RotateCcw className="size-3.5 shrink-0" />
          </Button>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {/* Title and Scope Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">
              {selectedProject ? `${selectedProject.name} Insights` : 'Workspace Performance Insights'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedProject
                ? `Detailed metrics, workflow status, priority allocation, and team workload for ${selectedProject.name}.`
                : 'Aggregated analytics across all projects, team members, and research artifacts.'}
            </p>
          </div>

          {selectedProjectId && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 rounded-md cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedProjectId('')}
              >
                <span>← All Projects Overview</span>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 rounded-md cursor-pointer shrink-0"
              >
                <Link href={`/projects/${selectedProjectId}/work-items`}>
                  <span>Go to Work Items</span>
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* ── Top KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total Projects or Work Items */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedProjectId ? 'Total Work Items' : 'Total Projects'}</span>
              {selectedProjectId ? <Layers className="size-4 text-primary" /> : <Folder className="size-4 text-primary" />}
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 rounded" />
            ) : (
              <div className="text-2xl font-semibold text-foreground font-mono">
                {selectedProjectId ? totalTasks : stats?.projects || projects.length}
              </div>
            )}
            <p className="text-11 text-muted-foreground">
              {selectedProjectId ? 'All tracked items' : 'Active research projects'}
            </p>
          </div>

          {/* Card 2: Work Items Completion or Total Tasks */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedProjectId ? 'Completion Rate' : 'Total Work Items'}</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 rounded" />
            ) : (
              <div className="text-2xl font-semibold text-foreground font-mono">
                {selectedProjectId ? `${completionRate}%` : stats?.tasks || 0}
              </div>
            )}
            <p className="text-11 text-muted-foreground">
              {selectedProjectId
                ? `${completedTasks} of ${totalTasks} items completed`
                : 'Aggregated across all projects'}
            </p>
          </div>

          {/* Card 3: Team Members */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Contributors</span>
              <Users className="size-4 text-blue-500" />
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 rounded" />
            ) : (
              <div className="text-2xl font-semibold text-foreground font-mono">
                {selectedProjectId
                  ? (projectDist?.assignee?.length || selectedProject?.members?.length || 1)
                  : (stats?.members || 1)}
              </div>
            )}
            <p className="text-11 text-muted-foreground">Active collaborators</p>
          </div>

          {/* Card 4: Artifacts / Documents */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Artifacts & Files</span>
              <FileText className="size-4 text-amber-500" />
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 rounded" />
            ) : (
              <div className="text-2xl font-semibold text-foreground font-mono">
                {(stats?.pages || 0) + (stats?.files || 0) + (stats?.stickies || 0)}
              </div>
            )}
            <p className="text-11 text-muted-foreground">Pages, Stickies & Datasets</p>
          </div>
        </div>

        {/* ── Conditional Views: Single Project vs Workspace (All Projects) ── */}
        {selectedProjectId ? (
          <>
            {/* ── Workflow Status & Priority Breakdown (Dual Column) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div className="p-5 rounded-lg border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Workflow Distribution</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">By state</span>
                </div>

                {isLoading ? (
                  <div className="space-y-3 pt-2">
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-3/4 rounded" />
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {projectDist?.state && Object.keys(projectDist.state).length > 0 ? (
                      Object.entries(projectDist.state).map(([stateKey, count]) => {
                        const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                        return (
                          <div key={stateKey} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="capitalize font-medium text-foreground">{stateKey.replace('_', ' ')}</span>
                              <span className="text-muted-foreground font-mono">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-300',
                                  stateKey === 'done'
                                    ? 'bg-emerald-500'
                                    : stateKey === 'in_progress' || stateKey === 'in-progress'
                                      ? 'bg-primary'
                                      : stateKey === 'cancelled'
                                        ? 'bg-destructive'
                                        : 'bg-muted-foreground/40'
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        No state distribution data available for this project.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Priority Allocation */}
              <div className="p-5 rounded-lg border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Priority Breakdown</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">Severity</span>
                </div>

                {isLoading ? (
                  <div className="space-y-3 pt-2">
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-3/4 rounded" />
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {projectDist?.priority && Object.keys(projectDist.priority).length > 0 ? (
                      Object.entries(projectDist.priority).map(([prioKey, count]) => {
                        const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                        const prioColor =
                          prioKey === 'urgent'
                            ? 'bg-red-500'
                            : prioKey === 'high'
                              ? 'bg-orange-500'
                              : prioKey === 'medium'
                                ? 'bg-amber-500'
                                : prioKey === 'low'
                                  ? 'bg-blue-500'
                                  : 'bg-muted-foreground/40';

                        return (
                          <div key={prioKey} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="capitalize font-medium text-foreground">{prioKey}</span>
                              <span className="text-muted-foreground font-mono">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all duration-300', prioColor)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        No priority distribution data available for this project.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Team Workload Distribution ── */}
            <div className="p-5 rounded-lg border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Team Workload Distribution</h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">Tasks per contributor</span>
              </div>

              {isLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-10 w-full rounded" />
                  <Skeleton className="h-10 w-full rounded" />
                </div>
              ) : projectDist?.assignee && projectDist.assignee.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {projectDist.assignee.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between p-3 rounded-md border border-border bg-background/50 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-7 shrink-0">
                          <AvatarImage src={member.avatar || undefined} />
                          <AvatarFallback className="text-10 font-semibold">
                            {(member.name || 'U').slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{member.name || 'Unassigned'}</p>
                          <p className="text-10 text-muted-foreground">Collaborator</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-semibold text-foreground px-2 py-0.5 rounded bg-muted">
                        {member.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No active assignees recorded for this project.
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Workspace Overview: Cross-Project Portfolio & Knowledge Assets ── */
          <div className="space-y-6">
            {/* Project Portfolio Table */}
            <div className="p-5 rounded-lg border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="size-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Projects Portfolio</h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {projects.length} project{projects.length !== 1 ? 's' : ''} in workspace
                </span>
              </div>

              {isProjectsLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-12 w-full rounded" />
                  <Skeleton className="h-12 w-full rounded" />
                  <Skeleton className="h-12 w-full rounded" />
                </div>
              ) : projects.length > 0 ? (
                <div className="divide-y divide-border border border-border rounded-md overflow-hidden bg-background/50">
                  {projects.map((p) => {
                    const projectUrl = `/projects/${p.id}/work-items`;

                    return (
                      <div
                        key={p.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-muted/30 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ProjectAvatar avatar={p.avatar} name={p.name} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground truncate">{p.name}</span>
                              {(p.identifier || p.key) && (
                                <span className="text-10 font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {p.identifier || p.key}
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <p className="text-11 text-muted-foreground truncate max-w-md">{p.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                          <span className="text-11 text-muted-foreground font-mono mr-1">
                            {p.members?.length ?? 1} member{p.members?.length !== 1 ? 's' : ''}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs px-2.5 cursor-pointer"
                            onClick={() => setSelectedProjectId(p.id)}
                          >
                            <BarChart3 className="size-3 mr-1 text-primary" />
                            <span>Drill Down</span>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2.5 cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            <Link href={projectUrl}>
                              <span>Work Items</span>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No projects created in this workspace yet.
                </div>
              )}
            </div>

            {/* Knowledge Assets Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-border bg-card space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Pages & Notes</div>
                <div className="text-xl font-semibold font-mono text-foreground">{stats?.pages || 0}</div>
                <p className="text-10 text-muted-foreground">Knowledge documentation</p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Uploaded Files</div>
                <div className="text-xl font-semibold font-mono text-foreground">{stats?.files || 0}</div>
                <p className="text-10 text-muted-foreground">Cloud storage assets</p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Research Papers</div>
                <div className="text-xl font-semibold font-mono text-foreground">{stats?.papers || 0}</div>
                <p className="text-10 text-muted-foreground">Synthesized research</p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Stickies & Quick Notes</div>
                <div className="text-xl font-semibold font-mono text-foreground">{stats?.stickies || 0}</div>
                <p className="text-10 text-muted-foreground">Interactive boards</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
