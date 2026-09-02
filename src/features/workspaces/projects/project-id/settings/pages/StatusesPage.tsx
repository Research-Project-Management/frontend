'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
} from 'lucide-react';
import {
  useTaskProject,
  useAddColumn,
  useUpdateColumn,
  useDeleteColumn,
  useReorderColumns,
  useResetColumns,
} from '@/features/workspaces/projects/project-id/tasks/hooks/use-task';
import {
  ColumnFormModal,
  DeleteColumnModal,
} from '@/features/workspaces/projects/project-id/tasks/components/modals/ColumnModals';
import {
  resolveTaskColumnColor,
  resolveTaskColumnId,
  type Column as ColumnType,
} from '@/features/workspaces/projects/project-id/tasks/types/task.types';

export default function StatusesPage() {
  const { workspaceId, projectId } = useParams() as { workspaceId: string; projectId: string };

  const { state: projectState } = useTaskProject({
    projectId,
    workspaceId,
  });

  const { columns, allTasks, isLoading } = projectState;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ColumnType | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<ColumnType | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const addColumnMut = useAddColumn();
  const updateColumnMut = useUpdateColumn();
  const deleteColumnMut = useDeleteColumn();
  const reorderColumnsMut = useReorderColumns();
  const resetColumnsMut = useResetColumns();

  // Calculate task counts per column
  const taskCountByColumn = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of allTasks) {
      map[task.columnId] = (map[task.columnId] || 0) + 1;
    }
    return map;
  }, [allTasks]);

  const handleAddSubmit = (data: { sectionName: string; selectedColor: string }) => {
    addColumnMut.mutate(
      {
        projectId,
        title: data.sectionName,
        accentColor: data.selectedColor,
      },
      {
        onSuccess: () => {
          setIsAddModalOpen(false);
        },
      },
    );
  };

  const handleEditSubmit = (data: { sectionName: string; selectedColor: string }) => {
    if (!editingColumn) return;
    updateColumnMut.mutate(
      {
        projectId,
        columnId: editingColumn.id,
        data: {
          title: data.sectionName,
          accentColor: data.selectedColor,
        },
      },
      {
        onSuccess: () => {
          setEditingColumn(null);
        },
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deletingColumn) return;
    deleteColumnMut.mutate(
      {
        projectId,
        columnId: deletingColumn.id,
      },
      {
        onSuccess: () => {
          setDeletingColumn(null);
        },
      },
    );
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newCols = [...columns];
    const temp = newCols[index];
    newCols[index] = newCols[index - 1];
    newCols[index - 1] = temp;
    reorderColumnsMut.mutate({ projectId, columns: newCols });
  };

  const handleMoveDown = (index: number) => {
    if (index >= columns.length - 1) return;
    const newCols = [...columns];
    const temp = newCols[index];
    newCols[index] = newCols[index + 1];
    newCols[index + 1] = temp;
    reorderColumnsMut.mutate({ projectId, columns: newCols });
  };

  const handleResetConfirm = () => {
    resetColumnsMut.mutate(projectId, {
      onSuccess: () => {
        setIsResetConfirmOpen(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="px-6 md:px-10 lg:px-12 py-8 md:py-10 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 lg:px-12 py-8 md:py-10 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Layers className="size-6 text-primary" />
            <span>Task Statuses</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure custom board columns and lifecycle statuses for this project. Tasks transition between these stages.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetConfirmOpen(true)}
            disabled={resetColumnsMut.isPending}
            className="h-9 px-3 text-xs font-medium gap-1.5 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 px-4 text-xs font-medium gap-1.5 rounded-lg shadow-sm"
          >
            <Plus className="size-4" />
            <span>Add Status</span>
          </Button>
        </div>
      </div>

      {/* ── Statuses List Card ── */}
      <div className="border border-border/80 rounded-xl bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-muted/40 border-b border-border/60 flex items-center justify-between text-xs font-semibold text-muted-foreground select-none">
          <div className="flex items-center gap-3">
            <span className="w-6 text-center">#</span>
            <span>Status Name</span>
          </div>
          <div className="flex items-center gap-8 pr-2">
            <span className="w-20 text-center">Active Tasks</span>
            <span className="w-24 text-right">Actions</span>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {columns.map((col, index) => {
            const colId = resolveTaskColumnId(col);
            const color = resolveTaskColumnColor(colId, col.accentColor);
            const count = taskCountByColumn[colId] || 0;

            return (
              <div
                key={colId}
                className="px-4 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors group"
              >
                {/* Left: Index, Color Dot, Title, Badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1 w-6 text-muted-foreground text-xs font-mono justify-center">
                    <span className="text-[11px] font-medium">{index + 1}</span>
                  </div>

                  <span
                    className="size-3 rounded-full shrink-0 shadow-2xs border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: color }}
                  />

                  <span className="text-sm font-semibold text-foreground tracking-tight truncate max-w-xs">
                    {col.title}
                  </span>

                  {col.isDefault && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                      Default
                    </span>
                  )}
                </div>

                {/* Right: Task Count & Action Buttons */}
                <div className="flex items-center gap-8 pr-2">
                  <div className="w-20 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                      {count} {count === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>

                  <div className="w-24 flex items-center justify-end gap-1">
                    {/* Move Up */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0 || reorderColumnsMut.isPending}
                      onClick={() => handleMoveUp(index)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Move up"
                    >
                      <ChevronUp className="size-4" />
                    </Button>

                    {/* Move Down */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === columns.length - 1 || reorderColumnsMut.isPending}
                      onClick={() => handleMoveDown(index)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Move down"
                    >
                      <ChevronDown className="size-4" />
                    </Button>

                    {/* Edit */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingColumn(col)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Edit status"
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={columns.length <= 1}
                      onClick={() => setDeletingColumn(col)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                      title={columns.length <= 1 ? "Cannot delete the only status" : "Delete status"}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Add Column Modal ── */}
      <ColumnFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        mode="create"
        isLoading={addColumnMut.isPending}
      />

      {/* ── Edit Column Modal ── */}
      {editingColumn && (
        <ColumnFormModal
          isOpen={true}
          onClose={() => setEditingColumn(null)}
          onSubmit={handleEditSubmit}
          mode="edit"
          initialData={{
            sectionName: editingColumn.title,
            selectedColor: editingColumn.accentColor,
          }}
          isLoading={updateColumnMut.isPending}
        />
      )}

      {/* ── Delete Column Modal ── */}
      {deletingColumn && (
        <DeleteColumnModal
          isOpen={true}
          onClose={() => setDeletingColumn(null)}
          onConfirm={handleDeleteConfirm}
          columnTitle={deletingColumn.title}
          fallbackColumnTitle={columns.find((c) => c.id !== deletingColumn.id)?.title || 'Backlog'}
          isLoading={deleteColumnMut.isPending}
        />
      )}

      {/* ── Reset Confirmation Dialog ── */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-card p-6 rounded-xl border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-foreground">Reset Statuses to Default?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will restore the standard default statuses (<strong>Backlog</strong>, <strong>To Do</strong>, <strong>Doing</strong>, <strong>Review</strong>, <strong>Done</strong>).
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetConfirmOpen(false)}
                disabled={resetColumnsMut.isPending}
                className="h-8 px-3 text-xs font-medium rounded-lg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleResetConfirm}
                disabled={resetColumnsMut.isPending}
                className="h-8 px-4 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
              >
                {resetColumnsMut.isPending ? "Resetting..." : "Confirm Reset"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
