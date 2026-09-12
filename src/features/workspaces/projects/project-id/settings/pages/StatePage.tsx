'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import {
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Check,
  AlertTriangle,
  CircleDashed,
  Circle,
  CircleDot,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useStateSettings } from '../hooks/use-state-settings';
import type {
  WorkItemState,
  StateGroup,
} from '@/features/workspaces/projects/project-id/work-items/types/types';
import {
  STATE_GROUPS,
  STATE_GROUP_CONFIG,
  resolveStateColor,
  resolveStateTitle,
} from '@/features/workspaces/projects/project-id/work-items/types/types';

export const STATE_PALETTE = [
  { id: 'indigo', value: '#6366F1', label: 'Indigo' },
  { id: 'sky', value: '#0EA5E9', label: 'Sky' },
  { id: 'amber', value: '#F59E0B', label: 'Amber' },
  { id: 'yellow', value: '#EAB308', label: 'Yellow' },
  { id: 'emerald', value: '#22C55E', label: 'Emerald' },
  { id: 'rose', value: '#F43F5E', label: 'Rose' },
  { id: 'purple', value: '#A855F7', label: 'Purple' },
  { id: 'teal', value: '#14B8A6', label: 'Teal' },
  { id: 'orange', value: '#F97316', label: 'Orange' },
  { id: 'slate', value: '#64748B', label: 'Slate' },
];

function getStateGroupIcon(group: StateGroup) {
  switch (group) {
    case 'backlog':
      return <CircleDashed className="size-4 shrink-0 text-foreground" />;
    case 'unstarted':
      return <Circle className="size-4 shrink-0 text-foreground" />;
    case 'started':
      return <CircleDot className="size-4 shrink-0 text-amber-500" />;
    case 'completed':
      return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />;
    case 'cancelled':
      return <XCircle className="size-4 shrink-0 text-red-500" />;
  }
}

export default function StatePage() {
  const params = useParams() as { workspaceId: string; projectId: string };
  const { projectId } = params;

  const {
    states,
    taskCounts,
    isLoading,
    isMutating,
    createState,
    updateState,
    deleteState,
    reorderStates,
    resetStates,
  } = useStateSettings(projectId);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingState, setEditingState] = useState<WorkItemState | null>(null);
  const [deletingState, setDeletingState] = useState<WorkItemState | null>(null);
  const [fallbackStateId, setFallbackStateId] = useState<string>('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Group states by their 5 lifecycle state groups
  const statesByGroup = useMemo(() => {
    const map: Record<StateGroup, WorkItemState[]> = {
      backlog: [],
      unstarted: [],
      started: [],
      completed: [],
      cancelled: [],
    };
    for (const s of states) {
      const g: StateGroup = (s.group && (STATE_GROUPS as readonly string[]).includes(s.group)) ? (s.group as StateGroup) : 'unstarted';
      map[g].push(s);
    }
    for (const g of STATE_GROUPS) {
      map[g].sort((a, b) => a.sequence - b.sequence);
    }
    return map;
  }, [states]);

  // Form state for Create / Edit Modal
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(STATE_PALETTE[0].value);
  const [formGroup, setFormGroup] = useState<StateGroup>('unstarted');
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const handleOpenAddModal = (presetGroup?: StateGroup) => {
    setFormName('');
    setFormColor(STATE_PALETTE[0].value);
    setFormGroup(presetGroup || 'unstarted');
    setFormDescription('');
    setFormIsDefault(false);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (s: WorkItemState) => {
    setEditingState(s);
    setFormName(s.name || s.title || '');
    setFormColor(s.color || s.accentColor || STATE_PALETTE[0].value);
    setFormGroup(s.group || 'unstarted');
    setFormDescription(s.description || '');
    setFormIsDefault(Boolean(s.isDefault));
  };

  const handleSaveState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingState) {
      await updateState({
        stateId: editingState.id,
        data: {
          name: formName.trim(),
          color: formColor,
          group: formGroup,
          description: formDescription.trim(),
          isDefault: formIsDefault,
        },
      });
      setEditingState(null);
    } else {
      await createState({
        name: formName.trim(),
        color: formColor,
        group: formGroup,
        description: formDescription.trim(),
        isDefault: formIsDefault,
      });
      setIsAddModalOpen(false);
    }
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
    const count = taskCounts[deletingState.id] || 0;
    await deleteState({
      stateId: deletingState.id,
      fallbackStateId: count > 0 ? fallbackStateId : undefined,
    });
    setDeletingState(null);
  };

  const handleMoveState = async (stateId: string, direction: 'up' | 'down') => {
    const idx = states.findIndex((s) => s.id === stateId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === states.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const reordered = [...states];
    const temp = reordered[idx];
    reordered[idx] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    const items = reordered.map((s, i) => ({
      id: s.id,
      sequence: (i + 1) * 1000,
      group: s.group,
      title: s.name || s.title,
      accentColor: s.color || s.accentColor,
    }));

    await reorderStates(items);
  };

  const handleResetConfirm = async () => {
    await resetStates();
    setIsResetConfirmOpen(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            States
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage lifecycle states and progress groups for work items in this project.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetConfirmOpen(true)}
            disabled={isMutating}
            className="h-8 text-xs gap-1.5 rounded-md border-border bg-background hover:bg-muted"
          >
            <RotateCcw className="size-3.5 shrink-0 text-muted-foreground" />
            <span>Reset to Defaults</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAddModal()}
            disabled={isMutating}
            className="h-8 text-xs gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>New State</span>
          </Button>
        </div>
      </div>

      {/* State Groups List */}
      <div className="space-y-6">
        {STATE_GROUPS.map((groupKey) => {
          const groupConfig = STATE_GROUP_CONFIG[groupKey];
          const groupStates = statesByGroup[groupKey];

          return (
            <div
              key={groupKey}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  {getStateGroupIcon(groupKey)}
                  <span className="text-13 font-semibold text-foreground">
                    {groupConfig.label}
                  </span>
                  <span className="text-11 text-muted-foreground font-normal">
                    ({groupStates.length} {groupStates.length === 1 ? 'state' : 'states'})
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenAddModal(groupKey)}
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                >
                  <Plus className="size-3.5 shrink-0 mr-1" />
                  Add to {groupConfig.label}
                </Button>
              </div>

              {groupStates.length === 0 ? (
                <div className="py-3 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-md">
                  No states configured in this group.
                </div>
              ) : (
                <div className="space-y-2">
                  {groupStates.map((s, idx) => {
                    const globalIdx = states.findIndex((item) => item.id === s.id);
                    const color = resolveStateColor(s.id, s.color || s.accentColor);
                    const count = taskCounts[s.id] || 0;
                    const isOnlyState = states.length <= 1;

                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-md bg-background border border-border hover:border-border/80 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="size-3 rounded-full shrink-0 border border-border/40"
                            style={{ backgroundColor: color }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-13 font-medium text-foreground truncate">
                                {resolveStateTitle(s)}
                              </span>
                              {s.isDefault && (
                                <span className="text-10 font-semibold px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
                                  Default
                                </span>
                              )}
                            </div>
                            {s.description && (
                              <p className="text-11 text-muted-foreground truncate max-w-md mt-0.5">
                                {s.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {count} {count === 1 ? 'item' : 'items'}
                          </span>

                          <div className="flex items-center gap-0.5 border-l border-border pl-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={globalIdx === 0 || isMutating}
                              onClick={() => handleMoveState(s.id, 'up')}
                              className="size-7 text-muted-foreground hover:text-foreground rounded-md"
                              aria-label="Move up"
                            >
                              <ChevronUp className="size-3.5 shrink-0" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={globalIdx === states.length - 1 || isMutating}
                              onClick={() => handleMoveState(s.id, 'down')}
                              className="size-7 text-muted-foreground hover:text-foreground rounded-md"
                              aria-label="Move down"
                            >
                              <ChevronDown className="size-3.5 shrink-0" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isMutating}
                              onClick={() => handleOpenEditModal(s)}
                              className="size-7 text-muted-foreground hover:text-foreground rounded-md"
                              aria-label="Edit state"
                            >
                              <Pencil className="size-3.5 shrink-0" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={s.isDefault || isOnlyState || isMutating}
                              onClick={() => handleOpenDeleteModal(s)}
                              className="size-7 text-muted-foreground hover:text-destructive rounded-md"
                              aria-label="Delete state"
                            >
                              <Trash2 className="size-3.5 shrink-0" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit State Modal */}
      <Dialog
        open={isAddModalOpen || Boolean(editingState)}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddModalOpen(false);
            setEditingState(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden border border-border rounded-lg">
          <form onSubmit={handleSaveState}>
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {editingState ? 'Edit Workflow State' : 'New Workflow State'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Define the state name, lifecycle group, and visual badge color.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 pt-2 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="state-name" className="text-xs font-semibold text-foreground">
                  State Name
                </Label>
                <Input
                  id="state-name"
                  placeholder="e.g., Code Review, In Testing, Accepted..."
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-9 text-13 font-medium text-foreground rounded-md border-border bg-background focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="state-group" className="text-xs font-semibold text-foreground">
                  State Group
                </Label>
                <select
                  id="state-group"
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value as StateGroup)}
                  className="w-full h-9 px-3 text-13 font-medium rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {STATE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {STATE_GROUP_CONFIG[g].label} ({STATE_GROUP_CONFIG[g].description})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Badge Color</span>
                  <span
                    className="size-3.5 rounded-full inline-block border border-border"
                    style={{ backgroundColor: formColor }}
                  />
                </Label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {STATE_PALETTE.map((c) => {
                    const isSelected = formColor.toLowerCase() === c.value.toLowerCase();
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormColor(c.value)}
                        className={`size-7 rounded-full transition-all flex items-center justify-center border border-border cursor-pointer ${
                          isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110 opacity-90'
                        }`}
                        style={{ backgroundColor: c.value }}
                        aria-label={`Select ${c.label}`}
                      >
                        {isSelected && <Check className="size-3.5 text-white drop-shadow-xs shrink-0" strokeWidth={1.5} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="state-description" className="text-xs font-semibold text-foreground">
                  Description (Optional)
                </Label>
                <textarea
                  id="state-description"
                  rows={2}
                  placeholder="Describe when a work item transitions into this state..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 text-13 rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="state-default"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  disabled={editingState?.isDefault}
                  className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="state-default" className="text-xs font-medium text-foreground cursor-pointer">
                  Mark as default state for new work items
                </Label>
              </div>
            </div>

            <div className="px-6 py-4 bg-background flex items-center justify-end gap-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingState(null);
                }}
                disabled={isMutating}
                className="h-8 px-4 text-xs font-medium rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!formName.trim() || isMutating}
                className="h-8 px-5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                {isMutating ? 'Saving...' : editingState ? 'Save Changes' : 'Create State'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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

            {deletingState && (taskCounts[deletingState.id] || 0) > 0 && (
              <div className="mt-4 p-3 rounded-md bg-destructive/5 border border-destructive/20 space-y-2.5">
                <p className="text-xs text-foreground font-medium">
                  This state contains <strong className="text-destructive font-semibold">{taskCounts[deletingState.id]}</strong> active work item(s).
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

      {/* Reset Confirmation Dialog */}
      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent className="max-w-md p-6 gap-4 rounded-lg border border-border bg-background">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-base font-semibold text-foreground">
              Reset Workflow States to Platform Defaults
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will restore the 5 default workflow states (Backlog, To Do, In Progress, Done, Cancelled).
              Any orphan work items will be safely moved to Backlog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetConfirmOpen(false)}
              disabled={isMutating}
              className="rounded-md"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleResetConfirm}
              disabled={isMutating}
              className="rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {isMutating ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
