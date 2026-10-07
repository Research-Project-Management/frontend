'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  RotateCcw,
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
import { Button } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { PlaneEmptyState, PlaneErrorState } from "@/shared/components/ui";
import { ProjectAvatar } from "@/shared/components/icons";
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
import { ViewService } from '@/features/projects/project-id/views/services/view.service';
import { PageService } from '@/features/projects/project-id/pages/services/page.service';
import type { Project } from '../types/project.types';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';
import type { WorkItemViewItem } from '@/features/projects/project-id/views/types/view.types';
import type { Page } from '@/features/projects/project-id/pages/types/page.types';
import { cn } from '@/shared/lib/utils';

export type ArchiveTab = 'work-items' | 'projects' | 'views' | 'pages';

export function ArchivePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab') as ArchiveTab | null;
  const initialTab: ArchiveTab =
    tabParam && ['projects', 'work-items', 'pages', 'views'].includes(tabParam)
      ? tabParam
      : 'projects';

  const [activeTab, setActiveTab] = useState<ArchiveTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (tabParam && ['projects', 'work-items', 'pages', 'views'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  // 1. Fetch available projects
  const {
    projects: rawProjects = [],
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    error: projectsError,
    actions: projectActions,
  } = useProjects();
  const activeProjects = useMemo(() => rawProjects.filter((p) => !p.isArchived), [rawProjects]);

  // Target project context for work items/views/pages
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
    isError: isArchivedItemsError,
    error: archivedItemsError,
    refetch: refetchArchivedItems,
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

  // 4. Archived Views logic
  const {
    data: viewsData,
    isLoading: isViewsLoading,
    isError: isViewsError,
    error: viewsError,
    refetch: refetchViews,
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
    isError: isPagesError,
    error: pagesError,
    refetch: refetchPages,
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

  const archiveTabs = useMemo(() => [
    {
      key: 'projects' as const,
      label: 'Projects',
      count: archivedProjects.length,
    },
    {
      key: 'work-items' as const,
      label: 'Work items',
      count: archivedItems.length,
    },
    {
      key: 'pages' as const,
      label: 'Pages',
      count: archivedPages.length,
    },
  ], [archivedProjects.length, archivedItems.length, archivedPages.length]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* ── Top Header (Matching Your Work pattern) ── */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background sticky top-0 z-20 shrink-0 select-none min-w-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Archive className="size-4 text-foreground shrink-0" />
          <h1 className="text-13 font-semibold text-foreground tracking-tight">Archives</h1>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Project selector dropdown (for pages, work items, views) */}
          {(activeTab === 'pages' || activeTab === 'work-items' || activeTab === 'views') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-12 gap-1.5 text-foreground hover:bg-muted font-normal cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <DropdownMenuContent align="end" className="w-56 p-1 text-12 shadow-overlay">
                {activeProjects.map((p) => {
                  const isSelected = p.id === currentProjectId;
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={cn('cursor-pointer font-medium text-12 flex items-center justify-between', isSelected && 'bg-muted font-semibold')}
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
        </div>
      </header>

      {/* ── Subheader Navigation Tabs (Matching Your Work toolbar pattern) ── */}
      <nav
        aria-label="Archives Navigation"
        className="flex items-center justify-between border-b border-border px-6 bg-background select-none shrink-0 h-10 overflow-x-auto"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-1 h-full">
          {archiveTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedItemIds(new Set());
                }}
                className={cn(
                  'relative flex h-full items-center gap-2 px-3.5 text-12 font-medium transition-colors outline-none cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={cn(
                      'text-11 px-1.5 py-0.5 rounded-full font-mono font-medium leading-none tabular-nums',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bulk action toolbar (for work items) */}
        {activeTab === 'work-items' && selectedItemIds.size > 0 && (
          <div className="flex items-center gap-2 shrink-0 py-1">
            <span className="text-12 text-muted-foreground">
              {selectedItemIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRestoreSelected}
              disabled={bulkRestoreMutation.isPending}
              className="h-7 text-12 font-medium px-2.5 gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/5 relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <RotateCcw className="size-3 shrink-0" />
              <span>Restore Selected</span>
            </Button>
          </div>
        )}
      </nav>

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
            ) : isArchivedItemsError ? (
              <div className="h-full min-h-[340px] flex items-center justify-center">
                <PlaneErrorState
                  title="Failed to load archived work items"
                  description="There was a problem loading archived items for this project."
                  error={archivedItemsError as Error}
                />
              </div>
            ) : filteredArchivedItems.length === 0 ? (
              <div className="h-full min-h-[340px] flex items-center justify-center">
                <PlaneEmptyState
                  variant="review"
                  title="No archived work items"
                  description={
                    searchQuery
                      ? `No work items match your search "${searchQuery}".`
                      : currentProject
                        ? `There are no archived work items in project ${currentProject.name}.`
                        : 'Select a project to view archived tasks.'
                  }
                />
              </div>
            ) : (
              <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30 text-12 font-medium text-muted-foreground select-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="cursor-pointer text-muted-foreground hover:text-foreground relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label="Toggle select all"
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
                        'flex items-center justify-between px-4 py-2.5 min-h-11 hover:bg-muted/40 transition-colors gap-3',
                        isSelected && 'bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="cursor-pointer text-muted-foreground hover:text-foreground shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          aria-label={`Select item ${item.title}`}
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
                            <span className="text-13 font-medium text-foreground truncate">
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
                          className="h-7 text-12 font-medium px-2 gap-1.5 cursor-pointer text-foreground hover:bg-muted relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          title="Restore work item to board"
                          aria-label="Restore work item"
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
            ) : isProjectsError ? (
              <div className="h-full min-h-[340px] flex items-center justify-center">
                <PlaneErrorState
                  title="Failed to load archived projects"
                  description="Could not retrieve the list of archived projects from the server."
                  error={projectsError as Error}
                />
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

        {/* 3. VIEWS TAB */}
        {activeTab === 'views' && (
          <div className="space-y-4">
            {isViewsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : isViewsError ? (
              <div className="h-full min-h-[340px] flex items-center justify-center">
                <PlaneErrorState
                  title="Failed to load archived views"
                  description="Could not load archived views for this project."
                  error={viewsError as Error}
                />
              </div>
            ) : filteredArchivedViews.length === 0 ? (
              <div className="h-full min-h-[340px] flex items-center justify-center">
                <PlaneEmptyState
                  variant="search"
                  title="No archived views"
                  description={
                    currentProject
                      ? `No archived filter views found in ${currentProject.name}.`
                      : 'Select a project to inspect saved views.'
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                {filteredArchivedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-13 font-medium text-foreground truncate">{view.name}</span>
                      <span className="text-11 font-mono ml-2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
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
            ) : isPagesError ? (
              <div className="h-full min-h-[340px] flex items-center justify-center">
                <PlaneErrorState
                  title="Failed to load archived pages"
                  description="Could not load archived pages for this project."
                  error={pagesError as Error}
                />
              </div>
            ) : filteredArchivedPages.length === 0 ? (
              <div className="h-full min-h-[340px] flex items-center justify-center">
                <PlaneEmptyState
                  variant="document"
                  title="No archived pages"
                  description={
                    currentProject
                      ? `No archived wiki documents found in ${currentProject.name}.`
                      : 'Select a project to view archived pages.'
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                {filteredArchivedPages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-13 font-medium text-foreground truncate">{page.title || 'Untitled Page'}</span>
                      <p className="text-11 text-muted-foreground font-mono mt-0.5">
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

      {/* Permanent Delete Modal for Archived Projects */}
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
