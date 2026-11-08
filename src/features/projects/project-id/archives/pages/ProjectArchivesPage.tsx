'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Archive,
  RotateCcw,
  CheckSquare,
  Square,
  Search,
  FileText,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { WorkspaceRowListSkeleton } from '@/shared/components/layout/WorkspaceSkeleton';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { useProjectArchives } from '../hooks/use-project-archives';
import type { ProjectArchiveTab } from '../types/archive.types';
import { cn } from '@/shared/lib/utils';

export function ProjectArchivesPage() {
  const params = useParams<{ projectId?: string }>();
  const projectId = params?.projectId || '';

  const [activeTab, setActiveTab] = useState<ProjectArchiveTab>('work-items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkItemIds, setSelectedWorkItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(
    new Set(),
  );

  const {
    workItems,
    pages,
    counts,
    isLoading,
    isError,
    error,
    restoreItems,
    isRestoring,
  } = useProjectArchives(projectId);

  const filteredWorkItems = useMemo(() => {
    if (!searchQuery.trim()) return workItems;
    const q = searchQuery.toLowerCase();
    return workItems.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.identifier?.toLowerCase().includes(q),
    );
  }, [workItems, searchQuery]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages;
    const q = searchQuery.toLowerCase();
    return pages.filter(
      (page) =>
        page.title?.toLowerCase().includes(q) ||
        page.description?.toLowerCase().includes(q),
    );
  }, [pages, searchQuery]);

  const tabs = useMemo(
    () => [
      {
        key: 'work-items' as const,
        label: 'Work items',
        count: counts.workItems,
      },
      {
        key: 'pages' as const,
        label: 'Pages',
        count: counts.pages,
      },
    ],
    [counts.workItems, counts.pages],
  );

  const selectedCount =
    activeTab === 'work-items' ? selectedWorkItemIds.size : selectedPageIds.size;

  const handleToggleSelectAllWorkItems = () => {
    if (
      selectedWorkItemIds.size === filteredWorkItems.length &&
      filteredWorkItems.length > 0
    ) {
      setSelectedWorkItemIds(new Set());
    } else {
      setSelectedWorkItemIds(new Set(filteredWorkItems.map((i) => i.id)));
    }
  };

  const handleToggleSelectWorkItem = (id: string) => {
    setSelectedWorkItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllPages = () => {
    if (
      selectedPageIds.size === filteredPages.length &&
      filteredPages.length > 0
    ) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(filteredPages.map((p) => p.id)));
    }
  };

  const handleToggleSelectPage = (id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkRestore = () => {
    if (activeTab === 'work-items' && selectedWorkItemIds.size > 0) {
      restoreItems(
        { workItemIds: Array.from(selectedWorkItemIds) },
        { onSuccess: () => setSelectedWorkItemIds(new Set()) },
      );
    } else if (activeTab === 'pages' && selectedPageIds.size > 0) {
      restoreItems(
        { pageIds: Array.from(selectedPageIds) },
        { onSuccess: () => setSelectedPageIds(new Set()) },
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden select-none">
      {/* ── Top Header (Matching Your Work & Storage pattern) ── */}
      <header
        className="flex items-center justify-between px-6 h-11 border-b border-border bg-background sticky top-0 z-20 shrink-0 select-none min-w-0"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Archive className="size-4 text-foreground shrink-0" />
          <h1 className="text-13 font-semibold text-foreground tracking-tight">
            Archives
          </h1>
        </div>

        {/* Instant Search Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search project archives..."
              className="h-8 w-44 sm:w-56 pl-8 pr-2.5 rounded-md border border-border bg-background text-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>
      </header>

      {/* ── Subheader Navigation Tabs (Matching Your Work NavigationBar) ── */}
      <nav
        aria-label="Project Archives Navigation"
        className="flex items-center justify-between border-b border-border px-6 bg-background select-none shrink-0 h-10 min-h-10"
        style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-1 h-full">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative flex h-full items-center gap-2 px-3.5 text-13 font-medium transition-colors outline-none cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={cn(
                      'text-11 px-1.5 py-0.5 rounded-full font-medium leading-none tabular-nums',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary z-10" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bulk action toolbar */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 shrink-0 py-1">
            <span className="text-12 text-muted-foreground">
              {selectedCount} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRestore}
              disabled={isRestoring}
              className="h-7 text-12 font-medium px-2.5 gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/5"
            >
              <RotateCcw className="size-3 shrink-0" />
              <span>Restore Selected</span>
            </Button>
          </div>
        )}
      </nav>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto">
        {isLoading ? (
          <WorkspaceRowListSkeleton
            variant="work-items"
            rows={6}
            className="p-0"
          />
        ) : isError ? (
          <div className="h-full min-h-[340px] flex items-center justify-center">
            <PlaneErrorState
              title="Failed to load project archives"
              description="There was a problem loading archived items for this project."
              error={error || new Error('Internal Server Error')}
            />
          </div>
        ) : activeTab === 'work-items' ? (
          filteredWorkItems.length === 0 ? (
            <div className="h-full min-h-[340px] flex items-center justify-center">
              <PlaneEmptyState
                variant="review"
                title="No archived work items"
                description={
                  searchQuery
                    ? `No archived work items match "${searchQuery}".`
                    : 'Archived work items in this project will appear here.'
                }
              />
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30 text-12 font-medium text-muted-foreground select-none">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllWorkItems}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    aria-label="Toggle select all work items"
                  >
                    {selectedWorkItemIds.size === filteredWorkItems.length &&
                    filteredWorkItems.length > 0 ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </button>
                  <span>Work item</span>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <span className="hidden sm:inline">Priority</span>
                  <span className="hidden sm:inline">Archived</span>
                  <span>Action</span>
                </div>
              </div>

              {filteredWorkItems.map((item) => {
                const isSelected = selectedWorkItemIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-2.5 min-h-11 hover:bg-muted/40 transition-colors gap-3',
                      isSelected && 'bg-muted/50',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectWorkItem(item.id)}
                        className="cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={`Select ${item.title}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="size-4 text-primary" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                      <div className="flex items-center gap-2 min-w-0">
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

                    <div className="flex items-center gap-4 shrink-0">
                      {item.priority && (
                        <span className="text-10 uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hidden sm:inline">
                          {item.priority}
                        </span>
                      )}
                      {item.archivedAt && (
                        <span className="text-11 text-muted-foreground hidden sm:inline tabular-nums">
                          {new Date(item.archivedAt).toLocaleDateString()}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          restoreItems({ workItemIds: [item.id] })
                        }
                        disabled={isRestoring}
                        className="h-7 text-12 font-medium px-2 gap-1.5 cursor-pointer text-foreground hover:bg-muted"
                      >
                        <RotateCcw className="size-3 text-primary shrink-0" />
                        <span>Restore</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredPages.length === 0 ? (
          <div className="h-full min-h-[340px] flex items-center justify-center">
            <PlaneEmptyState
              variant="document"
              title="No archived pages"
              description={
                searchQuery
                  ? `No archived pages match "${searchQuery}".`
                  : 'Archived manuscript pages in this project will appear here.'
              }
            />
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 text-12 font-medium text-muted-foreground select-none">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleToggleSelectAllPages}
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
                  aria-label="Toggle select all pages"
                >
                  {selectedPageIds.size === filteredPages.length &&
                  filteredPages.length > 0 ? (
                    <CheckSquare className="size-4 text-primary" />
                  ) : (
                    <Square className="size-4" />
                  )}
                </button>
                <span>Page title</span>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <span className="hidden sm:inline">Path</span>
                <span>Action</span>
              </div>
            </div>

            {filteredPages.map((page) => {
              const isSelected = selectedPageIds.has(page.id);
              return (
                <div
                  key={page.id}
                  className={cn(
                    'flex items-center justify-between px-4 py-2.5 min-h-11 hover:bg-muted/40 transition-colors gap-3',
                    isSelected && 'bg-muted/50',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectPage(page.id)}
                      className="cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                      aria-label={`Select ${page.title}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-13 font-medium text-foreground truncate">
                      {page.title || 'Untitled Page'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-11 font-mono text-muted-foreground hidden sm:inline">
                      {page.path}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restoreItems({ pageIds: [page.id] })}
                      disabled={isRestoring}
                      className="h-7 text-12 font-medium px-2 gap-1.5 cursor-pointer text-foreground hover:bg-muted"
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
      </main>
    </div>
  );
}

export default ProjectArchivesPage;
