'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  RotateCcw,
  Trash2,
  Search,
  Layers,
  FileText,
  CheckCircle2,
  Folder,
  ChevronDown,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
} from 'lucide-react';
import { CycleIcon } from '@/shared/components/icons';
import { Button } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ProjectAvatar,
} from "@/shared/components/ui";
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useProjects, useRestoreProject, useDeleteProject } from '../hooks/use-project';
import {
  filterArchivedProjects,
  searchArchivedProjects,
} from '../utils/archive-page.util';
import {
  filterProjectsByCriteria,
  type ProjectFilterCriteria,
} from '../utils/projects-page.util';
import { ArchiveCard } from '../components/archived/ArchiveCard';
import { DeletePermanentModal } from '../components/archived/DeletePermanentModal';
import { ArchivedEmptyState } from '../components/archived/ArchivedEmptyState';
import { ArchiveService } from '@/features/projects/project-id/work-items/services/archive.service';
import { CycleService } from '@/features/projects/project-id/cycles/services/cycle.service';
import { ViewService } from '@/features/projects/project-id/views/services/view.service';
import { PageService } from '@/features/projects/project-id/pages/services/page.service';
import type { Project } from '../types/project.types';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';
import type { Cycle } from '@/features/projects/project-id/cycles/types/cycle.types';
import type { WorkItemViewItem } from '@/features/projects/project-id/views/types/view.types';
import type { Page } from '@/features/projects/project-id/pages/types/page.types';
import { cn } from '@/shared/lib/utils';

export type ArchiveTab = 'work-items' | 'projects' | 'cycles' | 'views' | 'pages';

export function ArchivePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ArchiveTab>('work-items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  // 1. Fetch available projects
  const { projects: rawProjects = [], isLoading: isProjectsLoading } = useProjects();
  const activeProjects = useMemo(() => rawProjects.filter((p) => !p.isArchived), [rawProjects]);

  // Target project context for work items/cycles/views/pages
  const currentProjectId = selectedProjectId || (activeProjects.length > 0 ? activeProjects[0].id : '');

  // 2. Archived Projects logic
  const restoreProjectMutation = useRestoreProject();
  const deleteProjectMutation = useDeleteProject();

  const archivedProjects = useMemo(() => {
    return filterArchivedProjects(rawProjects);
  }, [rawProjects]);

  const filteredArchivedProjects = useMemo(() => {
    const searched = searchArchivedProjects(archivedProjects, searchQuery);
    return searched;
  }, [archivedProjects, searchQuery]);

  // 3. Archived Work Items logic
  const {
    data: archivedItemsData,
    isLoading: isArchivedItemsLoading,
  } = useQuery({
    queryKey: ['archived-work-items', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [] as Item[];
      const res = await ArchiveService.getArchived(currentProjectId);
      if (Array.isArray(res)) return res as Item[];
      if (res && typeof res === 'object') {
        const items = (res as any).archivedItems || (res as any).workItems || (res as any).data;
        if (Array.isArray(items)) return items as Item[];
      }
      return [] as Item[];
    },
    enabled: Boolean(currentProjectId),
  });

  const archivedItems: Item[] = archivedItemsData || [];
  const filteredArchivedItems = useMemo(() => {
    if (!searchQuery.trim()) return archivedItems;
    const q = searchQuery.toLowerCase();
    return archivedItems.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.identifier?.toLowerCase().includes(q)
    );
  }, [archivedItems, searchQuery]);

  // Work items restore mutations
  const restoreWorkItemMutation = useMutation({
    mutationFn: (id: string) => ArchiveService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Work item restored to active board');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to restore work item'),
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: string[]) => ArchiveService.bulkRestore(ids),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['archived-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      setSelectedItemIds(new Set());
      toast.success(`Successfully restored ${ids.length} work items`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to bulk restore'),
  });

  // 4. Archived Cycles logic
  const {
    data: cyclesData,
    isLoading: isCyclesLoading,
  } = useQuery({
    queryKey: ['archived-cycles', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [] as Cycle[];
      const res = await CycleService.getProjectCycles(currentProjectId);
      return (res?.cycles || []).filter(
        (c) => c.status === 'completed' || c.status === 'cancelled' || (c as any).isArchived
      );
    },
    enabled: Boolean(currentProjectId),
  });

  const archivedCycles: Cycle[] = cyclesData || [];
  const filteredArchivedCycles = useMemo(() => {
    if (!searchQuery.trim()) return archivedCycles;
    const q = searchQuery.toLowerCase();
    return archivedCycles.filter((c) => c.name?.toLowerCase().includes(q));
  }, [archivedCycles, searchQuery]);

  // 5. Archived Views logic
  const {
    data: viewsData,
    isLoading: isViewsLoading,
  } = useQuery({
    queryKey: ['archived-views', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [] as WorkItemViewItem[];
      const res = await ViewService.getViews(currentProjectId);
      return (res || []).filter((v: any) => v.archivedAt || v.isArchived);
    },
    enabled: Boolean(currentProjectId),
  });

  const archivedViews: WorkItemViewItem[] = viewsData || [];
  const filteredArchivedViews = useMemo(() => {
    if (!searchQuery.trim()) return archivedViews;
    const q = searchQuery.toLowerCase();
    return archivedViews.filter((v) => v.name?.toLowerCase().includes(q));
  }, [archivedViews, searchQuery]);

  // 6. Archived Pages logic
  const {
    data: pagesData,
    isLoading: isPagesLoading,
  } = useQuery({
    queryKey: ['archived-pages', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [] as Page[];
      const res = await PageService.getProjectPages(currentProjectId, 'archived');
      return res || [];
    },
    enabled: Boolean(currentProjectId),
  });

  const archivedPages: Page[] = pagesData || [];
  const filteredArchivedPages = useMemo(() => {
    if (!searchQuery.trim()) return archivedPages;
    const q = searchQuery.toLowerCase();
    return archivedPages.filter((p) => p.title?.toLowerCase().includes(q));
  }, [archivedPages, searchQuery]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === filteredArchivedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredArchivedItems.map((i) => i.id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkRestoreSelected = () => {
    if (selectedItemIds.size === 0) return;
    bulkRestoreMutation.mutate(Array.from(selectedItemIds));
  };

  const handleRestoreProject = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    restoreProjectMutation.mutate({ projectId });
  };

  const handleDeletePermanent = () => {
    if (!deleteConfirmProject?.id) return;
    deleteProjectMutation.mutate(
      { projectId: deleteConfirmProject.id },
      { onSettled: () => setDeleteConfirmProject(null) }
    );
  };

  const currentProject = activeProjects.find((p) => p.id === currentProjectId);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* ── Top Header ── */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 shrink-0 select-none min-w-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Archive className="size-4 text-primary shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Archives Hub</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">
            {activeTab === 'work-items'
              ? 'Archived Work Items'
              : activeTab === 'projects'
                ? 'Archived Projects'
                : activeTab === 'cycles'
                  ? 'Archived Cycles'
                  : activeTab === 'views'
                    ? 'Archived Views'
                    : 'Archived Pages'}
          </span>
        </div>

        {/* Project Selector & Search */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Project selector dropdown (for work items, cycles, views, pages) */}
          {activeTab !== 'projects' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted font-normal cursor-pointer"
                >
                  {currentProject ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ProjectAvatar avatar={currentProject.avatar} name={currentProject.name} id={currentProject.id} size="xs" />
                      <span className="truncate max-w-[120px] font-medium">{currentProject.name}</span>
                    </div>
                  ) : (
                    <span>Select Project</span>
                  )}
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
                {activeProjects.map((p) => {
                  const isSelected = p.id === currentProjectId;
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
          )}

          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search archives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 md:w-60 pl-8 pr-3 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </header>

      {/* ── Subheader Navigation Tabs ── */}
      <div
        className="flex items-center justify-between px-6 border-b border-border bg-muted/40 shrink-0 overflow-x-auto gap-4"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-1 py-1">
          <button
            type="button"
            onClick={() => { setActiveTab('work-items'); setSelectedItemIds(new Set()); }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
              activeTab === 'work-items'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>Work Items</span>
            {archivedItems.length > 0 && (
              <span className="text-10 font-mono px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border">
                {archivedItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('projects'); setSelectedItemIds(new Set()); }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
              activeTab === 'projects'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Folder className="size-3.5 shrink-0" />
            <span>Projects</span>
            {archivedProjects.length > 0 && (
              <span className="text-10 font-mono px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border">
                {archivedProjects.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('cycles'); setSelectedItemIds(new Set()); }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
              activeTab === 'cycles'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CycleIcon className="size-3.5 shrink-0" />
            <span>Cycles</span>
            {archivedCycles.length > 0 && (
              <span className="text-10 font-mono px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border">
                {archivedCycles.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('views'); setSelectedItemIds(new Set()); }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
              activeTab === 'views'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="size-3.5 shrink-0" />
            <span>Views</span>
            {archivedViews.length > 0 && (
              <span className="text-10 font-mono px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border">
                {archivedViews.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('pages'); setSelectedItemIds(new Set()); }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
              activeTab === 'pages'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FileText className="size-3.5 shrink-0" />
            <span>Pages</span>
            {archivedPages.length > 0 && (
              <span className="text-10 font-mono px-1.5 py-0.2 rounded-full bg-muted text-foreground border border-border">
                {archivedPages.length}
              </span>
            )}
          </button>
        </div>

        {/* Bulk action toolbar (for work items) */}
        {activeTab === 'work-items' && selectedItemIds.size > 0 && (
          <div className="flex items-center gap-2 shrink-0 py-1">
            <span className="text-xs text-muted-foreground">
              {selectedItemIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRestoreSelected}
              disabled={bulkRestoreMutation.isPending}
              className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/5"
            >
              <RotateCcw className="size-3 shrink-0" />
              <span>Restore Selected</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── Main Tab Content ── */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {/* 1. WORK ITEMS TAB */}
        {activeTab === 'work-items' && (
          <div className="space-y-4">
            {isArchivedItemsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : filteredArchivedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center select-none">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CheckCircle2 className="size-6 text-muted-foreground/60" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No archived work items</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {searchQuery
                    ? `No work items match your search "${searchQuery}".`
                    : currentProject
                      ? `There are no archived work items in project ${currentProject.name}.`
                      : 'Select a project to view archived tasks.'}
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 text-xs font-semibold text-muted-foreground select-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {selectedItemIds.size === filteredArchivedItems.length && filteredArchivedItems.length > 0 ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                    <span>Work Item Title</span>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <span className="hidden sm:inline">Priority</span>
                    <span className="hidden sm:inline">Project</span>
                    <span>Action</span>
                  </div>
                </div>

                {/* Items */}
                {filteredArchivedItems.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors gap-3',
                        isSelected && 'bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>
                        <div className="truncate min-w-0">
                          <div className="flex items-center gap-2">
                            {item.identifier && (
                              <span className="text-11 font-mono text-muted-foreground shrink-0">
                                {item.identifier}
                              </span>
                            )}
                            <span className="text-xs font-medium text-foreground truncate">
                              {item.title}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {item.priority && (
                          <span className="text-10 uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden sm:inline">
                            {item.priority}
                          </span>
                        )}
                        {currentProject && (
                          <span className="text-11 text-muted-foreground hidden sm:inline">
                            {currentProject.name}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restoreWorkItemMutation.mutate(item.id)}
                          disabled={restoreWorkItemMutation.isPending}
                          className="h-7 text-xs px-2 gap-1.5 cursor-pointer text-foreground hover:bg-muted"
                          title="Restore work item to board"
                        >
                          <RotateCcw className="size-3 text-primary shrink-0" />
                          <span>Restore</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. PROJECTS TAB */}
        {activeTab === 'projects' && (
          <div>
            {isProjectsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col rounded-lg border border-border bg-card p-4 space-y-3">
                    <Skeleton className="h-24 w-full rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredArchivedProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredArchivedProjects.map((project) => (
                  <ArchiveCard
                    key={project.id}
                    project={project}
                    onRestore={handleRestoreProject}
                    onDeletePermanent={(p: Project, e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteConfirmProject(p);
                    }}
                    isRestoring={restoreProjectMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <ArchivedEmptyState />
            )}
          </div>
        )}

        {/* 3. CYCLES TAB */}
        {activeTab === 'cycles' && (
          <div className="space-y-4">
            {isCyclesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
              </div>
            ) : filteredArchivedCycles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center select-none">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CycleIcon className="size-6 text-muted-foreground/60" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No archived cycles</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {currentProject
                    ? `No completed or archived cycles found for ${currentProject.name}.`
                    : 'Select a project to inspect past sprints.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                {filteredArchivedCycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/30 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">{cycle.name}</span>
                        <span className="text-10 font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                          {cycle.status}
                        </span>
                      </div>
                      {cycle.description && (
                        <p className="text-11 text-muted-foreground truncate mt-0.5">{cycle.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-10 text-muted-foreground mt-1.5 font-mono">
                        {cycle.startDate && (
                          <span>Started: {new Date(cycle.startDate).toLocaleDateString()}</span>
                        )}
                        {cycle.endDate && (
                          <span>Ended: {new Date(cycle.endDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 cursor-pointer"
                      >
                        <Link href={`/projects/${cycle.projectId || currentProjectId}/cycles/${cycle.id}`}>
                          <span>View Details</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. VIEWS TAB */}
        {activeTab === 'views' && (
          <div className="space-y-4">
            {isViewsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : filteredArchivedViews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center select-none">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Layers className="size-6 text-muted-foreground/60" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No archived views</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {currentProject
                    ? `No archived filter views found in ${currentProject.name}.`
                    : 'Select a project to inspect saved views.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                {filteredArchivedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">{view.name}</span>
                      <span className="text-10 font-mono ml-2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {view.access || 'public'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. PAGES TAB */}
        {activeTab === 'pages' && (
          <div className="space-y-4">
            {isPagesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : filteredArchivedPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center select-none">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <FileText className="size-6 text-muted-foreground/60" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No archived pages</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {currentProject
                    ? `No archived wiki documents found in ${currentProject.name}.`
                    : 'Select a project to view archived pages.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                {filteredArchivedPages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">{page.title || 'Untitled Page'}</span>
                      <p className="text-10 text-muted-foreground font-mono mt-0.5">
                        Status: {page.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Permanent Delete Modal for Projects */}
      <DeletePermanentModal
        project={deleteConfirmProject}
        onClose={() => setDeleteConfirmProject(null)}
        onConfirm={handleDeletePermanent}
        isDeleting={deleteProjectMutation.isPending}
      />
    </div>
  );
}

export default ArchivePage;
