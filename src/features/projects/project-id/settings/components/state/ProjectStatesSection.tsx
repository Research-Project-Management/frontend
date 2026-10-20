'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { useProjectStatesSettings } from '../../hooks/use-project-states-settings';
import type { ProjectState } from '@/features/projects/shell/types/project.types';

export const STATE_PALETTE = [
  { id: 'slate', value: '#64748B', label: 'Slate' },
  { id: 'sky', value: '#0284C7', label: 'Sky' },
  { id: 'amber', value: '#D97706', label: 'Amber' },
  { id: 'blue', value: '#2563EB', label: 'Blue' },
  { id: 'violet', value: '#7C3AED', label: 'Violet' },
  { id: 'green', value: '#16A34A', label: 'Green' },
  { id: 'orange', value: '#F97316', label: 'Orange' },
  { id: 'gray', value: '#9CA3AF', label: 'Gray' },
  { id: 'emerald', value: '#10B981', label: 'Emerald' },
  { id: 'rose', value: '#F43F5E', label: 'Rose' },
  { id: 'indigo', value: '#6366F1', label: 'Indigo' },
  { id: 'purple', value: '#A855F7', label: 'Purple' },
];

interface ProjectStatesSectionProps {
  projectId: string;
}

export function ProjectStatesSection({ projectId }: ProjectStatesSectionProps) {
  const {
    states,
    currentState,
    currentStateLabel,
    isLoading,
    isMutating,
    createState,
    updateState,
    reorderStates,
    deleteState,
    resetStates,
  } = useProjectStatesSettings(projectId);

  // Inline add state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#2563EB');
  const [newError, setNewError] = useState('');
  const [isNewColorPickerOpen, setIsNewColorPickerOpen] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editError, setEditError] = useState('');
  const [isEditColorPickerOpen, setIsEditColorPickerOpen] = useState(false);
  const editNameRef = useRef<HTMLInputElement>(null);

  // Delete modal state
  const [deletingState, setDeletingState] = useState<ProjectState | null>(null);
  const [fallbackStateId, setFallbackStateId] = useState<string>('');

  // Reset confirmation modal
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleStartAdd = () => {
    setEditingId(null);
    setIsAdding(true);
    setNewName('');
    setNewDescription('');
    setNewColor('#2563EB');
    setNewError('');
    setTimeout(() => newNameRef.current?.focus(), 50);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setNewError('State name is required');
      newNameRef.current?.focus();
      return;
    }
    await createState({
      name: newName.trim(),
      color: newColor,
      description: newDescription.trim(),
      sequence: states.length,
    });
    setIsAdding(false);
    setNewName('');
    setNewDescription('');
    setNewError('');
  };

  const handleStartEdit = (s: ProjectState) => {
    setIsAdding(false);
    setEditingId(s.id);
    setEditName(s.name);
    setEditDescription(s.description || '');
    setEditColor(s.color || '#0284C7');
    setEditError('');
  };

  const handleSaveEdit = async (stateId: string) => {
    if (!editName.trim()) {
      setEditError('State name is required');
      editNameRef.current?.focus();
      return;
    }
    await updateState({
      stateId,
      data: {
        name: editName.trim(),
        color: editColor,
        description: editDescription.trim(),
      },
    });
    setEditingId(null);
  };

  const handleSetDefault = async (s: ProjectState) => {
    await updateState({
      stateId: s.id,
      data: { isDefault: true },
    });
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= states.length) return;

    const reordered = [...states];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const payload = reordered.map((s, idx) => ({ id: s.id, sequence: idx }));
    await reorderStates(payload);
  };

  const handleOpenDelete = (s: ProjectState) => {
    const remaining = states.filter((other) => other.id !== s.id);
    const preferredFallback = remaining.find((c) => c.isDefault) || remaining[0];
    setDeletingState(s);
    setFallbackStateId(preferredFallback?.id || '');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingState) return;
    await deleteState({
      stateId: deletingState.id,
      fallbackStateId: fallbackStateId || undefined,
    });
    setDeletingState(null);
  };

  const handleResetConfirm = async () => {
    await resetStates();
    setIsResetConfirmOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
        <div>
          <h3 className="text-13 font-semibold text-foreground tracking-tight flex items-center gap-2">
            <span>Project Lifecycle States</span>
            {currentState && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-11 font-medium bg-muted text-foreground border border-border">
                <Clock className="size-3 text-muted-foreground" />
                Current: <span className="font-semibold">{currentStateLabel}</span>
              </span>
            )}
          </h3>
          <p className="text-12 text-muted-foreground mt-0.5">
            Default 8 research stages. You can customize, reorder, add, or delete any state.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetConfirmOpen(true)}
            disabled={isMutating}
            className="h-8 text-12 font-medium gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground border-border hover:bg-muted"
          >
            <RotateCcw className="size-3.5" />
            Reset Defaults
          </Button>

          <Button
            size="sm"
            onClick={handleStartAdd}
            disabled={isAdding || isMutating}
            className="h-8 text-12 font-medium gap-1.5 bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none"
          >
            <Plus className="size-3.5" />
            Add State
          </Button>
        </div>
      </div>

      {/* Inline Creation Card */}
      {isAdding && (
        <div className="rounded-xl border border-primary/40 bg-card p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-12 font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              New Project State
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-muted-foreground hover:text-foreground text-12 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <Popover open={isNewColorPickerOpen} onOpenChange={setIsNewColorPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="size-8 rounded-lg shrink-0 border border-border/70 hover:scale-105 transition-transform cursor-pointer flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: newColor }}
                  aria-label="Pick color"
                >
                  <span className="size-2.5 rounded-full bg-white/80 shadow-xs" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2.5 shadow-overlay" align="start">
                <div className="text-11 font-medium text-muted-foreground mb-2 px-0.5">
                  Select state color
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {STATE_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setNewColor(c.value);
                        setIsNewColorPickerOpen(false);
                      }}
                      className="size-6 rounded-md transition-transform hover:scale-110 cursor-pointer flex items-center justify-center"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {newColor === c.value && <Check className="size-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex-1">
              <Input
                ref={newNameRef}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (newError) setNewError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
                placeholder="State name"
                className="h-8 text-13 bg-background border-border"
              />
            </div>
          </div>
          {newError && <p className="text-11 text-destructive font-medium">{newError}</p>}

          <Input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description or guidelines for this research phase"
            className="h-8 text-12 text-muted-foreground bg-background border-border"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsAdding(false);
            }}
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              className="h-7 text-12 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isMutating || !newName.trim()}
              className="h-7 text-12 bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none"
            >
              Create State
            </Button>
          </div>
        </div>
      )}

      {/* States List */}
      <div className="rounded-xl border border-border bg-background divide-y divide-border/60 overflow-hidden shadow-xs">
        {states.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-13 text-muted-foreground">No project states configured.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetConfirm}
              className="h-8 text-12 gap-1.5 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              Reset to 8 Research States
            </Button>
          </div>
        ) : (
          states.map((s, index) => {
            const isEditing = editingId === s.id;
            const isFirst = index === 0;
            const isLast = index === states.length - 1;
            const isCurrent = currentState?.id === s.id;

            if (isEditing) {
              return (
                <div key={s.id} className="p-3.5 bg-card/60 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Popover open={isEditColorPickerOpen} onOpenChange={setIsEditColorPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="size-8 rounded-lg shrink-0 border border-border/70 hover:scale-105 transition-transform cursor-pointer flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: editColor }}
                          aria-label="Change color"
                        >
                          <span className="size-2.5 rounded-full bg-white/80 shadow-xs" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2.5 shadow-overlay" align="start">
                        <div className="text-11 font-medium text-muted-foreground mb-2 px-0.5">
                          Select color
                        </div>
                        <div className="grid grid-cols-6 gap-1.5">
                          {STATE_PALETTE.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setEditColor(c.value);
                                setIsEditColorPickerOpen(false);
                              }}
                              className="size-6 rounded-md transition-transform hover:scale-110 cursor-pointer flex items-center justify-center"
                              style={{ backgroundColor: c.value }}
                              title={c.label}
                            >
                              {editColor === c.value && (
                                <Check className="size-3 text-white stroke-[3]" />
                              )}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="flex-1">
                      <Input
                        ref={editNameRef}
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          if (editError) setEditError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(s.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        placeholder="State name"
                        className="h-8 text-13 bg-background border-border"
                      />
                    </div>
                  </div>
                  {editError && <p className="text-11 text-destructive font-medium">{editError}</p>}

                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description or guidelines for this phase"
                    className="h-8 text-12 text-muted-foreground bg-background border-border"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(s.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      className="h-7 text-12 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(s.id)}
                      disabled={isMutating || !editName.trim()}
                      className="h-7 text-12 bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={s.id}
                className="group flex items-center justify-between p-3 sm:px-4 hover:bg-muted/40 transition-colors gap-3"
              >
                {/* Drag handle & state name & dot */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center gap-0.5 text-muted-foreground/60 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst || isMutating}
                      onClick={() => handleMove(index, 'up')}
                      className="size-5 flex items-center justify-center hover:text-foreground disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast || isMutating}
                      onClick={() => handleMove(index, 'down')}
                      className="size-5 flex items-center justify-center hover:text-foreground disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>

                  <span
                    className="size-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: s.color || '#0284C7' }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-13 font-medium text-foreground tracking-tight">
                        {s.name}
                      </span>
                      {s.isDefault && (
                        <span className="px-1.5 py-0.2 rounded text-10 font-semibold bg-primary/10 text-primary border border-primary/20">
                          Default
                        </span>
                      )}
                      {isCurrent && (
                        <span className="px-1.5 py-0.2 rounded text-10 font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Current Stage
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-11 text-muted-foreground truncate max-w-lg mt-0.5">
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                  {!s.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(s)}
                      disabled={isMutating}
                      className="h-7 px-2 text-11 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      title="Set as starting default state for new projects"
                    >
                      Set Default
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleStartEdit(s)}
                    disabled={isMutating}
                    className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer"
                    aria-label={`Edit ${s.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDelete(s)}
                    disabled={isMutating}
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer"
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deletingState)}
        onOpenChange={(open) => !open && setDeletingState(null)}
      >
        <DialogContent className="max-w-md shadow-overlay">
          <DialogHeader>
            <DialogTitle className="text-15 font-semibold text-foreground">
              Delete State: {deletingState?.name}
            </DialogTitle>
            <DialogDescription className="text-12 text-muted-foreground pt-1.5 leading-relaxed">
              Are you sure you want to permanently delete this state from the project?
              {currentState?.id === deletingState?.id && (
                <span className="block mt-2 font-medium text-amber-600 dark:text-amber-400">
                  Notice: The project is currently at this state. It will be moved to another
                  available state.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingState(null)}
              className="text-12 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isMutating}
              className="text-12 cursor-pointer"
            >
              Delete State
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Modal */}
      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent className="max-w-md shadow-overlay">
          <DialogHeader>
            <DialogTitle className="text-15 font-semibold text-foreground">
              Reset to 8 Research States?
            </DialogTitle>
            <DialogDescription className="text-12 text-muted-foreground pt-1.5 leading-relaxed">
              This will reset this project&apos;s lifecycle states back to the 8 standard
              research phases: <br />
              <strong className="text-foreground">
                Ideation, Planning, Experimentation, Drafting, Review, Published, Paused, Cancelled
              </strong>
              . Any custom states you created will be replaced.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetConfirmOpen(false)}
              className="text-12 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleResetConfirm}
              disabled={isMutating}
              className="text-12 bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none"
            >
              Reset to Defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
