'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '@/features/projects/shell/hooks/use-project';
import { useProjectViews } from '../hooks/use-view';
import { ViewListHeader } from '../components/header/ViewListHeader';
import { ViewAppliedFiltersList } from '../components/filters/ViewAppliedFiltersList';
import { ProjectViewsList } from '../components/list/ProjectViewsList';
import { CreateUpdateProjectViewModal } from '../components/modals/CreateUpdateProjectViewModal';
import { DeleteProjectViewModal } from '../components/modals/DeleteProjectViewModal';
import type { WorkItemViewItem } from '../types/view.types';
import type { ViewFormValues } from '../schemas/view.schema';

export function ProjectViewsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';

  const { state: projectState } = useProject(projectId);
  const project = projectState?.project;

  const {
    views,
    sortedViews,
    isLoading,
    search,
    setSearch,
    accessFilter,
    setAccessFilter,
    onlyFavorites,
    setOnlyFavorites,
    creatorFilter,
    setCreatorFilter,
    sortKey,
    setSortKey,
    sortBy,
    setSortBy,
    clearAllFilters,
    isFiltersApplied,
    createView,
    updateView,
    deleteView,
    duplicateView,
    toggleFavorite,
    isCreating,
    isUpdating,
    isDeleting,
  } = useProjectViews(projectId);

  const [isCreateOrEditOpen, setIsCreateOrEditOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<WorkItemViewItem | null>(null);
  const [deletingView, setDeletingView] = useState<WorkItemViewItem | null>(null);

  // Derive unique creators from loaded views for the filter popover
  const availableCreators = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl?: string }>();
    for (const v of views) {
      if (v.createdBy?.id) {
        map.set(v.createdBy.id, {
          id: v.createdBy.id,
          name: v.createdBy.name || v.createdBy.email || 'Member',
          avatarUrl: v.createdBy.avatar || undefined,
        });
      } else if (v.createdById) {
        map.set(v.createdById, {
          id: v.createdById,
          name: 'Member',
        });
      }
    }
    return Array.from(map.values());
  }, [views]);

  const selectedCreatorName = useMemo(() => {
    if (!creatorFilter) return undefined;
    return availableCreators.find((c) => c.id === creatorFilter)?.name;
  }, [creatorFilter, availableCreators]);

  const handleOpenCreate = () => {
    setSelectedView(null);
    setIsCreateOrEditOpen(true);
  };

  const handleOpenEdit = (view: WorkItemViewItem) => {
    setSelectedView(view);
    setIsCreateOrEditOpen(true);
  };

  const handleSaveModal = async (values: ViewFormValues) => {
    if (selectedView) {
      await updateView({
        viewId: selectedView.id,
        input: {
          name: values.name.trim(),
          description: values.description?.trim() || null,
          layout: values.layout,
          access: values.access,
        },
      });
    } else {
      await createView({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        layout: values.layout,
        access: values.access,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingView) return;
    await deleteView(deletingView.id);
    setDeletingView(null);
  };

  const handleCopyLink = (view: WorkItemViewItem) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/projects/${projectId}/views/${view.id}`;
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{project?.name || 'Project'}</span>
          <ChevronRight className="size-4 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Views</span>
        </div>
      </div>

      {/* Plane-style Subheader: Search, Order By, Filter, and Add View */}
      <ViewListHeader
        search={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        sortBy={sortBy}
        onSortChange={(newSortKey, newSortBy) => {
          setSortKey(newSortKey);
          setSortBy(newSortBy);
        }}
        accessFilter={accessFilter}
        onAccessFilterChange={setAccessFilter}
        onlyFavorites={onlyFavorites}
        onFavoritesChange={setOnlyFavorites}
        creatorFilter={creatorFilter}
        onCreatorFilterChange={setCreatorFilter}
        members={availableCreators}
        onOpenCreateModal={handleOpenCreate}
        isFiltersApplied={isFiltersApplied}
      />

      {/* Applied Filters Chips Bar */}
      <ViewAppliedFiltersList
        search={search}
        onClearSearch={() => setSearch('')}
        accessFilter={accessFilter}
        onClearAccessFilter={() => setAccessFilter('all')}
        onlyFavorites={onlyFavorites}
        onClearFavorites={() => setOnlyFavorites(false)}
        creatorFilter={creatorFilter}
        creatorName={selectedCreatorName}
        onClearCreatorFilter={() => setCreatorFilter(null)}
        onClearAll={clearAllFilters}
      />

      {/* High-density Views List matching Plane.so */}
      <div className="flex-1 overflow-y-auto">
        <ProjectViewsList
          views={sortedViews}
          projectId={projectId}
          isLoading={isLoading}
          isFiltered={isFiltersApplied}
          onClearFilters={clearAllFilters}
          onOpenCreateModal={handleOpenCreate}
          onEdit={handleOpenEdit}
          onDuplicate={(view: WorkItemViewItem) => duplicateView(view)}
          onDelete={(view: WorkItemViewItem) => setDeletingView(view)}
          onToggleFavorite={(viewId: string) => toggleFavorite(viewId)}
          onCopyLink={handleCopyLink}
        />
      </div>

      {/* Create / Edit View Modal */}
      <CreateUpdateProjectViewModal
        isOpen={isCreateOrEditOpen}
        onClose={() => {
          setIsCreateOrEditOpen(false);
          setSelectedView(null);
        }}
        data={selectedView}
        isLoading={isCreating || isUpdating}
        onSubmit={handleSaveModal}
      />

      {/* Delete View Confirmation Modal */}
      <DeleteProjectViewModal
        isOpen={Boolean(deletingView)}
        onClose={() => setDeletingView(null)}
        view={deletingView}
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default ProjectViewsPage;
