'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useProjectDetails } from '@/features/projects/shell/hooks/use-project';
import dynamic from 'next/dynamic';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';

const DeleteModal = dynamic(
  () =>
    import('@/features/settings/components/labels/DeleteModal').then(
      (m) => m.DeleteModal
    ),
  { ssr: false }
);
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PageToolbar } from '@/shared/components/layout/PageToolbar';
import {
  Tag,
  Search,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Layers,
  BookOpen,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  useProjectLabels,
  useCreateProjectLabel,
  useUpdateProjectLabel,
  useDeleteProjectLabel,
  useReorderProjectLabels,
} from '../hooks/use-label';
import type { Label } from '../types/label.types';

// ── Color Preset Palette ──────────────────────────────────────────────────

export const COLOR_PALETTE = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#0c66e4' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Slate', hex: '#64748b' },
];

// ── Tab Configurations ───────────────────────────────────────────────────

export type SubsystemTab = 'work_item' | 'library' | 'page';

interface TabConfig {
  id: SubsystemTab;
  label: string;
  singular: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  createPlaceholder: string;
}

const TAB_CONFIGS: Record<SubsystemTab, TabConfig> = {
  work_item: {
    id: 'work_item',
    label: 'Work Items',
    singular: 'Work Item',
    icon: Layers,
    description:
      'Manage taxonomy labels for tasks, bugs, features, and experiment runs.',
    emptyTitle: 'No work item labels yet',
    emptyDescription:
      'Create labels to categorize tasks, bug reports, and experiment runs for this project.',
    createPlaceholder: 'e.g. Deep Learning, Optimization, Loss Function, HPC...',
  },
  library: {
    id: 'library',
    label: 'Library',
    singular: 'Library',
    icon: BookOpen,
    description:
      'Manage taxonomy labels and subject classification for scientific papers and citations.',
    emptyTitle: 'No library labels yet',
    emptyDescription:
      'Create labels to organize research papers, citations, and literature collections.',
    createPlaceholder: 'e.g. Survey, Methodology, Review Article, Benchmark Dataset...',
  },
  page: {
    id: 'page',
    label: 'Pages',
    singular: 'Page',
    icon: FileText,
    description:
      'Manage versioning, review, and milestone labels for manuscripts and document chapters.',
    emptyTitle: 'No page labels yet',
    emptyDescription:
      'Create labels to tag manuscript drafts, publication chapters, and milestone revisions.',
    createPlaceholder: 'e.g. Draft, Camera Ready, Peer Review, Final Revision...',
  },
};

// ── Empty State 3D Illustration ──────────────────────────────────────────

function EmptyStateIllustration({ className }: { className?: string }) {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="36"
        y="14"
        width="44"
        height="56"
        rx="8"
        className="stroke-border/50 fill-muted/30"
        strokeWidth="1.5"
      />
      <rect
        x="28"
        y="22"
        width="44"
        height="56"
        rx="8"
        className="stroke-border fill-card"
        strokeWidth="1.5"
      />
      <rect
        x="20"
        y="30"
        width="44"
        height="56"
        rx="8"
        className="stroke-border fill-background"
        strokeWidth="1.5"
      />
      <g transform="translate(34, 48) scale(0.68)">
        <path
          d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-8-8z"
          className="stroke-muted-foreground/50"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle
          cx="7"
          cy="7"
          r="1.5"
          className="fill-muted-foreground/50"
        />
      </g>
    </svg>
  );
}

// ── Inline Form Component (for Add & Edit) ───────────────────────────────

interface LabelInlineFormProps {
  initialName?: string;
  initialColor?: string;
  initialDescription?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (name: string, color: string, description?: string) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function LabelInlineForm({
  initialName = '',
  initialColor = '#0c66e4',
  initialDescription = '',
  placeholder = 'Label title...',
  submitLabel = 'Add',
  onSubmit,
  onCancel,
  isSubmitting = false,
}: LabelInlineFormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [description, setDescription] = useState(initialDescription);
  const [isColorOpen, setIsColorOpen] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || isSubmitting) return;
    onSubmit(name.trim(), color, description.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 w-full">
      <div className="flex items-center gap-2.5 w-full">
        {/* Color Picker Popover */}
        <Popover open={isColorOpen} onOpenChange={setIsColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative size-8 rounded-md border border-input bg-background flex items-center justify-center hover:bg-muted/50 cursor-pointer shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
              title="Choose color"
            >
              <span
                className="size-3.5 rounded-full ring-1 ring-border/30 shrink-0"
                style={{ backgroundColor: color }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2.5 bg-popover border-border shadow-overlay">
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => {
                    setColor(c.hex);
                    setIsColorOpen(false);
                  }}
                  className={cn(
                    "relative size-6 rounded-full transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden",
                    color.toLowerCase() === c.hex.toLowerCase() && "ring-2 ring-primary ring-offset-2 scale-105"
                  )}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {color.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="size-3 text-white stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Title Input */}
        <Input
          autoFocus
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          maxLength={255}
          className="flex-1 h-8 text-13 bg-background border-input rounded-md px-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        {/* Cancel Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="relative h-8 px-3 text-12 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
        >
          Cancel
        </Button>

        {/* Submit Button */}
        <Button
          type="submit"
          size="sm"
          disabled={!name.trim() || isSubmitting}
          className="relative h-8 px-3.5 text-12 font-medium cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
        >
          {submitLabel}
        </Button>
      </div>

      {/* Description Input */}
      <Input
        placeholder="Guidelines or description for using this label (optional)..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        maxLength={500}
        className="w-full h-7 text-12 bg-background/50 border-input/70 rounded-md px-2.5 text-muted-foreground focus:text-foreground"
      />
    </form>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────

export default function LabelPage() {
  const { projectId } = useParams() as { projectId: string };
  const { project, isLoading: isLoadingProject, isError } = useProjectDetails(projectId);

  // Subsystem Tab State (Default: Work Items)
  const [activeTab, setActiveTab] = useState<SubsystemTab>('work_item');
  const currentTabConfig = TAB_CONFIGS[activeTab];

  // Fetch all labels for the project
  const { data: allLabels = [], isLoading: isLoadingLabels } = useProjectLabels(projectId);

  const createMutation = useCreateProjectLabel(projectId);
  const updateMutation = useUpdateProjectLabel(projectId);
  const deleteMutation = useDeleteProjectLabel(projectId);
  const reorderMutation = useReorderProjectLabels(projectId);

  // Search Query
  const [searchQuery, setSearchQuery] = useState('');

  // Creation & Editing States
  const [isCreating, setIsCreating] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

  // Delete State
  const [deletingLabel, setDeletingLabel] = useState<Label | null>(null);

  // Drag-and-drop reorder state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localLabels, setLocalLabels] = useState<Label[] | null>(null);

  // Filter labels for active tab
  const tabLabels = useMemo(() => {
    return allLabels.filter((l) => {
      const t = (l.type || 'work_item') as SubsystemTab;
      return t === activeTab;
    });
  }, [allLabels, activeTab]);

  // Sync local labels with server tabLabels when not actively dragging
  const labelsToDisplay = localLabels !== null ? localLabels : tabLabels;

  const filteredLabels = useMemo(() => {
    if (!searchQuery.trim()) return labelsToDisplay;
    const q = searchQuery.toLowerCase().trim();
    return labelsToDisplay.filter((l) => l.name.toLowerCase().includes(q));
  }, [labelsToDisplay, searchQuery]);

  // ── Tab Switching Handler ────────────────────────────────────────────────
  const handleTabChange = (tab: SubsystemTab) => {
    setActiveTab(tab);
    setIsCreating(false);
    setEditingLabelId(null);
    setSearchQuery('');
    setLocalLabels(null);
  };

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleCreateLabel = async (name: string, color: string, description?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const isDuplicate = tabLabels.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      toast.error(`A label named "${trimmed}" already exists in ${currentTabConfig.label}`);
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: trimmed,
        color,
        description,
        type: activeTab,
      });
      setIsCreating(false);
    } catch {
      // Handled by mutation onError
    }
  };

  const handleUpdateLabel = async (
    labelId: string,
    name: string,
    color: string,
    description?: string,
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const isDuplicate = tabLabels.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase() && l.id !== labelId
    );
    if (isDuplicate) {
      toast.error(`A label named "${trimmed}" already exists in ${currentTabConfig.label}`);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        labelId,
        name: trimmed,
        color,
        description: description || null,
        type: activeTab,
      });
      setEditingLabelId(null);
    } catch {
      // Handled by mutation onError
    }
  };

  const confirmDelete = async () => {
    if (!deletingLabel) return;
    try {
      await deleteMutation.mutateAsync(deletingLabel.id);
      setDeletingLabel(null);
    } catch {
      // Handled by mutation onError
    }
  };

  // ── Drag & Drop Reordering ──────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const currentList = [...labelsToDisplay];
    const item = currentList[draggedIndex];
    currentList.splice(draggedIndex, 1);
    currentList.splice(index, 0, item);

    setDraggedIndex(index);
    setLocalLabels(currentList);
  };

  const handleDragEnd = async () => {
    if (localLabels) {
      const itemsToReorder = localLabels.map((l, idx) => ({
        id: l.id,
        sortOrder: idx,
      }));
      try {
        await reorderMutation.mutateAsync(itemsToReorder);
      } catch {
        // Handled
      }
      setLocalLabels(null);
    }
    setDraggedIndex(null);
  };

  // ── Loading & Error States ──────────────────────────────────────────────

  if (isLoadingLabels || isLoadingProject) {
    return (
      <PageLayout>
        <PageHeader title="Labels" icon={Tag} />
        <PageContent maxWidth="lg">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48 rounded motion-reduce:animate-none" />
            <Skeleton className="h-4 w-80 rounded motion-reduce:animate-none" />
            <div className="flex justify-between gap-4">
              <Skeleton className="h-8 w-64 rounded-md motion-reduce:animate-none" />
              <Skeleton className="h-8 w-24 rounded-md motion-reduce:animate-none" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg motion-reduce:animate-none" />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  if (isError || !project) {
    return (
      <PageLayout>
        <PageHeader title="Labels" icon={Tag} />
        <PageContent maxWidth="lg">
          <div className="text-13 text-muted-foreground">
            Error loading project.
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const hasLabels = tabLabels.length > 0;

  return (
    <PageLayout>
      <PageHeader title="Labels" icon={Tag} />
      <PageContent maxWidth="lg">
        <div className="space-y-5">
          {/* ── 3 Subsystem Tabs: Work Items | Library | Pages ── */}
          <div className="flex items-center gap-1.5 border-b border-border pb-3">
            {(['work_item', 'library', 'page'] as const).map((tabKey) => {
              const config = TAB_CONFIGS[tabKey];
              const Icon = config.icon;
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => handleTabChange(tabKey)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-13 font-medium transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── Subsystem Scope Description Banner ── */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-13 font-semibold text-foreground tracking-tight">
                {currentTabConfig.label} Taxonomy
              </span>
              <span className="px-2 py-0.5 rounded-full text-10 font-medium bg-muted text-muted-foreground border border-border/60">
                Scoped to {currentTabConfig.label}
              </span>
            </div>
            <p className="text-12 text-muted-foreground leading-relaxed">
              {currentTabConfig.description}
            </p>
          </div>

          {/* ── Toolbar: Search & Add Label Button ── */}
          <PageToolbar
            left={
              <div className="relative w-64 sm:w-72">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
                <Input
                  placeholder={`Search ${currentTabConfig.label.toLowerCase()} labels...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-13 rounded-md border-border bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            }
            right={
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setIsCreating(true);
                  setEditingLabelId(null);
                }}
                className="relative h-8 px-3 text-12 font-medium cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
              >
                Add label
              </Button>
            }
          />

          {/* ── Main Content Area ── */}
          {!hasLabels && !isCreating ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <EmptyStateIllustration className="size-24 mb-4 text-muted-foreground" />
              <h3 className="text-16 font-semibold text-foreground">
                {currentTabConfig.emptyTitle}
              </h3>
              <p className="text-13 text-muted-foreground mt-1.5 max-w-sm leading-normal">
                {currentTabConfig.emptyDescription}
              </p>
              <Button
                type="button"
                onClick={() => setIsCreating(true)}
                className="relative mt-4 h-8 px-3.5 text-12 font-medium cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
              >
                Create your first {currentTabConfig.singular.toLowerCase()} label
              </Button>
            </div>
          ) : !hasLabels && isCreating ? (
            /* ── Inline Form when creating first label ── */
            <div className="rounded-lg border border-border bg-background p-3.5 sm:p-4">
              <LabelInlineForm
                initialName=""
                initialColor="#0c66e4"
                placeholder={`Label name (${currentTabConfig.createPlaceholder})`}
                submitLabel="Add"
                onSubmit={handleCreateLabel}
                onCancel={() => setIsCreating(false)}
                isSubmitting={createMutation.isPending}
              />
            </div>
          ) : (
            /* ── Labels List ── */
            <div className="rounded-lg border border-border bg-background p-3 sm:p-4 space-y-2">
              {/* If user clicked "Add label" while labels exist, show inline form at top */}
              {isCreating && (
                <div className="rounded-md border border-border/70 bg-background p-2.5 px-3.5 mb-2">
                  <LabelInlineForm
                    initialName=""
                    initialColor="#0c66e4"
                    placeholder={`Label name (${currentTabConfig.createPlaceholder})`}
                    submitLabel="Add"
                    onSubmit={handleCreateLabel}
                    onCancel={() => setIsCreating(false)}
                    isSubmitting={createMutation.isPending}
                  />
                </div>
              )}

              {/* Filtered labels list */}
              {filteredLabels.length === 0 ? (
                <div className="py-8 text-center text-13 text-muted-foreground">
                  No labels matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredLabels.map((label, index) =>
                  editingLabelId === label.id ? (
                    /* Inline Edit Row */
                    <div
                      key={label.id}
                      className="rounded-md border border-border/80 bg-background p-2.5 px-3.5"
                    >
                      <LabelInlineForm
                        initialName={label.name}
                        initialColor={label.color || '#ef4444'}
                        initialDescription={label.description || ''}
                        placeholder={`Label name (${currentTabConfig.createPlaceholder})`}
                        submitLabel="Save"
                        onSubmit={(name, color, description) =>
                          handleUpdateLabel(label.id, name, color, description)
                        }
                        onCancel={() => setEditingLabelId(null)}
                        isSubmitting={updateMutation.isPending}
                      />
                    </div>
                  ) : (
                    /* Normal Label Item Row */
                    <div
                      key={label.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "rounded-md border border-border/70 bg-background hover:bg-muted/20 px-3.5 py-2 min-h-10 flex items-center justify-between transition-colors group select-none",
                        draggedIndex === index && "opacity-50 border-dashed"
                      )}
                    >
                      {/* Left: Grip Handle + Filled Tag Icon + Label Title + Description */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                        <button
                          type="button"
                          className="relative size-6 flex items-center justify-center -ml-1 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded before:absolute before:-inset-1 md:before:hidden"
                          aria-label="Reorder label"
                        >
                          <GripVertical className="size-4" />
                        </button>
                        <Tag
                          className="size-4 shrink-0 fill-current"
                          style={{ color: label.color || '#ef4444' }}
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0 flex-1">
                          <span className="text-13 font-medium text-foreground truncate">
                            {label.name}
                          </span>
                          {label.description && (
                            <span className="text-12 text-muted-foreground truncate hidden md:inline-block max-w-sm">
                              {label.description}
                            </span>
                          )}
                        </div>
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-10 font-medium bg-muted/80 text-muted-foreground border border-border/50 shrink-0">
                          {currentTabConfig.singular}
                        </span>
                      </div>

                      {/* Right: Three Dots Action Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="relative size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-2 md:before:hidden"
                            title="More options"
                            aria-label="More label options"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 p-1 shadow-overlay">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingLabelId(label.id);
                              setIsCreating(false);
                            }}
                            className="cursor-pointer gap-2 text-12 py-1.5"
                          >
                            <Pencil className="size-3.5 text-muted-foreground" />
                            <span>Edit label</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingLabel(label)}
                            className="cursor-pointer gap-2 text-12 py-1.5 text-destructive focus:text-destructive focus:bg-muted"
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                            <span>Delete label</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                )
              )}
            </div>
          )}
        </div>
      </PageContent>

      {/* ── Delete Confirmation Modal ── */}
      {Boolean(deletingLabel) && (
        <DeleteModal
          isOpen={Boolean(deletingLabel)}
          onClose={() => setDeletingLabel(null)}
          onConfirm={confirmDelete}
          loading={deleteMutation.isPending}
          title="Delete label"
          description={`Are you sure you want to delete "${deletingLabel?.name || ''}" from ${currentTabConfig.label}? This label will be unassigned from any associated items.`}
          confirmText="Delete label"
          cancelText="Cancel"
        />
      )}
    </PageLayout>
  );
}
