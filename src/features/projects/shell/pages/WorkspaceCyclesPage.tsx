'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  Check,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  Button,
  Skeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ProjectAvatar,
} from '@/shared/components/ui';
import { useProjects } from '../hooks/use-project';
import { CycleService } from '@/features/projects/project-id/cycles/services/cycle.service';
import type { Cycle } from '@/features/projects/project-id/cycles/types/cycle.types';
import { cn } from '@/shared/lib/utils';

export function WorkspaceCyclesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const { projects = [], isLoading: isProjectsLoading } = useProjects();
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);

  const targetProjectId = selectedProjectId || (activeProjects.length > 0 ? activeProjects[0].id : '');

  // Fetch cycles for the targeted project
  const { data: cyclesData, isLoading: isCyclesLoading } = useQuery({
    queryKey: ['workspace-cycles', targetProjectId],
    queryFn: () => (targetProjectId ? CycleService.getProjectCycles(targetProjectId) : Promise.resolve({ cycles: [] })),
    enabled: Boolean(targetProjectId),
  });

  const allCycles: Cycle[] = cyclesData?.cycles || [];
  const selectedProject = activeProjects.find((p) => p.id === targetProjectId);

  const filteredCycles = useMemo(() => {
    if (!searchQuery.trim()) return allCycles;
    const q = searchQuery.toLowerCase();
    return allCycles.filter((c) => c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
  }, [allCycles, searchQuery]);

  // Group cycles by status
  const activeCycles = useMemo(() => filteredCycles.filter((c) => c.status === 'active'), [filteredCycles]);
  const upcomingCycles = useMemo(() => filteredCycles.filter((c) => c.status === 'planned'), [filteredCycles]);
  const completedCycles = useMemo(() => filteredCycles.filter((c) => c.status === 'completed'), [filteredCycles]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <RefreshCw className="size-4 text-primary shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Cycles</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">
            {selectedProject ? selectedProject.name : 'Workspace Sprints Dashboard'}
          </span>
        </div>

        {/* Project Selector & Search */}
        <div className="flex items-center gap-2.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted font-normal cursor-pointer"
              >
                {selectedProject ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ProjectAvatar avatar={selectedProject.avatar} name={selectedProject.name} id={selectedProject.id} size="xs" />
                    <span className="truncate max-w-[130px] font-medium">{selectedProject.name}</span>
                  </div>
                ) : (
                  <span>Select Project</span>
                )}
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
              {activeProjects.map((p) => {
                const isSelected = p.id === targetProjectId;
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={cn('cursor-pointer font-medium flex items-center justify-between', isSelected && 'bg-muted font-semibold')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ProjectAvatar avatar={p.avatar} name={p.name} id={p.id} size="xs" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search cycles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 md:w-56 pl-8 pr-3 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Active Sprints</span>
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-semibold font-mono text-foreground">
              {activeCycles.length}
            </div>
            <p className="text-11 text-muted-foreground">Currently in progress</p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Upcoming Sprints</span>
              <Clock className="size-4 text-primary" />
            </div>
            <div className="text-2xl font-semibold font-mono text-foreground">
              {upcomingCycles.length}
            </div>
            <p className="text-11 text-muted-foreground">Planned for future</p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-card space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completed Sprints</span>
              <CheckCircle2 className="size-4 text-primary" />
            </div>
            <div className="text-2xl font-semibold font-mono text-foreground">
              {completedCycles.length}
            </div>
            <p className="text-11 text-muted-foreground">Historical iterations</p>
          </div>
        </div>

        {/* 1. Active Sprints Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-normal">
              Active Sprints
            </h2>
            <span className="text-11 text-muted-foreground font-mono">
              {activeCycles.length} running
            </span>
          </div>

          {isCyclesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : activeCycles.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-lg bg-card/40 text-xs text-muted-foreground">
              No active cycles running right now for {selectedProject?.name || 'this project'}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex flex-col justify-between p-5 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="size-4 text-emerald-500 shrink-0" />
                        <h3 className="text-sm font-semibold text-foreground truncate">{cycle.name}</h3>
                      </div>
                      {cycle.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cycle.description}</p>
                      )}
                    </div>
                    <span className="text-10 font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold shrink-0">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      <span>
                        {cycle.endDate ? `Ends ${new Date(cycle.endDate).toLocaleDateString()}` : 'Ongoing'}
                      </span>
                    </div>

                    <Button asChild size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1 text-foreground cursor-pointer">
                      <Link href={`/projects/${cycle.projectId || targetProjectId}/cycles/${cycle.id}`}>
                        <span>Open Sprint</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Upcoming Sprints */}
        {upcomingCycles.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-normal">
              Upcoming Sprints
            </h2>
            <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
              {upcomingCycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">{cycle.name}</span>
                      <span className="text-10 font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Planned
                      </span>
                    </div>
                    {cycle.startDate && (
                      <p className="text-11 text-muted-foreground font-mono mt-0.5">
                        Starts: {new Date(cycle.startDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 cursor-pointer">
                    <Link href={`/projects/${cycle.projectId || targetProjectId}/cycles/${cycle.id}`}>
                      <span>View</span>
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Completed Sprints */}
        {completedCycles.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-normal">
              Completed Sprints
            </h2>
            <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
              {completedCycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground truncate">{cycle.name}</span>
                    </div>
                    {cycle.endedAt && (
                      <p className="text-11 text-muted-foreground font-mono mt-0.5">
                        Finished: {new Date(cycle.endedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <Button asChild size="sm" variant="ghost" className="h-7 text-xs px-2.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <Link href={`/projects/${cycle.projectId || targetProjectId}/cycles/${cycle.id}`}>
                      <span>Summary</span>
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkspaceCyclesPage;
