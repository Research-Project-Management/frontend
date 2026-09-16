'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useProjectDetails } from '@/features/projects/shell/hooks/use-project';
import { Button, Input, Skeleton } from '@/shared/components/ui';
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
import { DeleteModal } from '@/features/settings/components/modal/DeleteModal';
import TopBar from '../components/layout/TopBar';
import {
  Tag,
  Search,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpRight,
  Check,
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
      {/* Back card */}
      <rect
        x="36"
        y="14"
        width="44"
        height="56"
        rx="8"
        className="stroke-border/50 fill-muted/30"
        strokeWidth="1.5"
      />
      {/* Middle card */}
      <rect
        x="28"
        y="22"
        width="44"
        height="56"
        rx="8"
        className="stroke-border fill-card"
        strokeWidth="1.5"
      />
      {/* Front card */}
      <rect
        x="20"
        y="30"
        width="44"
        height="56"
        rx="8"
        className="stroke-border fill-background"
        strokeWidth="1.5"
      />
      {/* Front card Tag Icon */}
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
  submitLabel?: string;
  onSubmit: (name: string, color: string) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function LabelInlineForm({
  initialName = '',
  initialColor = '#0c66e4',
  submitLabel = 'Add',
  onSubmit,
  onCancel,
  isSubmitting = false,
}: LabelInlineFormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [isColorOpen, setIsColorOpen] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || isSubmitting) return;
    onSubmit(name.trim(), color);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2.5 w-full">
      {/* Color Picker Popover */}
      <Popover open={isColorOpen} onOpenChange={setIsColorOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="size-8.5 rounded-lg border border-input bg-background flex items-center justify-center hover:bg-muted/50 cursor-pointer shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            title="Choose color"
          >
            <span
              className="size-3.5 rounded-full ring-1 ring-border/30 shrink-0"
              style={{ backgroundColor: color }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2.5 bg-popover border-border">
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
                  "size-6 rounded-full transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ring-offset-background",
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
        placeholder="Label title"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        maxLength={255}
        className="flex-1 h-8.5 text-xs sm:text-sm bg-background border-input rounded-md px-3"
      />

      {/* Cancel Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="h-8.5 px-3 text-xs sm:text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
      >
        Cancel
      </Button>

      {/* Submit Button */}
      <Button
        type="submit"
        size="sm"
        disabled={!name.trim() || isSubmitting}
        className="h-8.5 px-4 text-xs sm:text-sm font-medium bg-[#0c66e4] hover:bg-[#0052cc] text-white rounded-md cursor-pointer disabled:opacity-50 shadow-none transition-colors"
      >
        {submitLabel}
      </Button>
    </form>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────

export default function LabelPage() {
  const { projectId } = useParams() as { projectId: string };
  const { data: projectData, isLoading: isLoadingProject, isError } = useProjectDetails(projectId);
  const project = (projectData as any)?.project || projectData;

  const { data: rawLabels = [], isLoading: isLoadingLabels } = useProjectLabels(projectId);
  const createMutation = useCreateProjectLabel(projectId);
  const updateMutation = useUpdateProjectLabel(projectId);
  const deleteMutation = useDeleteProjectLabel(projectId);
  const reorderMutation = useReorderProjectLabels(projectId);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Creation & Editing States
  const [isCreating, setIsCreating] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

  // Delete State
  const [deletingLabel, setDeletingLabel] = useState<Label | null>(null);

  // Drag-and-drop reorder state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localLabels, setLocalLabels] = useState<Label[] | null>(null);

  // Sync local labels with server rawLabels when not actively dragging
  const labelsToDisplay = localLabels !== null ? localLabels : rawLabels;

  const filteredLabels = useMemo(() => {
    if (!searchQuery.trim()) return labelsToDisplay;
    const q = searchQuery.toLowerCase().trim();
    return labelsToDisplay.filter((l) => l.name.toLowerCase().includes(q));
  }, [labelsToDisplay, searchQuery]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleCreateLabel = async (name: string, color: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const isDuplicate = rawLabels.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      toast.error(`A label with name "${trimmed}" already exists in this project`);
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: trimmed,
        color,
      });
      setIsCreating(false);
    } catch {
      // Handled by mutation onError
    }
  };

  const handleUpdateLabel = async (labelId: string, name: string, color: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const isDuplicate = rawLabels.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase() && l.id !== labelId
    );
    if (isDuplicate) {
      toast.error(`A label with name "${trimmed}" already exists in this project`);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        labelId,
        name: trimmed,
        color,
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
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar title="Labels" Icon={Tag} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
            <Skeleton className="h-8 w-48 rounded" />
            <Skeleton className="h-4 w-80 rounded" />
            <div className="flex justify-between gap-4">
              <Skeleton className="h-8.5 w-64 rounded-md" />
              <Skeleton className="h-8.5 w-24 rounded-md" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar title="Labels" Icon={Tag} />
        <div className="flex-1 p-6 md:p-8 text-sm text-muted-foreground">
          Error loading project.
        </div>
      </div>
    );
  }

  const hasLabels = rawLabels.length > 0;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* ── TopBar: only icon + title as in screenshots ── */}
      <TopBar title="Labels" Icon={Tag} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
          {/* ── Page Header ── */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Labels
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <span>Labels help you group and filter work items in this project.</span>{' '}
              <a
                href="https://support.atlassian.com/jira-software-cloud/docs/label-and-tag-issues/"
                target="_blank"
                rel="noreferrer"
                className="text-foreground font-medium hover:underline inline-flex items-center gap-0.5 ml-0.5"
              >
                Docs <ArrowUpRight className="size-3.5 inline" />
              </a>
            </p>
          </div>

          {/* ── Toolbar: Search & Add Label Button ── */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-64 sm:w-72">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 pl-9 text-xs sm:text-sm rounded-md border-border bg-background"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setEditingLabelId(null);
              }}
              className="h-8.5 px-3.5 text-xs sm:text-sm font-medium bg-[#0c66e4] hover:bg-[#0052cc] text-white rounded-md cursor-pointer transition-colors shadow-none"
            >
              Add label
            </Button>
          </div>

          {/* ── Main Content Area ── */}
          {!hasLabels && !isCreating ? (
            /* ── Image 1: Empty State ── */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <EmptyStateIllustration className="size-24 mb-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">No labels yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                Create personalized labels to effectively categorize and manage your work items.
              </p>
              <Button
                type="button"
                onClick={() => setIsCreating(true)}
                className="mt-4 h-8.5 px-3.5 text-xs sm:text-sm font-medium bg-[#0c66e4] hover:bg-[#0052cc] text-white rounded-md cursor-pointer shadow-none transition-colors"
              >
                Create your first label
              </Button>
            </div>
          ) : !hasLabels && isCreating ? (
            /* ── Image 2: Inline Form when creating first label ── */
            <div className="rounded-lg border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs">
              <LabelInlineForm
                initialName=""
                initialColor="#0c66e4"
                submitLabel="Add"
                onSubmit={handleCreateLabel}
                onCancel={() => setIsCreating(false)}
                isSubmitting={createMutation.isPending}
              />
            </div>
          ) : (
            /* ── Image 3 & 4: Labels List ── */
            <div className="rounded-lg border border-border/80 bg-card p-3 sm:p-4 space-y-2 shadow-2xs">
              {/* If user clicked "Add label" while labels exist, show inline form at top */}
              {isCreating && (
                <div className="rounded-md border border-border/70 bg-background p-2.5 px-3.5 mb-2">
                  <LabelInlineForm
                    initialName=""
                    initialColor="#0c66e4"
                    submitLabel="Add"
                    onSubmit={handleCreateLabel}
                    onCancel={() => setIsCreating(false)}
                    isSubmitting={createMutation.isPending}
                  />
                </div>
              )}

              {/* Filtered labels list */}
              {filteredLabels.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
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
                        submitLabel="Save"
                        onSubmit={(name, color) =>
                          handleUpdateLabel(label.id, name, color)
                        }
                        onCancel={() => setEditingLabelId(null)}
                        isSubmitting={updateMutation.isPending}
                      />
                    </div>
                  ) : (
                    /* Normal Label Item Row (Image 3 & Image 4) */
                    <div
                      key={label.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "rounded-md border border-border/70 bg-background hover:bg-muted/20 px-3.5 py-2.5 flex items-center justify-between transition-colors group select-none",
                        draggedIndex === index && "opacity-50 border-dashed"
                      )}
                    >
                      {/* Left: Grip Handle + Filled Tag Icon + Label Title */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <GripVertical className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 transition-colors" />
                        <Tag
                          className="size-4 shrink-0 fill-current"
                          style={{ color: label.color || '#ef4444' }}
                        />
                        <span className="text-sm font-medium text-foreground truncate">
                          {label.name}
                        </span>
                      </div>

                      {/* Right: Three Dots Action Menu (Image 4) */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                            title="More options"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 p-1">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingLabelId(label.id);
                              setIsCreating(false);
                            }}
                            className="cursor-pointer gap-2 text-xs py-1.5"
                          >
                            <Pencil className="size-3.5 text-muted-foreground" />
                            <span>Edit label</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingLabel(label)}
                            className="cursor-pointer gap-2 text-xs py-1.5 text-destructive focus:text-destructive focus:bg-destructive/10"
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
      </div>

      {/* ── Delete Confirmation Modal ── */}
      <DeleteModal
        isOpen={Boolean(deletingLabel)}
        onClose={() => setDeletingLabel(null)}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
        title="Delete label"
        description={`Are you sure you want to delete "${deletingLabel?.name || ''}"? This label will be removed from all work items.`}
        confirmText="Delete label"
        cancelText="Cancel"
      />
    </div>
  );
}
