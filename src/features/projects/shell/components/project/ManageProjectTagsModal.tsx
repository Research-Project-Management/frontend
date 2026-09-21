'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, Check, Trash2, Loader2, Folder } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
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

  const handleDeleteTag = async (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this tag? It will be removed from all projects.')) {
      await deleteLabelMutation.mutateAsync(tagId);
      setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    }
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-card border-border">
        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Folder className="size-4 text-primary shrink-0" />
          <span>{project ? 'Manage Tags & Folders' : 'Create & Manage Tags'}</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground mt-1">
          {project
            ? `Organize "${project.name}" by tagging it with topics, labs, or folders.`
            : 'Create tags to organize your manuscripts and research projects.'}
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {/* Tag Checkbox List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {isLoadingLabels ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                <span>Loading tags...</span>
              </div>
            ) : labels.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4">
                <Tag className="size-6 mx-auto mb-1.5 opacity-40" />
                <p className="font-medium text-foreground">No tags created yet</p>
                <p className="mt-0.5 text-muted-foreground">
                  Create your first tag below to start categorizing projects.
                </p>
              </div>
            ) : (
              labels.map((label) => {
                const isChecked = selectedTagIds.includes(label.id);
                return (
                  <div
                    key={label.id}
                    onClick={() => project && handleToggleTag(label.id)}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
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
                      className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0 ml-2"
                      title="Delete tag"
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
                className="w-full gap-1.5 text-xs cursor-pointer border-dashed"
              >
                <Plus className="size-3.5" />
                <span>Create New Tag / Folder</span>
              </Button>
            ) : (
              <form onSubmit={handleCreateNewTag} className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border">
                <div className="text-xs font-medium text-foreground">New Tag Details</div>
                <Input
                  autoFocus
                  placeholder="e.g., CVPR 2026, PhD Thesis, Grant..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-8 text-xs bg-background"
                />

                {/* Color swatches */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Color:</span>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewTagColor(c.hex)}
                      className={cn(
                        'size-5 rounded-full transition-transform cursor-pointer shrink-0 flex items-center justify-center',
                        newTagColor === c.hex && 'ring-2 ring-primary ring-offset-1 scale-110'
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
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
                    className="h-7 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newTagName.trim() || createLabelMutation.isPending}
                    className="h-7 text-xs cursor-pointer"
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
            className="text-xs cursor-pointer"
          >
            {project ? 'Cancel' : 'Close'}
          </Button>
          {project && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={assignLabelsMutation.isPending}
              className="text-xs cursor-pointer"
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
  );
}
