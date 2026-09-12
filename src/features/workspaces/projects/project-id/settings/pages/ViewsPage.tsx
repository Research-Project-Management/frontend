'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  SlidersHorizontal,
  Plus,
  Search,
  Star,
  Pencil,
  Trash2,
  Lock,
  Globe,
  Kanban,
  List,
  Table as TableIcon,
  Calendar,
  Clock,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui";
import { DeleteModal } from '@/features/workspaces/settings/components/modal/DeleteModal';
import { cn } from "@/shared/lib/utils";
import { useViewSettings } from '../hooks/use-view-settings';
import type {
  WorkItemViewItem,
  ViewLayoutMode,
  ViewAccessType,
} from '../types/view.types';

function getLayoutIcon(layout: ViewLayoutMode) {
  switch (layout) {
    case 'board':
      return <Kanban className="size-4 shrink-0 text-foreground" />;
    case 'list':
      return <List className="size-4 shrink-0 text-foreground" />;
    case 'table':
      return <TableIcon className="size-4 shrink-0 text-foreground" />;
    case 'calendar':
      return <Calendar className="size-4 shrink-0 text-foreground" />;
    case 'timeline':
      return <Clock className="size-4 shrink-0 text-foreground" />;
    default:
      return <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />;
  }
}

export default function ViewsPage() {
  const { projectId } = useParams() as { projectId: string };
  const {
    views,
    isLoading,
    isError,
    search,
    setSearch,
    accessFilter,
    setAccessFilter,
    createView,
    updateView,
    deleteView,
    toggleFavorite,
    isCreating,
    isUpdating,
    isDeleting,
  } = useViewSettings(projectId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingView, setEditingView] = useState<WorkItemViewItem | null>(null);
  const [deletingView, setDeletingView] = useState<WorkItemViewItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLayout, setFormLayout] = useState<ViewLayoutMode>('board');
  const [formAccess, setFormAccess] = useState<ViewAccessType>('public');

  const handleOpenCreate = () => {
    setEditingView(null);
    setFormName('');
    setFormDescription('');
    setFormLayout('board');
    setFormAccess('public');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (view: WorkItemViewItem) => {
    setEditingView(view);
    setFormName(view.name);
    setFormDescription(view.description || '');
    setFormLayout(view.layout || 'board');
    setFormAccess(view.access || 'public');
    setIsModalOpen(true);
  };

  const handleSaveView = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingView) {
      await updateView({
        viewId: editingView.id,
        input: {
          name: formName.trim(),
          description: formDescription.trim() || null,
          layout: formLayout,
          access: formAccess,
        },
      });
    } else {
      await createView({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        layout: formLayout,
        access: formAccess,
      });
    }
    setIsModalOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingView) return;
    await deleteView(deletingView.id);
    setDeletingView(null);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-8 text-sm text-muted-foreground">
        Error loading saved views.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Saved Views</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {views.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Create and organize customized layouts, query filters, and visual perspectives for project work items.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none gap-1.5 shrink-0"
        >
          <Plus className="size-3.5 shrink-0" />
          <span>New View</span>
        </Button>
      </div>

      {/* ── Toolbar: Search & Access Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search saved views..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8.5 pl-8 text-xs rounded-md border-border bg-background"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
          <button
            type="button"
            onClick={() => setAccessFilter('all')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded transition-colors',
              accessFilter === 'all'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setAccessFilter('public')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1',
              accessFilter === 'public'
                ? 'bg-background text-foreground shadow-none'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Globe className="size-3 shrink-0" />
            <span>Public</span>
          </button>
          <button
            type="button"
            onClick={() => setAccessFilter('private')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1',
              accessFilter === 'private'
                ? 'bg-background text-foreground shadow-none'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Lock className="size-3 shrink-0" />
            <span>Private</span>
          </button>
        </div>
      </div>

      {/* ── Views List ── */}
      {views.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-md border border-dashed border-border bg-card">
          <SlidersHorizontal className="size-9 text-muted-foreground/60 mb-3 shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">No saved views found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {search
              ? `No saved views match "${search}".`
              : 'Save your customized filter criteria, sort configurations, and view layouts to quickly access them later.'}
          </p>
          {!search && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="mt-4 h-8 text-xs font-medium px-3.5 rounded-md bg-primary text-primary-foreground"
            >
              Create your first view
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden divide-y divide-border">
          {views.map((view) => (
            <div
              key={view.id}
              className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Favorite Toggle Button */}
                <button
                  type="button"
                  onClick={() => toggleFavorite(view.id)}
                  aria-label={view.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-amber-500 transition-colors cursor-pointer"
                >
                  <Star
                    className={cn(
                      'size-4 transition-colors shrink-0',
                      view.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/50'
                    )}
                  />
                </button>

                {/* Layout Icon */}
                <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {getLayoutIcon(view.layout)}
                </div>

                {/* Name, Desc & Badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-13 font-semibold text-foreground truncate">
                      {view.name}
                    </span>

                    {/* Access Badge */}
                    <span
                      className={cn(
                        'text-10 font-medium px-1.5 py-0.5 rounded flex items-center gap-1',
                        view.access === 'public'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                      )}
                    >
                      {view.access === 'public' ? (
                        <>
                          <Globe className="size-2.5 shrink-0" />
                          <span>Public</span>
                        </>
                      ) : (
                        <>
                          <Lock className="size-2.5 shrink-0" />
                          <span>Private</span>
                        </>
                      )}
                    </span>

                    <span className="text-11 capitalize font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {view.layout}
                    </span>
                  </div>

                  {view.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-xl">
                      {view.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Creator & Actions */}
              <div className="flex items-center gap-4 shrink-0">
                {view.createdBy && (
                  <div className="hidden md:flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarImage src={view.createdBy.avatar || undefined} />
                      <AvatarFallback className="text-9">
                        {view.createdBy.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground max-w-28 truncate">
                      {view.createdBy.name}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(view)}
                    className="size-7 text-muted-foreground hover:text-foreground"
                    title="Edit view"
                  >
                    <Pencil className="size-3.5 shrink-0" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingView(view)}
                    className="size-7 text-muted-foreground hover:text-destructive"
                    title="Delete view"
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit View Dialog ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md p-5 bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              {editingView ? 'Edit Saved View' : 'Create Saved View'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure name, description, visual layout, and visibility.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveView} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">View Name *</label>
              <Input
                placeholder="e.g. Active Sprints, Urgent Bugs, Literature Review..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                maxLength={100}
                autoFocus
                className="h-8.5 text-xs bg-background border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
              <Input
                placeholder="Brief summary of what this view displays"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                maxLength={255}
                className="h-8.5 text-xs bg-background border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Default Layout</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['board', 'list', 'table', 'calendar', 'timeline'] as ViewLayoutMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFormLayout(mode)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2 rounded-md border text-xs font-medium capitalize transition-all cursor-pointer',
                      formLayout === mode
                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {getLayoutIcon(mode)}
                    <span className="text-11">{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Visibility / Access</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormAccess('public')}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-md border text-xs font-medium text-left transition-all cursor-pointer',
                    formAccess === 'public'
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Globe className="size-4 shrink-0 text-emerald-500" />
                  <div>
                    <div className="font-semibold text-foreground">Public</div>
                    <div className="text-10 text-muted-foreground">Visible to all project members</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormAccess('private')}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-md border text-xs font-medium text-left transition-all cursor-pointer',
                    formAccess === 'private'
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Lock className="size-4 shrink-0 text-amber-500" />
                  <div>
                    <div className="font-semibold text-foreground">Private</div>
                    <div className="text-10 text-muted-foreground">Visible only to you</div>
                  </div>
                </button>
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isCreating || isUpdating}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!formName.trim() || isCreating || isUpdating}
                className="h-8 text-xs px-4"
              >
                {isCreating || isUpdating ? 'Saving...' : editingView ? 'Save Changes' : 'Create View'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <DeleteModal
        isOpen={Boolean(deletingView)}
        onClose={() => setDeletingView(null)}
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
        title="Delete Saved View"
        description={`Are you sure you want to delete "${deletingView?.name || ''}"? This view will be removed for all project members.`}
        confirmText="Delete permanently"
        cancelText="Cancel"
      />
    </div>
  );
}
