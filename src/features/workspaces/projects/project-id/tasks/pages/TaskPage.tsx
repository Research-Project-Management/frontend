'use client';

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "../components/layout/Topbar";
import { TaskViews } from "../components/views/TaskViews";
import { TaskDetailModal as TaskDialog } from "../components/modals/task/TaskDetailModal";
import { TransferModal } from "../components/modals/TransferModal";
import { AddExistingTaskModal } from "../components/modals/AddExistingTaskModal";
import { useTaskProject } from "../hooks/use-task";
import { useTopbar } from "../hooks/use-topbar";
import { useKanban } from "../hooks/use-kanban";
import type {
  Task as TaskType,
  TaskMutationInput,
} from "../types/task.types";
import { resolveTaskColumnId } from "../types/task.types";
import { Skeleton, Button } from "@/shared/components/ui";
import { toast } from "sonner";
import { useAuth } from '@/features/auth';
import {
  KanbanSquare,
  Plus,
  ArrowRightLeft,
} from "lucide-react";

export type TaskModalState =
  | { type: 'idle' }
  | { type: 'detail'; card: Partial<TaskType> }
  | { type: 'delete-task'; task: TaskType }
  | { type: 'add-existing' }
  | { type: 'transfer' };

export interface TaskPageProps {
  cycleId?: string;
  isReadOnly?: boolean;
}

export default function TaskPage({
  cycleId: propCycleId,
  isReadOnly: propIsReadOnly,
}: TaskPageProps = {}) {
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
    if (modal.type === 'detail' && modal.card._id) {
      projectActions.updateTask({
        taskId: modal.card._id,
        projectId,
        ...cardData,
      });
      return;
    }

    projectActions.createTask({
      projectId,
      cycleId,
      ...cardData,
    }).then((result: any) => {
      toast.success(cycleId ? "Task added to cycle" : "Task created");
      if (result?.task?._id) {
        setModal({ type: 'detail', card: result.task });
      } else {
        closeModal();
      }
    });
  };

  const handleDeleteCard = () => {
    if (modal.type === 'detail' && modal.card._id) {
      setModal({ type: 'delete-task', task: modal.card as TaskType });
    }
  };

  const handleTaskDeleteConfirm = () => {
    if (modal.type === 'delete-task' && modal.task._id) {
      projectActions.deleteTask({ taskId: modal.task._id, projectId }).then(() => {
        closeModal();
        toast.success("Task deleted");
      });
    }
  };

  const handleDuplicateCard = (card: TaskType) => {
    projectActions.duplicateTask({ projectId, taskId: card._id }).then(() => {
      toast.success("Task duplicated");
    });
  };

  const handleJoinCard = (card: TaskType) => {
    if (!currentUser?._id) return;
    if (card.assigneeId?._id === currentUser._id) return;

    projectActions.updateTask({
      taskId: card._id,
      projectId,
      assigneeId: currentUser._id,
    });
  };

  const handleLeaveCard = (card: TaskType) => {
    if (!currentUser?._id) return;
    if (card.assigneeId?._id !== currentUser._id) return;

    projectActions.updateTask({
      taskId: card._id,
      projectId,
      assigneeId: null,
    });
  };

  const handleRemoveFromCycle = (card: TaskType, callback?: () => void) => {
    projectActions.updateTask({
      taskId: card._id,
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
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
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
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <KanbanSquare className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No tasks in this cycle
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Get started by creating a new task or adding existing tasks from your project backlog.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ type: 'add-existing' })}
                className="gap-2 rounded-sm"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Add Existing Tasks</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const firstCol = columns[0];
                  handleOpenAddDialog(firstCol ? resolveTaskColumnId(firstCol) : "");
                }}
                className="gap-2 rounded-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
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
            currentUserId={currentUser?._id}
            currentUserAvatar={currentUser?.avatar}
            onAddCard={handleOpenAddDialog}
            onEditCard={handleOpenEditDialog}
            onMoveCard={handleMoveCard}
            onDuplicateCard={handleDuplicateCard}
            onDeleteCard={handleDeleteCard}
            onJoinCard={handleJoinCard}
            onLeaveCard={handleLeaveCard}
            onRemoveFromCycle={handleRemoveFromCycle}
            onAssignExistingTasks={handleAssignExistingTasksToDate}
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
            modal.card._id ? () => handleDuplicateCard(modal.card as TaskType) : undefined
          }
          onRemoveFromCycle={
            cycleId && modal.card._id
              ? () => {
                  handleRemoveFromCycle(modal.card as TaskType, closeModal);
                }
              : undefined
          }
          isReadOnly={isReadOnly}
        />
      )}

      {/* Task Delete Confirmation Modal */}
      {modal.type === 'delete-task' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-card p-6 rounded-lg border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Delete Task</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{modal.task.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={closeModal} disabled={projectState.status.isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleTaskDeleteConfirm} disabled={projectState.status.isDeleting}>
                {projectState.status.isDeleting ? "Deleting..." : "Delete Task"}
              </Button>
            </div>
          </div>
        </div>
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
