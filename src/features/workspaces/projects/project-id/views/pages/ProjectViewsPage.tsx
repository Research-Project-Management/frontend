'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  ChevronRight,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, Input, Skeleton, Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui";
import { DeleteModal } from '@/features/workspaces/settings/components/modal/DeleteModal';
import { Switcher } from '@/features/workspaces/projects/project-id/components/layout/Switcher';
import { cn } from "@/shared/lib/utils";
import { useProjectViews } from '../hooks/use-view';
import type {
  WorkItemViewItem,
  ViewLayoutMode,
  ViewAccessType,
} from '../types/view.types';
import { viewFormSchema, type ViewFormValues } from '../schemas/view.schema';

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

export function ProjectViewsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';

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
  } = useProjectViews(projectId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingView, setEditingView] = useState<WorkItemViewItem | null>(null);
  const [deletingView, setDeletingView] = useState<WorkItemViewItem | null>(null);

  // Form State (React Hook Form)
  const form = useForm<ViewFormValues>({
    resolver: zodResolver(viewFormSchema),
    defaultValues: {
      name: '',
      description: '',
      layout: 'board',
      access: 'public',
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = form;

  const formName = useWatch({ control, name: 'name' });
  const formLayout = useWatch({ control, name: 'layout' });
  const formAccess = useWatch({ control, name: 'access' });

  const handleOpenCreate = () => {
    setEditingView(null);
    reset({
      name: '',
      description: '',
      layout: 'board',
      access: 'public',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (view: WorkItemViewItem) => {
    setEditingView(view);
    reset({
      name: view.name,
      description: view.description || '',
      layout: view.layout || 'board',
      access: view.access || 'public',
    });
    setIsModalOpen(true);
  };

  const handleSaveView = async (values: ViewFormValues) => {
    if (editingView) {
      await updateView({
        viewId: editingView.id,
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
    setIsModalOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingView) return;
    await deleteView(deletingView.id);
    setDeletingView(null);
  };

  const handleOpenView = (view: WorkItemViewItem) => {
    router.push(`/projects/${projectId}/views/${view.id}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      {/* ── Top Header ── */}
      <header
        className="flex items-center justify-between px-4 h-11 border-b border-border bg-background shrink-0 select-none sticky top-0 z-10"
      >
        <Switcher
          moduleTitle="Views"
          moduleIcon={SlidersHorizontal}
          count={views.length}
        />

        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="h-8 text-xs font-medium px-3 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none gap-1.5 shrink-0"
        >
          <Plus className="size-3.5 shrink-0" />
          <span>New View</span>
        </Button>
      </header>

      {/* ── Main Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
          {/* Header Description */}
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Views</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Create customized filter combinations, sorting orders, and visual layouts to rapidly access focused perspectives on your project.
            </p>
          </div>

          {/* ── Toolbar: Search & Access Tabs ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search views..."
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
                onClick={() => setAccessFilter('favorites')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1',
                  accessFilter === 'favorites'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Star className="size-3 shrink-0 text-amber-400 fill-amber-400" />
                <span>Favorites</span>
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

          {/* ── Views List or Skeleton ── */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-xs text-muted-foreground rounded-md border border-border bg-card">
              Error loading views for this project.
            </div>
          ) : views.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-md border border-dashed border-border bg-card">
              <SlidersHorizontal className="size-9 text-muted-foreground/60 mb-3 shrink-0" />
              <h3 className="text-sm font-semibold text-foreground">No views found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search
                  ? `No views match "${search}".`
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
                  className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors group cursor-pointer"
                  onClick={() => handleOpenView(view)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Favorite Toggle Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(view.id);
                      }}
                      aria-label={view.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-amber-500 transition-colors cursor-pointer"
                    >
                      <Star
                        className={cn(
                          'size-4 transition-colors shrink-0',
                          view.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/50',
                        )}
                      />
                    </button>

                    {/* Layout Icon */}
                    <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      {getLayoutIcon(view.layout)}
                    </div>

                    {/* Name, Description & Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-13 font-semibold text-foreground truncate group-hover:text-primary transition-colors">
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
                  <div className="flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {view.createdBy && (
                      <div className="hidden md:flex items-center gap-2">
                        <Avatar className="size-5 shrink-0">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(view);
                        }}
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Edit view"
                      >
                        <Pencil className="size-3.5 shrink-0" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingView(view);
                        }}
                        className="size-7 text-muted-foreground hover:text-destructive"
                        title="Delete view"
                      >
                        <Trash2 className="size-3.5 shrink-0" />
                      </Button>
                    </div>

                    <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit View Dialog ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md p-5 bg-card border-border">
          <Form {...form}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-foreground">
                {editingView ? 'Edit View' : 'Create View'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure name, description, visual layout, and visibility.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(handleSaveView)} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">View Name *</label>
                <Input
                  placeholder="e.g. Active Sprints, Urgent Bugs, Literature Review..."
                  maxLength={100}
                  autoFocus
                  {...register('name')}
                  className="h-8.5 text-xs bg-background border-border"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <Input
                  placeholder="Brief summary of what this view displays"
                  maxLength={255}
                  {...register('description')}
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
                      onClick={() => setValue('layout', mode, { shouldValidate: true })}
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
                    onClick={() => setValue('access', 'public', { shouldValidate: true })}
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
                    onClick={() => setValue('access', 'private', { shouldValidate: true })}
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
                  disabled={!formName?.trim() || isCreating || isUpdating}
                  className="h-8 text-xs px-4"
                >
                  {isCreating || isUpdating ? 'Saving...' : editingView ? 'Save Changes' : 'Create View'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <DeleteModal
        isOpen={Boolean(deletingView)}
        onClose={() => setDeletingView(null)}
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
        title="Delete View"
        description={`Are you sure you want to delete "${deletingView?.name || ''}"? This view will be removed for all project members.`}
        confirmText="Delete permanently"
        cancelText="Cancel"
      />
    </div>
  );
}

export default ProjectViewsPage;
