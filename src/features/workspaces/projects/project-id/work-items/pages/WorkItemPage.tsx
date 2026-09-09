'use client';

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "../components/layout/Topbar";
import { WorkItemViews, TaskViews } from "../components/views/WorkItemViews";
import { WorkItemDetailModal as WorkItemDialog, TaskDetailModal as TaskDialog } from "../components/modals/work-item/WorkItemDetailModal";
import { TransferModal } from "../components/modals/TransferModal";
import { AddExistingTaskModal } from "../components/modals/AddExistingWorkItemModal";
import { ColumnFormModal, DeleteColumnModal } from "../components/modals/ColumnModals";
import { useTaskProject } from "../hooks/use-work-item";
import { useTopbar } from "../hooks/use-topbar";
import { useKanban } from "../hooks/use-kanban";
import type {
  WorkItem as WorkItemType,
  Task as TaskType,
  WorkItemMutationInput,
  TaskMutationInput,
  Column as ColumnType,
} from "../types/work-item.types";
import { resolveWorkItemColumnId, resolveTaskColumnId } from "../types/work-item.types";
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { toast } from "sonner";
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  KanbanSquare,
  Plus,
  ArrowRightLeft,
} from "lucide-react";

export type WorkItemModalState =
  | { type: 'idle' }
  | { type: 'detail'; card: Partial<WorkItemType> }
  | { type: 'delete-task'; task: WorkItemType }
  | { type: 'add-existing' }
  | { type: 'transfer' }
  | { type: 'create-column' }
  | { type: 'edit-column'; column: ColumnType }
  | { type: 'delete-column'; column: ColumnType };

export type TaskModalState = WorkItemModalState;

export interface WorkItemPageProps {
  cycleId?: string;
  isReadOnly?: boolean;
}

export type TaskPageProps = WorkItemPageProps;

export function WorkItemPage({
  cycleId: propCycleId,
  isReadOnly: propIsReadOnly,
}: WorkItemPageProps = {}) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const params = useParams() as {
    workspaceId?: string;
    projectId?: string;
    cycleId?: string;
  };
  const workspaceId = params.workspaceId || "";
  const projectId = params.projectId || "";
  const cycleId = propCycleId ?? params.cycleId;
  const isReadOnly = propIsReadOnly ?? false;

  // ── 1. Data Domain Layer (useTaskProject) ─────────────────────────────────
  const { state: projectState, actions: projectActions } = useTaskProject({
    projectId,
    cycleId,
    workspaceId,
  });

  const {
    allTasks,
    columns,
    project,
    members,
    cycles,
    currentCycle,
    labelMap,
    isLoading,
  } = projectState;

  // ── 2. View & Filter Presentation Layer (useTopbar) ───────────────────────
  const { state: topbarState, actions: topbarActions } = useTopbar({
    tasks: allTasks,
    columns,
    cycles,
    cycleId,
  });

  const {
    viewMode,
    searchQuery,
    selectedColumnIds,
    selectedAssigneeIds,
    filteredTasks,
    assignees,
  } = topbarState;

  const {
    setViewMode,
    setSearchQuery,
    setSelectedColumnIds,
    setSelectedAssigneeIds,
  } = topbarActions;

  // ── 3. Kanban Presentation Layer (useKanban) ──────────────────────────────
  const { state: kanbanState } = useKanban({
    tasks: filteredTasks,
    columns,
    isReadOnly,
  });

  const { tasksByColumnId } = kanbanState;

  // ── 4. Unified Discriminated Modal State (Matt Pocock Pattern) ────────────
  const [modal, setModal] = useState<TaskModalState>({ type: 'idle' });
  const closeModal = useCallback(() => setModal({ type: 'idle' }), []);

  // ── Handlers & Actions ────────────────────────────────────────────────────

  const handleOpenAddDialog = (
    columnId: string,
    title?: string,
    dueDate?: string,
  ) => {
    const quickTitle = title?.trim();

    if (quickTitle) {
      if (projectState.isSavingTask) return;
      projectActions.createTask({
        projectId,
        columnId,
        title: quickTitle,
        dueDate,
        cycleId,
        assigneeId: null,
      }).then(() => {
        toast.success(cycleId ? "Task added to cycle" : "Task created");
      });
      return;
    }

    setModal({
      type: 'detail',
      card: {
        columnId,
        title: title?.trim() || "",
        dueDate,
        cycleId: cycleId as any,
        assigneeId: null,
      },
    });
  };

  const handleOpenEditDialog = (card: TaskType) => {
    setModal({ type: 'detail', card });
  };

  const handleMoveCard = (taskId: string, newColumnId: string) => {
    projectActions.updateTask({
      taskId,
      projectId,
      columnId: newColumnId,
    });
  };

  const handleSaveCard = (cardData: TaskMutationInput) => {
    if (modal.type === 'detail' && modal.card.id) {
      projectActions.updateTask({
        taskId: modal.card.id,
        projectId,
        ...cardData,
      });
      return;
    }

    if (!cardData.title?.trim()) {
      return;
    }

    projectActions.createTask({
      projectId,
      cycleId,
      ...cardData,
    }).then((result: any) => {
      toast.success(cycleId ? "Task added to cycle" : "Task created");
      if (result?.task?.id) {
        setModal({ type: 'detail', card: result.task });
      } else {
        closeModal();
      }
    });
  };

  const handleDeleteCard = () => {
    if (modal.type === 'detail' && modal.card.id) {
      setModal({ type: 'delete-task', task: modal.card as TaskType });
    }
  };

  const handleTaskDeleteConfirm = () => {
    if (modal.type === 'delete-task' && modal.task.id) {
      projectActions.deleteTask({ taskId: modal.task.id, projectId }).then(() => {
        closeModal();
        toast.success("Task deleted");
      });
    }
  };

  const handleDuplicateCard = (card: TaskType) => {
    projectActions.duplicateTask({ projectId, taskId: card.id }).then(() => {
      toast.success("Task duplicated");
    });
  };

  const handleJoinCard = (card: TaskType) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = typeof card.assigneeId === 'object' ? card.assigneeId?.id : card.assigneeId;
    if (currentAssigneeId === currentUser.id) return;

    projectActions.updateTask({
      taskId: card.id,
      projectId,
      assigneeId: currentUser.id,
    });
  };

  const handleLeaveCard = (card: TaskType) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = typeof card.assigneeId === 'object' ? card.assigneeId?.id : card.assigneeId;
    if (currentAssigneeId !== currentUser.id) return;

    projectActions.updateTask({
      taskId: card.id,
      projectId,
      assigneeId: null,
    });
  };

  const handleRemoveFromCycle = (card: TaskType, callback?: () => void) => {
    projectActions.updateTask({
      taskId: card.id,
      projectId,
      cycleId: null,
    });
    toast.success("Task removed from cycle");
    callback?.();
  };

  const handleAssignExistingTasksToDate = (
    taskIds: string[],
    dueDate: string,
    quiet = false,
    startDate?: string | null,
  ) => {
    if (taskIds.length === 0) return;

    taskIds.forEach((taskId) => {
      const payload: any = {
        taskId,
        projectId,
        dueDate,
      };
      if (startDate !== undefined) {
        payload.startDate = startDate;
      }
      projectActions.updateTask(payload);
    });

    if (!quiet) {
      toast.success(
        taskIds.length === 1
          ? "Task added to calendar"
          : `${taskIds.length} tasks added to calendar`,
      );
    }
  };

  const handleOpenEditColumn = (column: ColumnType) => {
    setModal({ type: 'edit-column', column });
  };

  const handleOpenDeleteColumn = (column: ColumnType) => {
    setModal({ type: 'delete-column', column });
  };

  const handleEditColumn = (payload: { sectionName: string; selectedColor: string }) => {
    if (modal.type !== 'edit-column') return;
    projectActions.updateColumn(modal.column.id, {
      title: payload.sectionName,
      accentColor: payload.selectedColor,
    }).then(() => {
      closeModal();
    });
  };

  const handleDeleteColumnConfirm = () => {
    if (modal.type !== 'delete-column') return;
    projectActions.deleteColumn(modal.column.id).then(() => {
      closeModal();
    });
  };

  const isCycleEmpty = cycleId && allTasks.length === 0 && !isLoading;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300">
        <div className="px-4 h-13 flex items-center gap-2 border-b border-border">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 flex gap-5 p-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-72 space-y-3">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Topbar Filter & Navigation */}
      <Topbar
        project={project}
        title="Tasks"
        Icon={KanbanSquare}
        count={allTasks.length}
        cycleId={cycleId}
        currentCycle={currentCycle}
        cycles={cycles}
        viewMode={viewMode}
        onViewChange={setViewMode}
        columns={columns}
        selectedColumnIds={selectedColumnIds}
        onColumnFilterChange={setSelectedColumnIds}
        assignees={assignees}
        selectedAssigneeIds={selectedAssigneeIds}
        onAssigneeFilterChange={setSelectedAssigneeIds}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddTask={() => {
          const firstCol = columns[0];
          handleOpenAddDialog(firstCol ? resolveTaskColumnId(firstCol) : "");
        }}
        onAddExistingTask={cycleId ? () => setModal({ type: 'add-existing' }) : undefined}
        isLoading={isLoading}
        isReadOnly={isReadOnly}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {isCycleEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <KanbanSquare className="w-8 h-8 text-foreground shrink-0" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No work items in this cycle
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Get started by creating a new work item or adding existing work items from your project backlog.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ type: 'add-existing' })}
                className="gap-2 rounded-md"
              >
                <ArrowRightLeft className="w-4 h-4 shrink-0" />
                <span>Add Existing Work Items</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const firstCol = columns[0];
                  handleOpenAddDialog(firstCol ? resolveTaskColumnId(firstCol) : "");
                }}
                className="gap-2 rounded-md"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Create Work Item</span>
              </Button>
            </div>
          </div>
        ) : (
          <TaskViews
            viewMode={viewMode}
            columns={columns}
            tasksByColumnId={tasksByColumnId}
            tasks={filteredTasks}
            labelMap={labelMap}
            currentUserId={currentUser?.id}
            currentUserAvatar={currentUser?.avatar ?? undefined}
            onAddCard={handleOpenAddDialog}
            onEditCard={handleOpenEditDialog}
            onMoveCard={handleMoveCard}
            onDuplicateCard={handleDuplicateCard}
            onDeleteCard={handleDeleteCard}
            onJoinCard={handleJoinCard}
            onLeaveCard={handleLeaveCard}
            onRemoveFromCycle={handleRemoveFromCycle}
            onAssignExistingTasks={handleAssignExistingTasksToDate}
            onEditColumn={handleOpenEditColumn}
            onDeleteColumn={handleOpenDeleteColumn}
            isReadOnly={isReadOnly}
          />
        )}
      </div>

      {/* Task Detail Dialog */}
      {modal.type === 'detail' && (
        <TaskDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) closeModal();
          }}
          card={modal.card}
          columns={columns}
          project={project}
          members={members}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onDuplicate={
            modal.card.id ? () => handleDuplicateCard(modal.card as TaskType) : undefined
          }
          onRemoveFromCycle={
            cycleId && modal.card.id
              ? () => {
                  handleRemoveFromCycle(modal.card as TaskType, closeModal);
                }
              : undefined
          }
          isReadOnly={isReadOnly}
        />
      )}

      {/* Task Delete Confirmation Modal */}
      <Dialog open={modal.type === 'delete-task'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="w-full max-w-md p-6 gap-4 rounded-lg border border-border shadow-sm bg-background">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-base font-semibold text-foreground">Delete Work Item</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{modal.type === 'delete-task' ? modal.task.title : ''}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={closeModal} disabled={projectState.status.isDeleting} className="rounded-md">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleTaskDeleteConfirm} disabled={projectState.status.isDeleting} className="rounded-md">
              {projectState.status.isDeleting ? "Deleting..." : "Delete Work Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Modals */}
      {modal.type === 'edit-column' && (
        <ColumnFormModal
          isOpen={true}
          onClose={closeModal}
          onSubmit={handleEditColumn}
          mode="edit"
          initialData={{
            sectionName: modal.column.title,
            selectedColor: modal.column.accentColor,
          }}
          isLoading={projectState.status.isSaving}
        />
      )}

      {modal.type === 'delete-column' && (
        <DeleteColumnModal
          isOpen={true}
          onClose={closeModal}
          onConfirm={handleDeleteColumnConfirm}
          columnTitle={modal.column.title}
          fallbackColumnTitle={columns.find((c) => c.id !== modal.column.id)?.title || 'Backlog'}
          isLoading={projectState.status.isDeleting}
        />
      )}

      {/* Cycle Modals */}
      {cycleId && (
        <>
          <AddExistingTaskModal
            open={modal.type === 'add-existing'}
            onOpenChange={(open) => (open ? setModal({ type: 'add-existing' }) : closeModal())}
            projectId={projectId}
            currentCycleId={cycleId}
            columns={columns}
            members={members}
          />

          <TransferModal
            open={modal.type === 'transfer'}
            onOpenChange={(open) => (open ? setModal({ type: 'transfer' }) : closeModal())}
            projectId={projectId}
            sourceCycleId={cycleId}
            sourceCycleName={currentCycle?.name || "Current Cycle"}
            tasks={allTasks}
            availableCycles={cycles}
            columns={columns}
            members={members}
          />
        </>
      )}
    </div>
  );
}

export const TaskPage = WorkItemPage;
export default WorkItemPage;
