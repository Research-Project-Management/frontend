'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { ViewsOutlineIcon } from '@/shared/components/icons';
import { ProjectViewListItem } from './ProjectViewListItem';
import type { WorkItemViewItem } from '../../types/view.types';

interface ProjectViewsListProps {
  views: WorkItemViewItem[];
  projectId: string;
  isLoading: boolean;
  isFiltered: boolean;
  onClearFilters: () => void;
  onOpenCreateModal: () => void;
  onEdit: (view: WorkItemViewItem) => void;
  onDuplicate: (view: WorkItemViewItem) => void;
  onDelete: (view: WorkItemViewItem) => void;
  onToggleFavorite: (viewId: string) => void;
  onCopyLink: (view: WorkItemViewItem) => void;
}

export function ProjectViewsList({
  views,
  projectId,
  isLoading,
  isFiltered,
  onClearFilters,
  onOpenCreateModal,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onCopyLink,
}: ProjectViewsListProps) {
  if (isLoading) {
    return (
      <div className="divide-y divide-border border-y border-border bg-background">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center justify-between px-4 py-3.5 animate-pulse">
            <div className="flex items-center gap-3 w-1/2">
              <div className="size-7 rounded-md bg-muted/60" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-1/3 rounded bg-muted/70" />
                <div className="h-3 w-1/2 rounded bg-muted/40" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-5 rounded-full bg-muted/60" />
              <div className="h-3 w-16 rounded bg-muted/40" />
              <div className="size-6 rounded bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 1. Empty state when search or filters return 0 matches
  if (views.length === 0 && isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground mb-3">
          <Search className="size-5" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">
          No matching views found
        </h4>
        <p className="text-xs text-muted-foreground max-w-sm mb-4">
          There are no saved views matching your current filters or search query.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="h-8 px-3 text-xs font-medium cursor-pointer"
        >
          Clear filters
        </Button>
      </div>
    );
  }

  // 2. Empty state when project has 0 views
  if (views.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 ring-1 ring-primary/20">
          <ViewsOutlineIcon className="size-7" />
        </div>
        <h4 className="text-base font-semibold text-foreground mb-1.5">
          Save custom views for filtered work items
        </h4>
        <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
          Views are saved configurations of filters, layouts, and display options.
          Create custom views to focus on specific work items without moving or duplicating data.
        </p>
        <Button
          variant="default"
          size="sm"
          onClick={onOpenCreateModal}
          className="h-8 px-4 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer shadow-none"
        >
          <Plus className="size-4" />
          <span>Add view</span>
        </Button>
      </div>
    );
  }

  // 3. Render Views List (Plane ListLayout)
  return (
    <div className="flex flex-col h-full w-full bg-background border-t border-border">
      {views.map((view) => (
        <ProjectViewListItem
          key={view.id}
          view={view}
          projectId={projectId}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onCopyLink={onCopyLink}
        />
      ))}
    </div>
  );
}
