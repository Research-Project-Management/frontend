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
  X,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  RotateCcw,
  ChevronUp,
} from 'lucide-react';
import { useProjectStatesSettings } from '../../hooks/use-project-states-settings';
import type { ProjectState } from '@/features/projects/shell/types/project.types';

export const STATE_PALETTE: Array<{ id: string; value: string; label: string }> = [
  { id: 'slate', value: '#8A9093', label: 'Slate' },
  { id: 'dark-gray', value: '#525866', label: 'Dark Gray' },
  { id: 'yellow', value: '#EAB308', label: 'Yellow' },
  { id: 'gold', value: '#CA8A04', label: 'Gold' },
  { id: 'emerald', value: '#10B981', label: 'Emerald' },
  { id: 'green', value: '#22C55E', label: 'Green' },
  { id: 'sky', value: '#0EA5E9', label: 'Sky' },
  { id: 'blue', value: '#3B82F6', label: 'Blue' },
  { id: 'indigo', value: '#6366F1', label: 'Indigo' },
  { id: 'purple', value: '#A855F7', label: 'Purple' },
  { id: 'rose', value: '#F43F5E', label: 'Rose' },
  { id: 'zinc', value: '#71717A', label: 'Zinc' },
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

  // Collapsible panel state
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Inline add state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
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
    setNewColor('#3B82F6');
    setNewError('');
    setIsCollapsed(false);
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
      description: newDescription.trim() || undefined,
      color: newColor,
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
    setEditColor(s.color || '#3B82F6');
    setEditError('');
    setTimeout(() => editNameRef.current?.focus(), 50);
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
        description: editDescription.trim(),
        color: editColor,
      },
    });
    setEditingId(null);
    setEditError('');
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
    await reorderStates(reordered.map((s, idx) => ({ id: s.id, sequence: idx + 1 })));
  };

  const handleOpenDelete = (s: ProjectState) => {
    const candidates = states.filter((other) => other.id !== s.id);
    const preferredFallback = candidates.find((c) => c.isDefault) || candidates[0];
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
    <div className="space-y-4">
      {/* Group Card - Identical container style to Work Item States */}
      <div className="rounded-xl border border-border bg-background p-3.5 sm:p-4 space-y-2.5 transition-colors">
        {/* Header: Arrow toggle + Icon + Name on left; Reset Defaults + Plus on right */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center gap-2 group/title select-none text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 -ml-1"
          >
            <span className="text-muted-foreground/80 group-hover/title:text-foreground transition-colors">
              {isCollapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </span>
            <CircleDot className="size-4 text-foreground/80" />
            <div className="flex items-center gap-2">
              <span className="text-13 font-semibold text-foreground tracking-tight">
                Project lifecycle stages
              </span>
              {currentState && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-11 font-medium bg-muted text-muted-foreground border border-border/60">
                  Current: <span className="font-medium text-foreground">{currentStateLabel}</span>
                </span>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              disabled={isMutating}
              className="h-7 px-2 text-12 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md cursor-pointer gap-1.5"
              title="Reset to 8 default research stages"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleStartAdd}
              disabled={isAdding || isMutating}
              className="relative size-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1.5 md:before:hidden"
              aria-label="Add project state"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {/* Collapsible Content */}
        {!isCollapsed && (
          <div className="space-y-2 pt-1">
            {/* Inline Creation Card (Identical to Work Item inline card) */}
            {isAdding && (
              <div className="rounded-lg border border-border bg-background p-3 space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <Popover open={isNewColorPickerOpen} onOpenChange={setIsNewColorPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="relative size-7 rounded-md shrink-0 border border-border/70 hover:scale-105 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                          style={{ backgroundColor: newColor }}
                          aria-label="Pick state color"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2.5 shadow-overlay" align="start">
                        <div className="grid grid-cols-4 gap-2">
                          {STATE_PALETTE.map((c: { id: string; value: string; label: string }) => {
                            const isSelected = newColor?.toLowerCase() === c.value.toLowerCase();
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setNewColor(c.value);
                                  setIsNewColorPickerOpen(false);
                                }}
                                className="relative size-7 rounded-md flex items-center justify-center border border-border cursor-pointer hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                                style={{ backgroundColor: c.value }}
                                aria-label={c.label}
                              >
                                {isSelected && <Check className="size-3.5 text-white" />}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Input
                      ref={newNameRef}
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        if (newError) setNewError('');
                      }}
                      placeholder="State name"
                      autoFocus
                      className={`h-8 text-13 font-medium bg-background ${
                        newError
                          ? 'border-destructive focus-visible:ring-1 focus-visible:ring-destructive'
                          : 'border-border/80 focus-visible:ring-1 focus-visible:ring-ring'
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate();
                        if (e.key === 'Escape') setIsAdding(false);
                      }}
                    />
                  </div>
                  {newError && (
                    <p className="text-11 text-destructive font-normal pl-9">
                      {newError}
                    </p>
                  )}
                </div>

                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe this stage of the project lifecycle"
                  rows={2}
                  className="w-full px-3 py-2 text-13 rounded-md border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsAdding(false);
                  }}
                />

                <div className="flex items-center justify-end gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAdding(false)}
                    className="relative h-8 px-3 text-12 font-medium rounded-md border-border/80 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreate}
                    disabled={isMutating || !newName.trim()}
                    className="relative h-8 px-3.5 text-12 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                  >
                    {isMutating ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            )}

            {/* States List */}
            {states.length === 0 && !isAdding ? (
              <div className="py-2.5 text-center text-13 text-muted-foreground italic rounded-md">
                No project states configured.
              </div>
            ) : (
              states.map((s, index) => {
                const isEditing = editingId === s.id;
                const isFirst = index === 0;
                const isLast = index === states.length - 1;
                const isCurrent = currentState?.id === s.id;

                if (isEditing) {
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border bg-background p-3 space-y-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <Popover open={isEditColorPickerOpen} onOpenChange={setIsEditColorPickerOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="relative size-7 rounded-md shrink-0 border border-border/70 hover:scale-105 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                                style={{ backgroundColor: editColor }}
                                aria-label="Pick state color"
                              />
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2.5 shadow-overlay" align="start">
                              <div className="grid grid-cols-4 gap-2">
                                {STATE_PALETTE.map((c: { id: string; value: string; label: string }) => {
                                  const isSelected = editColor?.toLowerCase() === c.value.toLowerCase();
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => {
                                        setEditColor(c.value);
                                        setIsEditColorPickerOpen(false);
                                      }}
                                      className="relative size-7 rounded-md flex items-center justify-center border border-border cursor-pointer hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                                      style={{ backgroundColor: c.value }}
                                      aria-label={c.label}
                                    >
                                      {isSelected && <Check className="size-3.5 text-white" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <Input
                            ref={editNameRef}
                            value={editName}
                            onChange={(e) => {
                              setEditName(e.target.value);
                              if (editError) setEditError('');
                            }}
                            placeholder="State name"
                            autoFocus
                            className={`h-8 text-13 font-medium bg-background ${
                              editError
                                ? 'border-destructive focus-visible:ring-1 focus-visible:ring-destructive'
                                : 'border-border/80 focus-visible:ring-1 focus-visible:ring-ring'
                            }`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(s.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                        </div>
                        {editError && (
                          <p className="text-11 text-destructive font-normal pl-9">
                            {editError}
                          </p>
                        )}
                      </div>

                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Describe this stage of the project lifecycle"
                        rows={2}
                        className="w-full px-3 py-2 text-13 rounded-md border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />

                      <div className="flex items-center justify-end gap-2 pt-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="relative h-8 px-3 text-12 font-medium rounded-md border-border/80 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(s.id)}
                          className="relative h-8 px-3.5 text-12 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                        >
                          {isMutating ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={s.id}
                    className="group/item flex items-center justify-between px-3.5 py-2 min-h-10 rounded-lg border border-border/60 bg-background hover:border-border transition-colors"
                  >
                    {/* Left: Reorder buttons + Color dot + Title + Description */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                      {/* Discrete reorder arrows */}
                      <div className="flex flex-col -space-y-1 opacity-0 group-hover/item:opacity-70 hover:!opacity-100 transition-opacity">
                        <button
                          type="button"
                          disabled={isFirst || isMutating}
                          onClick={() => handleMove(index, 'up')}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                          aria-label="Move stage up"
                        >
                          <ChevronUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast || isMutating}
                          onClick={() => handleMove(index, 'down')}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                          aria-label="Move stage down"
                        >
                          <ChevronDown className="size-3" />
                        </button>
                      </div>

                      <span
                        className="size-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: s.color || '#3B82F6' }}
                      />

                      <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-13 font-normal text-foreground truncate">
                            {s.name}
                          </span>
                          {s.isDefault && (
                            <span className="px-1.5 py-0.5 rounded text-10 font-medium bg-muted text-muted-foreground border border-border/60 shrink-0">
                              Default
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-10 font-medium bg-muted text-foreground border border-border/60 shrink-0">
                              Current stage
                            </span>
                          )}
                        </div>

                        {s.description && (
                          <span className="text-12 text-muted-foreground truncate hidden md:inline-block max-w-sm">
                            {s.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions on hover (Identical to Work Item state items) */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 max-md:opacity-100 transition-opacity shrink-0">
                      {!s.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(s)}
                          disabled={isMutating}
                          className="relative text-12 text-muted-foreground hover:text-foreground mr-1.5 font-normal transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1 before:absolute before:-inset-1 md:before:hidden"
                        >
                          Mark as default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(s)}
                        disabled={isMutating}
                        className="relative size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1.5 md:before:hidden"
                        aria-label="Edit state"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={s.isDefault || states.length <= 1 || isMutating}
                        onClick={() => handleOpenDelete(s)}
                        className="relative size-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1.5 md:before:hidden"
                        aria-label="Delete state"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Delete Project State Modal */}
      <Dialog
        open={Boolean(deletingState)}
        onOpenChange={(open) => {
          if (!open) setDeletingState(null);
        }}
      >
        <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-border rounded-lg shadow-raised-200 bg-background">
          <div className="p-6">
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                Delete state
              </DialogTitle>
              <DialogDescription className="text-12 text-muted-foreground pt-1.5 leading-relaxed">
                Are you sure you want to delete the stage{' '}
                <span className="font-semibold text-foreground">
                  &ldquo;{deletingState?.name}&rdquo;
                </span>
                ? Projects currently in this stage can be transitioned to another stage.
              </DialogDescription>
            </DialogHeader>

            <div className="pt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-12 font-medium text-foreground">
                  Move existing projects to
                </label>
                <select
                  value={fallbackStateId}
                  onChange={(e) => setFallbackStateId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-12 font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  {states
                    .filter((s) => s.id !== deletingState?.id)
                    .map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name} {target.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingState(null)}
              className="h-8 px-3 text-12 font-medium rounded-md border-border/80 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isMutating}
              className="h-8 px-3.5 text-12 font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
            >
              {isMutating ? 'Deleting...' : 'Delete state'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent className="max-w-[440px] p-0 overflow-hidden border border-border rounded-lg shadow-raised-200 bg-background">
          <div className="p-6">
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                Reset lifecycle stages
              </DialogTitle>
              <DialogDescription className="text-12 text-muted-foreground pt-1.5 leading-relaxed">
                This will reset project lifecycle stages back to the standard 8 academic research stages. Custom states and order changes will be reverted.
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="px-6 py-3 border-t border-border bg-muted/20 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsResetConfirmOpen(false)}
              className="h-8 px-3 text-12 font-medium rounded-md border-border/80 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleResetConfirm}
              disabled={isMutating}
              className="h-8 px-3.5 text-12 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer shadow-none"
            >
              {isMutating ? 'Resetting...' : 'Reset to defaults'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectStatesSection;
