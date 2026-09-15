'use client';

import React, { useState, useMemo } from 'react';
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
  LayoutGrid,
  Sparkles,
  ArrowRight,
  Filter,
  Layers,
  Check,
  X,
  MoreHorizontal,
  Copy,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  Input,
  Skeleton,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/shared/components/ui';
import { DeleteModal } from '@/features/settings/components/modal/DeleteModal';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
import { useProject } from '@/features/projects/shell/hooks/use-project';
import { cn } from '@/shared/lib/utils';
import { useProjectViews } from '../hooks/use-view';
import type {
  WorkItemViewItem,
  ViewLayoutMode,
  ViewAccessType,
} from '../types/view.types';
import { viewFormSchema, type ViewFormValues } from '../schemas/view.schema';
import {
  RECOMMENDED_VIEW_TEMPLATES,
  type ViewTemplatePreset,
} from '../constants/view-templates.constant';
import {
  extractFilterBadges,
  formatViewDate,
} from '../utils/view-format.util';

// ── Layout Visual Configuration ─────────────────────────────────────────────

interface LayoutVisualConfig {
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

const LAYOUT_CONFIGS: Record<ViewLayoutMode, LayoutVisualConfig> = {
  board: {
    label: 'Board',
    desc: 'Kanban columns grouped by workflow state',
    icon: Kanban,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  list: {
    label: 'List',
    desc: 'Compact vertical view ordered by priority or cycle',
    icon: List,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  table: {
    label: 'Table',
    desc: 'Spreadsheet-style multi-attribute data grid',
    icon: TableIcon,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  calendar: {
    label: 'Calendar',
    desc: 'Timeline grid mapped by start and due dates',
    icon: Calendar,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  timeline: {
    label: 'Timeline',
    desc: 'Gantt-style roadmap with dependencies',
    icon: Clock,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
};

export function ProjectViewsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';

  const { state: projectState } = useProject(projectId);
  const project = projectState?.project;

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

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingView, setEditingView] = useState<WorkItemViewItem | null>(null);
  const [deletingView, setDeletingView] = useState<WorkItemViewItem | null>(null);
  const [selectedSort, setSelectedSort] = useState<'updated' | 'name' | 'created'>('updated');

  // Form State
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

  const formLayout = useWatch({ control, name: 'layout' });
  const formAccess = useWatch({ control, name: 'access' });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenCreate = (preset?: ViewTemplatePreset) => {
    setEditingView(null);
    reset({
      name: preset?.name || '',
      description: preset?.description || '',
      layout: preset?.layout || 'board',
      access: preset?.access || 'public',
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

  const handleDuplicate = async (view: WorkItemViewItem) => {
    await createView({
      name: `${view.name} (Copy)`,
      description: view.description || undefined,
      layout: view.layout,
      access: view.access,
      filters: view.filters,
    });
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

  // ── Filtered & Sorted Views ───────────────────────────────────────────────

  const sortedViews = useMemo(() => {
    const list = [...views];
    if (selectedSort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (selectedSort === 'created') {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    }
    return list;
  }, [views, selectedSort]);

  const favoriteViews = useMemo(
    () => sortedViews.filter((v) => v.isFavorite),
    [sortedViews],
  );

  const publicViews = useMemo(
    () => sortedViews.filter((v) => v.access === 'public' && !v.isFavorite),
    [sortedViews],
  );

  const privateViews = useMemo(
    () => sortedViews.filter((v) => v.access === 'private' && !v.isFavorite),
    [sortedViews],
  );

  const totalFavorites = useMemo(
    () => views.filter((v) => v.isFavorite).length,
    [views],
  );
  const totalPublic = useMemo(
    () => views.filter((v) => v.access === 'public').length,
    [views],
  );
  const totalPrivate = useMemo(
    () => views.filter((v) => v.access === 'private').length,
    [views],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      {/* ── Top Header Bar ── */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-border bg-background shrink-0 select-none sticky top-0 z-10">
        <Switcher
          project={project}
          moduleTitle="Views"
          moduleIcon={SlidersHorizontal}
          count={views.length}
        />

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex items-center h-8 w-40 sm:w-56 rounded-md border border-border bg-background px-2.5 transition-colors focus-within:border-primary">
            <Search className="size-3.5 text-muted-foreground mr-1.5 shrink-0" />
            <input
              type="text"
              placeholder="Search views..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear search"
              >
                <X className="size-3 shrink-0" />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'size-7 rounded-sm flex items-center justify-center transition-colors cursor-pointer',
                viewMode === 'grid'
                  ? 'bg-background text-foreground shadow-2xs font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Grid card view"
            >
              <LayoutGrid className="size-3.5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'size-7 rounded-sm flex items-center justify-center transition-colors cursor-pointer',
                viewMode === 'table'
                  ? 'bg-background text-foreground shadow-2xs font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Table list view"
            >
              <List className="size-3.5 shrink-0" />
            </button>
          </div>

          {/* Primary CTA */}
          <Button
            size="sm"
            onClick={() => handleOpenCreate()}
            className="h-8 text-xs font-medium px-3 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none gap-1.5 shrink-0"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>New View</span>
          </Button>
        </div>
      </header>

      {/* ── Main Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">

          {/* ── KPI Overview Strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setAccessFilter('all')}
              className={cn(
                'p-3.5 rounded-lg border bg-card transition-all cursor-pointer select-none',
                accessFilter === 'all'
                  ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                  : 'border-border hover:border-border/80',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-11 font-medium text-muted-foreground">Total Views</span>
                <Layers className="size-4 text-muted-foreground/70" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground tracking-tight">
                  {views.length}
                </span>
                <span className="text-10 text-muted-foreground">configured</span>
              </div>
            </div>

            <div
              onClick={() => setAccessFilter('favorites')}
              className={cn(
                'p-3.5 rounded-lg border bg-card transition-all cursor-pointer select-none',
                accessFilter === 'favorites'
                  ? 'border-amber-500 ring-1 ring-amber-500/20 bg-amber-500/5'
                  : 'border-border hover:border-border/80',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-11 font-medium text-muted-foreground">Favorites</span>
                <Star className="size-4 text-amber-500 fill-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
                  {totalFavorites}
                </span>
                <span className="text-10 text-muted-foreground">pinned views</span>
              </div>
            </div>

            <div
              onClick={() => setAccessFilter('public')}
              className={cn(
                'p-3.5 rounded-lg border bg-card transition-all cursor-pointer select-none',
                accessFilter === 'public'
                  ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-500/5'
                  : 'border-border hover:border-border/80',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-11 font-medium text-muted-foreground">Team Views</span>
                <Globe className="size-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {totalPublic}
                </span>
                <span className="text-10 text-muted-foreground">shared public</span>
              </div>
            </div>

            <div
              onClick={() => setAccessFilter('private')}
              className={cn(
                'p-3.5 rounded-lg border bg-card transition-all cursor-pointer select-none',
                accessFilter === 'private'
                  ? 'border-purple-500 ring-1 ring-purple-500/20 bg-purple-500/5'
                  : 'border-border hover:border-border/80',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-11 font-medium text-muted-foreground">Personal</span>
                <Lock className="size-4 text-purple-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
                  {totalPrivate}
                </span>
                <span className="text-10 text-muted-foreground">private to you</span>
              </div>
            </div>
          </div>

          {/* ── Recommended Templates Strip ── */}
          {views.length < 6 && (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <Sparkles className="size-3.5 shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">
                      Quick View Presets
                    </h3>
                    <p className="text-11 text-muted-foreground">
                      Create standard research and engineering perspectives with one click
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {RECOMMENDED_VIEW_TEMPLATES.slice(0, 3).map((template) => {
                  const Icon = LAYOUT_CONFIGS[template.layout].icon;
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleOpenCreate(template)}
                      className="flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer group select-none"
                    >
                      <div
                        className={cn(
                          'size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                          LAYOUT_CONFIGS[template.layout].bg,
                        )}
                      >
                        <Icon className={cn('size-4', LAYOUT_CONFIGS[template.layout].color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {template.name}
                          </span>
                          <span
                            className={cn(
                              'text-9 font-medium px-1.5 py-0.2 rounded border shrink-0',
                              template.badgeColor,
                            )}
                          >
                            {template.badge}
                          </span>
                        </div>
                        <p className="text-11 text-muted-foreground line-clamp-1 mt-0.5">
                          {template.description}
                        </p>
                      </div>
                      <Plus className="size-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Content View Sections ── */}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-xs text-muted-foreground rounded-lg border border-border bg-card">
              Failed to load saved views. Please refresh or try again later.
            </div>
          ) : sortedViews.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-lg border border-dashed border-border bg-card">
              <div className="size-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-3 shadow-2xs">
                <SlidersHorizontal className="size-6 shrink-0" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {search ? `No views match "${search}"` : 'No saved views found'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search
                  ? 'Try clearing the search query or adjusting your visibility filter.'
                  : 'Views allow you to save tailored filter combinations, sort criteria, and visual layouts for instant navigation.'}
              </p>
              {search ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearch('')}
                  className="mt-4 h-8 text-xs font-medium px-3 rounded-md"
                >
                  Clear search query
                </Button>
              ) : (
                <div className="mt-5 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenCreate()}
                    className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary text-primary-foreground"
                  >
                    <Plus className="size-3.5 shrink-0 mr-1.5" />
                    Create First View
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* 1. ⭐ Favorites Section */}
              {favoriteViews.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Star className="size-4 text-amber-500 fill-amber-500 shrink-0" />
                    <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Favorite Views
                    </h2>
                    <span className="text-10 font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {favoriteViews.length}
                    </span>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {favoriteViews.map((view) => (
                        <ViewCard
                          key={view.id}
                          view={view}
                          onOpen={handleOpenView}
                          onEdit={handleOpenEdit}
                          onDuplicate={handleDuplicate}
                          onDelete={(v) => setDeletingView(v)}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  ) : (
                    <ViewTable
                      views={favoriteViews}
                      onOpen={handleOpenView}
                      onEdit={handleOpenEdit}
                      onDuplicate={handleDuplicate}
                      onDelete={(v) => setDeletingView(v)}
                      onToggleFavorite={toggleFavorite}
                    />
                  )}
                </div>
              )}

              {/* 2. 🌐 Team / Public Views Section */}
              {publicViews.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Globe className="size-4 text-emerald-500 shrink-0" />
                    <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Team Views
                    </h2>
                    <span className="text-10 font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {publicViews.length}
                    </span>
                    <span className="text-11 text-muted-foreground hidden sm:inline ml-1">
                      — Shared with all project members
                    </span>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {publicViews.map((view) => (
                        <ViewCard
                          key={view.id}
                          view={view}
                          onOpen={handleOpenView}
                          onEdit={handleOpenEdit}
                          onDuplicate={handleDuplicate}
                          onDelete={(v) => setDeletingView(v)}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  ) : (
                    <ViewTable
                      views={publicViews}
                      onOpen={handleOpenView}
                      onEdit={handleOpenEdit}
                      onDuplicate={handleDuplicate}
                      onDelete={(v) => setDeletingView(v)}
                      onToggleFavorite={toggleFavorite}
                    />
                  )}
                </div>
              )}

              {/* 3. 🔒 Personal / Private Views Section */}
              {privateViews.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Lock className="size-4 text-purple-500 shrink-0" />
                    <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Personal Views
                    </h2>
                    <span className="text-10 font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {privateViews.length}
                    </span>
                    <span className="text-11 text-muted-foreground hidden sm:inline ml-1">
                      — Visible only to your account
                    </span>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {privateViews.map((view) => (
                        <ViewCard
                          key={view.id}
                          view={view}
                          onOpen={handleOpenView}
                          onEdit={handleOpenEdit}
                          onDuplicate={handleDuplicate}
                          onDelete={(v) => setDeletingView(v)}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  ) : (
                    <ViewTable
                      views={privateViews}
                      onOpen={handleOpenView}
                      onEdit={handleOpenEdit}
                      onDuplicate={handleDuplicate}
                      onDelete={(v) => setDeletingView(v)}
                      onToggleFavorite={toggleFavorite}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit View Modal ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg p-5 bg-card border-border">
          <Form {...form}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" />
                <span>{editingView ? 'Edit View' : 'Create Custom View'}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set a title, choose your preferred visual layout, and determine member visibility.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(handleSaveView)} className="space-y-4 pt-2">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">View Name *</label>
                <Input
                  placeholder="e.g. Active Sprint, Urgent Triages, Literature Review..."
                  maxLength={100}
                  autoFocus
                  {...register('name')}
                  className="h-9 text-xs bg-background border-border"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <Input
                  placeholder="Briefly describe what this perspective focuses on..."
                  maxLength={250}
                  {...register('description')}
                  className="h-9 text-xs bg-background border-border"
                />
              </div>

              {/* Visual Layout Mode */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Display Layout</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['board', 'list', 'table', 'calendar', 'timeline'] as ViewLayoutMode[]).map(
                    (layout) => {
                      const cfg = LAYOUT_CONFIGS[layout];
                      const Icon = cfg.icon;
                      const isSelected = formLayout === layout;
                      return (
                        <button
                          key={layout}
                          type="button"
                          onClick={() => setValue('layout', layout)}
                          className={cn(
                            'flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer select-none',
                            isSelected
                              ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/30'
                              : 'border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground',
                          )}
                        >
                          <Icon className={cn('size-4 mb-1.5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                          <span className="text-xs font-medium">{cfg.label}</span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Visibility / Access */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Visibility & Access</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('access', 'public')}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer text-left select-none',
                      formAccess === 'public'
                        ? 'border-emerald-500 bg-emerald-500/5 text-foreground ring-1 ring-emerald-500/30'
                        : 'border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground',
                    )}
                  >
                    <Globe className="size-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-foreground">Public</div>
                      <div className="text-10 text-muted-foreground">All project members</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue('access', 'private')}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer text-left select-none',
                      formAccess === 'private'
                        ? 'border-purple-500 bg-purple-500/5 text-foreground ring-1 ring-purple-500/30'
                        : 'border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground',
                    )}
                  >
                    <Lock className="size-4 text-purple-500 shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-foreground">Private</div>
                      <div className="text-10 text-muted-foreground">Only accessible to you</div>
                    </div>
                  </button>
                </div>
              </div>

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="h-8.5 text-xs rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreating || isUpdating}
                  className="h-8.5 text-xs rounded-md bg-primary hover:bg-primary-hover text-primary-foreground font-medium"
                >
                  {editingView ? 'Save Changes' : 'Create View'}
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
        title={`Delete "${deletingView?.name || 'view'}"?`}
        description="Are you sure you want to delete this saved view? This action cannot be undone."
        loading={isDeleting}
      />
    </div>
  );
}

// ── ViewCard (Grid Presentation) ─────────────────────────────────────────────

interface ViewCardProps {
  view: WorkItemViewItem;
  onOpen: (v: WorkItemViewItem) => void;
  onEdit: (v: WorkItemViewItem) => void;
  onDuplicate: (v: WorkItemViewItem) => void;
  onDelete: (v: WorkItemViewItem) => void;
  onToggleFavorite: (id: string) => void;
}

function ViewCard({
  view,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: ViewCardProps) {
  const layoutCfg = LAYOUT_CONFIGS[view.layout] || LAYOUT_CONFIGS.board;
  const LayoutIcon = layoutCfg.icon;
  const badges = extractFilterBadges(view.filters);

  return (
    <div
      onClick={() => onOpen(view)}
      className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 space-y-3.5 hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer group select-none relative"
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'size-7 rounded-md flex items-center justify-center shrink-0 border',
                layoutCfg.bg,
              )}
            >
              <LayoutIcon className={cn('size-3.5', layoutCfg.color)} />
            </div>
            <span className="text-11 font-medium capitalize text-muted-foreground">
              {layoutCfg.label}
            </span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Star button */}
            <button
              type="button"
              onClick={() => onToggleFavorite(view.id)}
              aria-label={view.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-muted transition-colors cursor-pointer"
            >
              <Star
                className={cn(
                  'size-3.5 transition-colors shrink-0',
                  view.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/60',
                )}
              />
            </button>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="View actions"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 text-xs">
                <DropdownMenuItem onClick={() => onEdit(view)} className="gap-2 cursor-pointer">
                  <Pencil className="size-3.5" />
                  <span>Edit view</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(view)} className="gap-2 cursor-pointer">
                  <Copy className="size-3.5" />
                  <span>Duplicate</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(view)}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title & Description */}
        <h4 className="text-13 font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-1">
          {view.name}
        </h4>

        {view.description ? (
          <p className="text-11 text-muted-foreground line-clamp-2 mt-1">
            {view.description}
          </p>
        ) : (
          <p className="text-11 text-muted-foreground/60 italic mt-1">
            No description provided
          </p>
        )}

        {/* Filter Badges Summary */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {badges.length > 0 ? (
            badges.slice(0, 3).map((b, i) => (
              <span
                key={i}
                className={cn(
                  'text-10 font-medium px-1.5 py-0.5 rounded border shrink-0',
                  b.color,
                )}
              >
                {b.label}: {b.value}
              </span>
            ))
          ) : (
            <span className="text-10 font-medium text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/60">
              All items (no filters)
            </span>
          )}
          {badges.length > 3 && (
            <span className="text-10 font-medium text-muted-foreground px-1 py-0.5">
              +{badges.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Footer Info Row */}
      <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-11 text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          {view.createdBy && (
            <Avatar className="size-4 shrink-0">
              <AvatarImage src={view.createdBy.avatar || undefined} />
              <AvatarFallback className="text-8">
                {view.createdBy.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="truncate max-w-[100px] text-10">
            {view.createdBy?.name || 'Member'}
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-10 shrink-0">
            {formatViewDate(view.updatedAt || view.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-9 font-medium px-1.5 py-0.2 rounded border flex items-center gap-1 shrink-0',
              view.access === 'public'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
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
          <ArrowRight className="size-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
        </div>
      </div>
    </div>
  );
}

// ── ViewTable (High-Density Table Presentation) ──────────────────────────────

interface ViewTableProps {
  views: WorkItemViewItem[];
  onOpen: (v: WorkItemViewItem) => void;
  onEdit: (v: WorkItemViewItem) => void;
  onDuplicate: (v: WorkItemViewItem) => void;
  onDelete: (v: WorkItemViewItem) => void;
  onToggleFavorite: (id: string) => void;
}

function ViewTable({
  views,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: ViewTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
      {/* Table Header */}
      <div className="grid grid-cols-12 px-4 py-2 bg-muted/40 text-10 font-semibold uppercase tracking-wider text-muted-foreground select-none">
        <div className="col-span-5 sm:col-span-4">Name & Layout</div>
        <div className="col-span-4 sm:col-span-4 hidden sm:block">Filters Active</div>
        <div className="col-span-4 sm:col-span-2 text-center">Visibility</div>
        <div className="col-span-3 sm:col-span-2 text-right">Actions</div>
      </div>

      {/* Table Rows */}
      {views.map((view) => {
        const layoutCfg = LAYOUT_CONFIGS[view.layout] || LAYOUT_CONFIGS.board;
        const LayoutIcon = layoutCfg.icon;
        const badges = extractFilterBadges(view.filters);

        return (
          <div
            key={view.id}
            onClick={() => onOpen(view)}
            className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer group select-none"
          >
            {/* Name & Layout */}
            <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 min-w-0 pr-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(view.id);
                }}
                className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-amber-500 cursor-pointer shrink-0"
              >
                <Star
                  className={cn(
                    'size-3.5 transition-colors',
                    view.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/50',
                  )}
                />
              </button>

              <div
                className={cn(
                  'size-6 rounded flex items-center justify-center shrink-0 border',
                  layoutCfg.bg,
                )}
              >
                <LayoutIcon className={cn('size-3', layoutCfg.color)} />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate block">
                  {view.name}
                </span>
                {view.description && (
                  <span className="text-10 text-muted-foreground truncate block">
                    {view.description}
                  </span>
                )}
              </div>
            </div>

            {/* Filters Active */}
            <div className="col-span-4 sm:col-span-4 hidden sm:flex items-center gap-1.5 flex-wrap overflow-hidden pr-2">
              {badges.length > 0 ? (
                badges.slice(0, 2).map((b, i) => (
                  <span
                    key={i}
                    className={cn('text-10 font-medium px-1.5 py-0.2 rounded border shrink-0', b.color)}
                  >
                    {b.label}: {b.value}
                  </span>
                ))
              ) : (
                <span className="text-10 text-muted-foreground/60 italic">No filters applied</span>
              )}
              {badges.length > 2 && (
                <span className="text-10 text-muted-foreground font-medium">
                  +{badges.length - 2}
                </span>
              )}
            </div>

            {/* Visibility */}
            <div className="col-span-4 sm:col-span-2 flex justify-center">
              <span
                className={cn(
                  'text-9 font-medium px-2 py-0.5 rounded border flex items-center gap-1',
                  view.access === 'public'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
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
            </div>

            {/* Actions */}
            <div
              className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onEdit(view)}
                className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Edit view"
              >
                <Pencil className="size-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onDelete(view)}
                className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                title="Delete view"
              >
                <Trash2 className="size-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onOpen(view)}
                className="size-7 rounded flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors cursor-pointer ml-1"
                title="Open view"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ProjectViewsPage;
