'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Button,
  Skeleton,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import TopBar from '../components/layout/TopBar';
import {
  Plus,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useStateSettings } from '../hooks/use-state-settings';
import type {
  WorkItemState,
  StateGroup,
} from '../types/state.types';
import {
  STATE_GROUPS,
  STATE_GROUP_CONFIG,
  resolveStateColor,
  resolveStateTitle,
} from '../types/state.types';
import { StateIcon } from '../components/state/StateIcon';

export const STATE_PALETTE = [
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

export default function StatePage() {
  const { projectId } = useParams<{ projectId: string }>();

  const {
    states,
    itemCounts,
    isLoading,
    isMutating,
    createState,
    updateState,
    deleteState,
  } = useStateSettings(projectId);

  // Group collapse state (all expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<StateGroup>>(new Set());

  // Inline Creation State
  const [addingGroup, setAddingGroup] = useState<StateGroup | null>(null);
  const [inlineName, setInlineName] = useState('');
  const [inlineDescription, setInlineDescription] = useState('');
  const [inlineColor, setInlineColor] = useState<string>('#EAB308');
  const [inlineError, setInlineError] = useState<string>('');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Inline Edit State
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState<string>('');
  const [editError, setEditError] = useState<string>('');
  const [isEditColorPickerOpen, setIsEditColorPickerOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Delete modal state
  const [deletingState, setDeletingState] = useState<WorkItemState | null>(null);
  const [fallbackStateId, setFallbackStateId] = useState<string>('');

  const toggleGroup = (group: StateGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Group states by the 5 lifecycle groups
  const statesByGroup = useMemo(() => {
    const map: Record<StateGroup, WorkItemState[]> = {
      backlog: [],
      unstarted: [],
      started: [],
      completed: [],
      cancelled: [],
    };
    for (const s of states) {
      const g: StateGroup = (s.group && (STATE_GROUPS as readonly string[]).includes(s.group))
        ? (s.group as StateGroup)
        : 'unstarted';
      map[g].push(s);
    }
    for (const g of STATE_GROUPS) {
      map[g].sort((a, b) => a.sequence - b.sequence);
    }
    return map;
  }, [states]);

  const handleStartAdd = (group: StateGroup) => {
    if (collapsedGroups.has(group)) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        next.delete(group);
        return next;
      });
    }
    setEditingStateId(null);
    setEditError('');
    setAddingGroup(group);
    setInlineName('');
    setInlineDescription('');
    setInlineError('');
    setInlineColor(STATE_GROUP_CONFIG[group]?.defaultColor || '#EAB308');
  };

  const handleCreateInline = async (group: StateGroup) => {
    if (!inlineName.trim()) {
      setInlineError('State name is required');
      inlineInputRef.current?.focus();
      return;
    }
    await createState({
      name: inlineName.trim(),
      color: inlineColor,
      group,
      description: inlineDescription.trim(),
      isDefault: false,
    });
    setAddingGroup(null);
    setInlineName('');
    setInlineDescription('');
    setInlineError('');
  };

  const handleStartEdit = (s: WorkItemState) => {
    setAddingGroup(null);
    setInlineError('');
    setEditingStateId(s.id);
    setEditName(resolveStateTitle(s));
    setEditDescription(s.description || '');
    setEditColor(resolveStateColor(s, s.color || s.accentColor));
    setEditError('');
  };

  const handleSaveEdit = async (stateId: string) => {
    if (!editName.trim()) {
      setEditError('State name is required');
      editInputRef.current?.focus();
      return;
    }
    const currentState = states.find((s) => s.id === stateId);
    await updateState({
      stateId,
      data: {
        name: editName.trim(),
        color: editColor,
        group: currentState?.group,
        description: editDescription.trim(),
      },
    });
    setEditingStateId(null);
    setEditError('');
  };

  const handleSetDefault = async (s: WorkItemState) => {
    await updateState({
      stateId: s.id,
      data: {
        isDefault: true,
      },
    });
  };

  const handleOpenDeleteModal = (s: WorkItemState) => {
    const candidates = states.filter((other) => other.id !== s.id);
    const preferredFallback =
      candidates.find((c) => c.group === s.group) ||
      candidates.find((c) => c.isDefault) ||
      candidates[0];

    setDeletingState(s);
    setFallbackStateId(preferredFallback?.id || '');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingState) return;
    const count = itemCounts[deletingState.id] || 0;
    await deleteState({
      stateId: deletingState.id,
      fallbackStateId: count > 0 ? fallbackStateId : undefined,
    });
    setDeletingState(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar title="States" Icon={CircleDot} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-5 md:p-8 space-y-4">
            <Skeleton className="h-8 w-48 rounded-md" />
            <Skeleton className="h-4 w-96 rounded-md" />
            <div className="pt-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Topbar: clean, no description, no top action buttons */}
      <TopBar title="States" Icon={CircleDot} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 md:p-8 space-y-6">
          {/* Header section matching Linear style without Docs link */}
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">States</h1>
            <p className="text-xs text-muted-foreground">
              States show where each work item is in its lifecycle from start to done. Customize them for this project.
            </p>
          </div>

          {/* Groups list */}
          <div className="space-y-4">
            {STATE_GROUPS.map((groupKey) => {
              const groupConfig = STATE_GROUP_CONFIG[groupKey];
              const groupStates = statesByGroup[groupKey];
              const isCollapsed = collapsedGroups.has(groupKey);
              const isAdding = addingGroup === groupKey;

              return (
                <div
                  key={groupKey}
                  className="rounded-xl border border-border/80 bg-card/50 p-3.5 sm:p-4 space-y-2.5 transition-colors"
                >
                  {/* Group Header: Arrow toggle + Icon + Name on left; ONLY Plus button on right */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupKey)}
                      className="flex items-center gap-2 group/title select-none text-left cursor-pointer"
                    >
                      <span className="text-muted-foreground/80 group-hover/title:text-foreground transition-colors">
                        {isCollapsed ? (
                          <ChevronRight className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </span>
                      <StateIcon group={groupKey} size={15} />
                      <span className="text-13 font-semibold text-foreground tracking-tight">
                        {groupConfig.label}
                      </span>
                    </button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStartAdd(groupKey)}
                      className="size-6 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md cursor-pointer"
                      aria-label={`Add state to ${groupConfig.label}`}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  {/* Group Content (collapsible) */}
                  {!isCollapsed && (
                    <div className="space-y-2 pt-1">
                      {/* Inline State Creation Card (Image 4) */}
                      {isAdding && (
                        <div className="rounded-lg border border-border bg-background p-3 space-y-2.5 shadow-xs">
                          {/* Top row: Color picker trigger + State name input */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="size-7 rounded-md shrink-0 border border-border/70 shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                                    style={{ backgroundColor: inlineColor }}
                                    aria-label="Pick state color"
                                  />
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2.5" align="start">
                                  <div className="grid grid-cols-4 gap-2">
                                    {STATE_PALETTE.map((c) => {
                                      const isSelected = inlineColor?.toLowerCase() === c.value.toLowerCase();
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => {
                                            setInlineColor(c.value);
                                            setIsColorPickerOpen(false);
                                          }}
                                          className="size-7 rounded-md flex items-center justify-center border border-border cursor-pointer hover:scale-110 transition-transform"
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
                                ref={inlineInputRef}
                                value={inlineName}
                                onChange={(e) => {
                                  setInlineName(e.target.value);
                                  if (inlineError) setInlineError('');
                                }}
                                placeholder="State name"
                                autoFocus
                                className={`h-8 text-13 font-medium bg-background ${
                                  inlineError
                                    ? 'border-destructive focus-visible:ring-1 focus-visible:ring-destructive'
                                    : 'border-border/80 focus-visible:ring-1 focus-visible:ring-primary'
                                }`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCreateInline(groupKey);
                                  if (e.key === 'Escape') setAddingGroup(null);
                                }}
                              />
                            </div>
                            {inlineError && (
                              <p className="text-11 text-destructive font-normal pl-9">
                                {inlineError}
                              </p>
                            )}
                          </div>

                          {/* Middle row: Description textarea */}
                          <textarea
                            value={inlineDescription}
                            onChange={(e) => setInlineDescription(e.target.value)}
                            placeholder="Describe this state for your members"
                            rows={2}
                            className="w-full px-3 py-2 text-12 rounded-md border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setAddingGroup(null);
                            }}
                          />

                          {/* Bottom row: Cancel & Create action buttons (Create is NOT dimmed/disabled) */}
                          <div className="flex items-center justify-end gap-2 pt-0.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAddingGroup(null)}
                              className="h-7 px-3 text-xs font-medium rounded-md border-border/80 cursor-pointer"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleCreateInline(groupKey)}
                              className="h-7 px-3.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                            >
                              {isMutating ? 'Creating...' : 'Create'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* State Items in this group */}
                      {groupStates.length === 0 && !isAdding ? (
                        <div className="py-2.5 text-center text-xs text-muted-foreground italic rounded-md">
                          No states in this group.
                        </div>
                      ) : (
                        groupStates.map((s) => {
                          const isEditing = editingStateId === s.id;

                          if (isEditing) {
                            return (
                              <div
                                key={s.id}
                                className="rounded-lg border border-border bg-background p-3 space-y-2.5 shadow-xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2.5">
                                    <Popover open={isEditColorPickerOpen} onOpenChange={setIsEditColorPickerOpen}>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="size-7 rounded-md shrink-0 border border-border/70 shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                                          style={{ backgroundColor: editColor }}
                                          aria-label="Pick state color"
                                        />
                                      </PopoverTrigger>
                                      <PopoverContent className="w-48 p-2.5" align="start">
                                        <div className="grid grid-cols-4 gap-2">
                                          {STATE_PALETTE.map((c) => {
                                            const isSelected = editColor?.toLowerCase() === c.value.toLowerCase();
                                            return (
                                              <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                  setEditColor(c.value);
                                                  setIsEditColorPickerOpen(false);
                                                }}
                                                className="size-7 rounded-md flex items-center justify-center border border-border cursor-pointer hover:scale-110 transition-transform"
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
                                      ref={editInputRef}
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
                                          : 'border-border/80 focus-visible:ring-1 focus-visible:ring-primary'
                                      }`}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit(s.id);
                                        if (e.key === 'Escape') setEditingStateId(null);
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
                                  placeholder="Describe this state for your members"
                                  rows={2}
                                  className="w-full px-3 py-2 text-12 rounded-md border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
                                />

                                <div className="flex items-center justify-end gap-2 pt-0.5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingStateId(null)}
                                    className="h-7 px-3 text-xs font-medium rounded-md border-border/80 cursor-pointer"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleSaveEdit(s.id)}
                                    className="h-7 px-3.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
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
                              className="group/item flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border/60 bg-background hover:border-border transition-colors"
                            >
                              {/* Left: State Icon + Title */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <StateIcon
                                  icon={s.icon}
                                  group={s.group}
                                  color={s.color || s.accentColor}
                                  size={15}
                                />
                                <span className="text-13 font-normal text-foreground truncate">
                                  {resolveStateTitle(s)}
                                </span>
                              </div>

                              {/* Right: Actions on hover (neutral gray icons, no orange or red) */}
                              <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                {!s.isDefault && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetDefault(s)}
                                    className="text-xs text-muted-foreground hover:text-foreground mr-1.5 font-normal transition-colors cursor-pointer"
                                  >
                                    Mark as default
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(s)}
                                  className="p-1 text-muted-foreground hover:text-foreground rounded-sm transition-colors cursor-pointer"
                                  aria-label="Edit state"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={s.isDefault || states.length <= 1}
                                  onClick={() => handleOpenDeleteModal(s)}
                                  className="p-1 text-muted-foreground hover:text-foreground rounded-sm transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
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
              );
            })}
          </div>
        </div>
      </div>

      {/* Delete State Modal with Safe Migration Port */}
      <Dialog
        open={Boolean(deletingState)}
        onOpenChange={(open) => {
          if (!open) setDeletingState(null);
        }}
      >
        <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-border rounded-lg">
          <div className="p-6">
            <DialogHeader className="flex flex-row items-start gap-3 space-y-0">
              <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 shrink-0" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold text-foreground">
                  Delete Workflow State
                </DialogTitle>
                <DialogDescription className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete &ldquo;{deletingState?.name || deletingState?.title}&rdquo;?
                </DialogDescription>
              </div>
            </DialogHeader>

            {deletingState && (itemCounts[deletingState.id] || 0) > 0 && (
              <div className="mt-4 p-3 rounded-md bg-destructive/5 border border-destructive/20 space-y-2.5">
                <p className="text-xs text-foreground font-medium">
                  This state contains <strong className="text-destructive font-semibold">{itemCounts[deletingState.id]}</strong> active work item(s).
                  Please choose a destination state to safely move them to:
                </p>
                <select
                  value={fallbackStateId}
                  onChange={(e) => setFallbackStateId(e.target.value)}
                  className="w-full h-9 px-3 text-13 font-medium rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {states
                    .filter((s) => s.id !== deletingState.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {resolveStateTitle(s)} ({STATE_GROUP_CONFIG[s.group]?.label || s.group})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-3.5 bg-background border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingState(null)}
              disabled={isMutating}
              className="h-8 px-3.5 text-xs font-medium rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isMutating}
              className="h-8 px-4 text-xs font-medium rounded-md"
            >
              {isMutating ? 'Deleting...' : 'Delete State'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
