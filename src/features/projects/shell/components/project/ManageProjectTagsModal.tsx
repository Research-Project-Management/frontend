'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, Check, Trash2, Loader2, Folder } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { cn } from '@/shared/lib/utils';
import {
  useUserProjectLabels,
  useCreateProjectLabel,
  useAssignProjectLabels,
  useDeleteProjectLabel,
} from '../../hooks/use-project-labels';
import type { Project } from '../../types/project.types';

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Rose', hex: '#EF4444' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Pink', hex: '#EC4899' },
];

export interface ManageProjectTagsModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ManageProjectTagsModal({
  project,
  isOpen,
  onClose,
}: ManageProjectTagsModalProps) {
  const { labels, isLoading: isLoadingLabels } = useUserProjectLabels();
  const createLabelMutation = useCreateProjectLabel();
  const assignLabelsMutation = useAssignProjectLabels();
  const deleteLabelMutation = useDeleteProjectLabel();

  // Selected tag IDs for this project
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // Form state for creating a new tag
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0].hex);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<string | null>(null);

  // Sync selected tags when project changes
  useEffect(() => {
    if (project && project.projectLabelsList) {
      setSelectedTagIds(project.projectLabelsList.map((l) => l.id));
    } else {
      setSelectedTagIds([]);
    }
  }, [project]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    try {
      const created = await createLabelMutation.mutateAsync({
        name: trimmed,
        color: newTagColor,
      });
      setNewTagName('');
      setIsCreating(false);
      // Automatically check the newly created tag for the current project
      if (project) {
        setSelectedTagIds((prev) => [...prev, created.id]);
      }
    } catch {
      // Error handled by mutation hook toast
    }
  };

  const handleDeleteTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteTagId(tagId);
  };

  const handleSave = async () => {
    if (project) {
      await assignLabelsMutation.mutateAsync({
        projectId: project.id,
        labelIds: selectedTagIds,
      });
    }
    onClose();
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-card border-border shadow-raised-200">
        <DialogTitle className="flex items-center gap-2 text-16 font-semibold text-foreground">
          <Folder className="size-4 text-primary shrink-0" />
          <span>{project ? 'Manage Tags & Folders' : 'Create & Manage Tags'}</span>
        </DialogTitle>
        <DialogDescription className="text-13 text-muted-foreground mt-1">
          {project
            ? `Organize "${project.name}" by tagging it with topics, labs, or folders.`
            : 'Create tags to organize your manuscripts and research projects.'}
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {/* Tag Checkbox List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {isLoadingLabels ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-4 rounded-sm shrink-0" />
                      <Skeleton className="size-2.5 rounded-full shrink-0" />
                      <Skeleton className="h-3.5 w-28 rounded-sm" />
                    </div>
                    <Skeleton className="size-4 rounded-sm shrink-0" />
                  </div>
                ))}
              </div>
            ) : labels.length === 0 ? (
              <PlaneEmptyState
                isCompact
                variant="labels"
                title="No tags created yet"
                description="Create your first tag below to start categorizing projects."
              />
            ) : (
              labels.map((label) => {
                const isChecked = selectedTagIds.includes(label.id);
                return (
                  <div
                    key={label.id}
                    onClick={() => project && handleToggleTag(label.id)}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-md border text-12 transition-colors',
                      project
                        ? 'cursor-pointer hover:bg-muted/60'
                        : 'cursor-default',
                      isChecked
                        ? 'bg-muted/80 border-primary/40 font-medium text-foreground'
                        : 'bg-card border-border text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {project && (
                        <div
                          className={cn(
                            'size-4 rounded flex items-center justify-center border transition-colors shrink-0',
                            isChecked
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border bg-background'
                          )}
                        >
                          {isChecked && <Check className="size-3" />}
                        </div>
                      )}
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="truncate">{label.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteTag(label.id, e)}
                      className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0 ml-2 relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      title="Delete tag"
                      aria-label={`Delete tag ${label.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Create New Tag Section */}
          <div className="pt-2 border-t border-border">
            {!isCreating ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="w-full h-8 gap-1.5 text-12 font-medium cursor-pointer border-dashed relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Plus className="size-3.5" />
                <span>Create New Tag / Folder</span>
              </Button>
            ) : (
              <form onSubmit={handleCreateNewTag} className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border">
                <div className="text-12 font-medium text-foreground">New Tag Details</div>
                <Input
                  autoFocus
                  placeholder="e.g., CVPR 2026, PhD Thesis, Grant..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-8 text-13 bg-background focus-visible:ring-1 focus-visible:ring-ring"
                />

                {/* Color swatches */}
                <div className="flex items-center gap-1.5">
                  <span className="text-12 text-muted-foreground mr-1">Color:</span>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewTagColor(c.hex)}
                      className={cn(
                        'size-5 rounded-full transition-transform cursor-pointer shrink-0 flex items-center justify-center relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        newTagColor === c.hex && 'ring-1 ring-primary ring-offset-1 scale-110'
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      aria-label={`Select ${c.name} color`}
                    >
                      {newTagColor === c.hex && <Check className="size-2.5 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCreating(false);
                      setNewTagName('');
                    }}
                    className="h-7 px-2.5 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newTagName.trim() || createLabelMutation.isPending}
                    className="h-7 px-2.5 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {createLabelMutation.isPending ? (
                      <Loader2 className="size-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="size-3 mr-1" />
                    )}
                    <span>Add Tag</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {project ? 'Cancel' : 'Close'}
          </Button>
          {project && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={assignLabelsMutation.isPending}
              className="h-8 px-3 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {assignLabelsMutation.isPending && (
                <Loader2 className="size-3 animate-spin mr-1.5" />
              )}
              <span>Save Changes</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {pendingDeleteTagId && (
      <AlertDialog
        open={Boolean(pendingDeleteTagId)}
        onOpenChange={(open) => !open && setPendingDeleteTagId(null)}
      >
        <AlertDialogContent className="w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Delete this tag? It will be removed from all projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="h-8 text-xs cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="sm"
              className="h-8 text-xs cursor-pointer"
              onClick={async () => {
                const tagId = pendingDeleteTagId;
                setPendingDeleteTagId(null);
                await deleteLabelMutation.mutateAsync(tagId);
                setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}
    </>
  );
}
