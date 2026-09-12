'use client';

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import Topbar from "../components/layout/Topbar";
import { FilterPillsBar } from "../components/filters/FilterPillsBar";
import { AnalyticsDrawer } from "../components/analytics/AnalyticsDrawer";
import { BoardView } from "../components/views/BoardView";
import { ListView } from "../components/views/ListView";
import { CalendarView } from "../components/views/CalendarView";
import { TableView } from "../components/views/TableView";
import { TimelineView } from "../components/views/TimelineView";
import { WorkItemsEmptyState } from "../components/views/WorkItemsEmptyState";
import { CreateModal } from "../components/modals/CreateModal";
import { DetailModal } from "../components/modals/DetailModal";
import { DeleteModal } from "../components/modals/DeleteModal";
import { TransferModal } from "../components/modals/TransferModal";
import { AddExistingTaskModal } from "../components/modals/AddExistingModal";
import { BulkActionBar } from "../components/layout/BulkActionBar";
import {
  useTaskProject,
  useBulkUpdateTasks,
  useBulkDeleteTasks,
  useBulkArchiveTasks,
  useBulkRestoreTasks,
  useArchivedTasks,
  TaskHelpers,
} from "../hooks/use-tasks";
import { useTopbar } from "../hooks/use-topbar";
import { useKanban } from "../hooks/use-kanban";
import type {
  Task,
  TaskMutationInput,
} from "../types/types";
import { resolveStateId } from "../types/types";
import {
  Button,
  Skeleton,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  Plus,
  ArrowRightLeft,
  Archive,
} from "lucide-react";
import { WorkItemsIcon } from "@/shared/components/ui";

export type ModalState =
  | { type: 'idle' }
  | { type: 'create'; initialData?: Partial<Task> }
  | { type: 'detail'; card: Task }
  | { type: 'delete-task'; task: Task }
  | { type: 'add-existing' }
  | { type: 'transfer' };

export type TaskModalState = ModalState;

export interface PageProps {
  cycleId?: string;
  isReadOnly?: boolean;
}

export type TaskPageProps = PageProps;

export function Page({
  cycleId: propCycleId,
  isReadOnly: propIsReadOnly,
}: PageProps = {}) {
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

  // ── Multi-select & Bulk Operations ─────────────────────────────────────────
  const bulkUpdateMutation = useBulkUpdateTasks();
  const bulkDeleteMutation = useBulkDeleteTasks();
  const bulkArchiveMutation = useBulkArchiveTasks();
  const bulkRestoreMutation = useBulkRestoreTasks();
  const [showArchived, setShowArchived] = useState(false);
  const { data: archivedTasks = [] } = useArchivedTasks(showArchived ? projectId : '');

  const displayTasks = useMemo(() => {
    return showArchived ? archivedTasks : allTasks;
  }, [showArchived, archivedTasks, allTasks]);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const handleToggleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const handleSelectAllTasks = useCallback((taskIds: string[]) => {
    setSelectedTaskIds(taskIds);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const handleBulkUpdateState = useCallback((columnId: string) => {
    if (selectedTaskIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedTaskIds,
      data: { columnId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdatePriority = useCallback((priority: any) => {
    if (selectedTaskIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedTaskIds,
      data: { priority },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdateAssignee = useCallback((assigneeId: string | null) => {
    if (selectedTaskIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedTaskIds,
      data: { assigneeId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdateDueDate = useCallback((dueDate: string | null) => {
    if (selectedTaskIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedTaskIds,
      data: { dueDate },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdateCycle = useCallback((newCycleId: string | null) => {
    if (selectedTaskIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedTaskIds,
      data: { cycleId: newCycleId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkDelete = useCallback(() => {
    if (selectedTaskIds.length === 0) return;
    bulkDeleteMutation.mutate({
      taskIds: selectedTaskIds,
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, bulkDeleteMutation, projectId, handleClearSelection]);

  const handleBulkArchive = useCallback(() => {
    if (selectedTaskIds.length === 0) return;
    bulkArchiveMutation.mutate({
      taskIds: selectedTaskIds,
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, bulkArchiveMutation, projectId, handleClearSelection]);

  const handleBulkRestore = useCallback(() => {
    if (selectedTaskIds.length === 0) return;
    bulkRestoreMutation.mutate({
      taskIds: selectedTaskIds,
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedTaskIds, bulkRestoreMutation, projectId, handleClearSelection]);

  // ── 2. View & Filter Presentation Layer (useTopbar) ───────────────────────
  const { state: topbarState, actions: topbarActions } = useTopbar({
    tasks: displayTasks,
    columns,
    members,
    cycles,
    cycleId,
  });

  const {
    viewMode,
    selectedColumnIds,
    selectedAssigneeIds,
    selectedPriorities,
    dueDateFilter,
    displayOptions,
    displayOpen,
    analyticsOpen,
    totalActiveFilters,
    filteredTasks,
    assignees,
    savedViews,
    activeViewId,
    filters,
  } = topbarState;

  const {
    setViewMode,
    setSelectedColumnIds,
    setSelectedAssigneeIds,
    toggleColumnFilter,
    toggleAssigneeFilter,
    togglePriorityFilter,
    setDueDateFilter,
    removeColumnFilter,
    removeAssigneeFilter,
    removePriorityFilter,
    removeDueDateFilter,
    clearAllFilters,
    toggleFilterItem,
    removeFilterItem,
    handleCycleSelect,
    setDisplayOptions,
    updateDisplayProperty,
    setDisplayOpen,
    setAnalyticsOpen,
    selectSavedView,
    saveCurrentView,
    isSavingCurrentView,
  } = topbarActions;

  const [isSaveViewOpen, setIsSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');

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

  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const handleOpenModal = () => {
      const defaultColumnId = columns[0]?.id || 'backlog';
      setModal({
        type: 'create',
        initialData: {
          columnId: defaultColumnId,
          title: '',
          cycleId,
          assigneeId: null,
        },
      });
    };

    if (searchParams.get('action') === 'new' && columns.length > 0) {
      handleOpenModal();
      router.replace(pathname);
    }

    window.addEventListener('open-new-work-item-modal', handleOpenModal);
    return () => window.removeEventListener('open-new-work-item-modal', handleOpenModal);
  }, [columns, cycleId, searchParams, pathname, router]);

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
      });
      return;
    }

    setModal({
      type: 'create',
      initialData: {
        columnId,
        title: title?.trim() || "",
        dueDate,
        cycleId,
        assigneeId: null,
      },
    });
  };

  const handleOpenEditDialog = (card: Task) => {
    setModal({ type: 'detail', card });
  };

  const handleMoveCard = (taskId: string, newColumnId: string) => {
    if (!taskId || !newColumnId) return;

    projectActions.moveTask({
      taskId,
      columnId: newColumnId,
      projectId,
    });
  };

  const handleReorderCard = (taskId: string, newColumnId: string, rank: number) => {
    if (!taskId) return;

    projectActions.reorderTask({
      taskId,
      columnId: newColumnId,
      rank,
      projectId,
    });
  };

  const handleCreateTask = async (formData: TaskMutationInput & { createMore?: boolean }) => {
    if (!formData.title?.trim()) {
      return;
    }

    const { createMore, ...restData } = formData;
    const payload = {
      ...restData,
      title: formData.title.trim(),
      cycleId: formData.cycleId !== undefined ? formData.cycleId : cycleId,
      projectId,
    };

    try {
      const result = await projectActions.createTask(payload);
      if (createMore) {
        setModal({
          type: 'create',
          initialData: { columnId: formData.columnId },
        });
      } else if (result?.task?.id) {
        setModal({ type: 'detail', card: result.task });
      } else {
        closeModal();
      }
    } catch {
      // Error is handled by mutation hook
    }
  };

  const handleSaveCard = async (formData: TaskMutationInput) => {
    if (modal.type !== 'detail' || !modal.card.id) return;
    if (!formData.title?.trim()) {
      return;
    }

    const payload = {
      ...formData,
      title: formData.title.trim(),
      cycleId: formData.cycleId !== undefined ? formData.cycleId : cycleId,
      projectId,
      taskId: modal.card.id,
    };

    try {
      await projectActions.updateTask(payload);
    } catch {
      // Error is handled by mutation hook
    }
  };

  const handleDeleteCard = () => {
    if (modal.type === 'detail' && modal.card.id) {
      setModal({ type: 'delete-task', task: modal.card as Task });
    }
  };

  const handleTaskDeleteConfirm = () => {
    if (modal.type === 'delete-task' && modal.task.id) {
      projectActions.deleteTask({ taskId: modal.task.id, projectId }).then(() => {
        closeModal();
      });
    }
  };

  const handleDuplicateCard = (card: Task) => {
    projectActions.duplicateTask({ projectId, taskId: card.id });
  };

  const handleJoinCard = (card: Task) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = TaskHelpers.resolveAssigneeId(card);
    if (currentAssigneeId === currentUser.id) return;

    projectActions.updateTask({
      taskId: card.id,
      projectId,
      assigneeId: currentUser.id,
    });
  };

  const handleLeaveCard = (card: Task) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = TaskHelpers.resolveAssigneeId(card);
    if (currentAssigneeId !== currentUser.id) return;

    projectActions.updateTask({
      taskId: card.id,
      projectId,
      assigneeId: null,
    });
  };

  const handleRemoveFromCycle = (card: Task, callback?: () => void) => {
    projectActions.removeFromCycle(card.id, callback);
  };

  const handleAssignExistingTasksToDate = (
    taskIds: string[],
    dueDate: string,
    quiet = false,
    startDate?: string | null,
  ) => {
    projectActions.assignTasksToDate(taskIds, dueDate, quiet, startDate);
  };

  const handleQuickUpdateTask = useCallback(
    (taskId: string, data: any) => {
      projectActions.updateTask({ taskId, projectId, ...data });
    },
    [projectActions, projectId],
  );

  const isCycleEmpty = cycleId && displayTasks.length === 0 && !isLoading && !showArchived;
  const isProjectEmpty = !cycleId && displayTasks.length === 0 && !isLoading && !showArchived;
  const isArchivedEmpty = showArchived && displayTasks.length === 0 && !isLoading;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300">
        <div className="px-4 h-11 flex items-center gap-2 border-b border-border">
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
    <div className="flex-1 flex flex-col h-full min-h-0 bg-background">
      {/* Topbar Filter & Navigation */}
      <Topbar
        project={project}
        projectModules={(project as any)?.modules}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSelectSavedView={selectSavedView}
        onSaveCurrentView={() => setIsSaveViewOpen(true)}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((prev) => !prev)}
        title={showArchived ? "Archived items" : "Work items"}
        Icon={showArchived ? Archive : WorkItemsIcon}
        count={displayTasks.length}
        cycleId={cycleId}
        currentCycle={currentCycle}
        cycles={cycles}
        onCycleSelect={handleCycleSelect}
        viewMode={viewMode}
        onViewChange={setViewMode}
        columns={columns}
        selectedColumnIds={selectedColumnIds}
        onColumnFilterChange={setSelectedColumnIds}
        onToggleColumn={toggleColumnFilter}
        assignees={assignees}
        members={members}
        selectedAssigneeIds={selectedAssigneeIds}
        onAssigneeFilterChange={setSelectedAssigneeIds}
        onToggleAssignee={toggleAssigneeFilter}
        selectedPriorities={selectedPriorities}
        onTogglePriority={togglePriorityFilter}
        dueDateFilter={dueDateFilter}
        onDueDateFilterChange={setDueDateFilter}
        onClearAllFilters={clearAllFilters}
        totalActiveFilters={totalActiveFilters}
        filters={filters}
        onToggleFilter={toggleFilterItem}
        onRemoveFilter={removeFilterItem}
        displayOptions={displayOptions}
        onDisplayOptionsChange={setDisplayOptions}
        onPropertyToggle={updateDisplayProperty}
        displayOpen={displayOpen}
        onDisplayOpenChange={setDisplayOpen}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onAddTask={() => {
          const firstCol = columns[0];
          handleOpenAddDialog(firstCol ? resolveStateId(firstCol) : "");
        }}
        onAddExistingTask={cycleId ? () => setModal({ type: 'add-existing' }) : undefined}
        isLoading={isLoading}
        isReadOnly={isReadOnly}
      />

      {/* Archived Notice Banner */}
      {showArchived && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Archive className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Archived Mode:</strong> You are viewing archived work items. They are excluded from active boards and cycles.
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowArchived(false)}
            className="h-6 px-2 text-xs font-medium hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
          >
            Back to active items
          </Button>
        </div>
      )}

      {/* Filter Active Pills Bar */}
      <FilterPillsBar
        columns={columns}
        selectedColumnIds={selectedColumnIds}
        onRemoveColumn={removeColumnFilter}
        assignees={assignees}
        selectedAssigneeIds={selectedAssigneeIds}
        onRemoveAssignee={removeAssigneeFilter}
        selectedPriorities={selectedPriorities}
        onRemovePriority={removePriorityFilter}
        dueDateFilter={dueDateFilter}
        onRemoveDueDate={removeDueDateFilter}
        onClearAll={clearAllFilters}
        totalFiltersCount={totalActiveFilters}
        filters={filters}
        onToggleFilter={toggleFilterItem}
        onRemoveFilter={removeFilterItem}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {isArchivedEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Archive className="w-8 h-8 text-muted-foreground shrink-0" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No archived work items
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              When work items are archived, they will appear here safely stored away from active cycles and views.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(false)}
              className="gap-2 rounded-md cursor-pointer"
            >
              <span>Back to active items</span>
            </Button>
          </div>
        ) : isCycleEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <WorkItemsIcon className="w-8 h-8 text-foreground shrink-0" />
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
                  handleOpenAddDialog(firstCol ? resolveStateId(firstCol) : "");
                }}
                className="gap-2 rounded-md"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Create Work Item</span>
              </Button>
            </div>
          </div>
        ) : isProjectEmpty && viewMode !== 'calendar' ? (
          <WorkItemsEmptyState
            onCreateTask={() => {
              const firstCol = columns[0];
              handleOpenAddDialog(firstCol ? resolveStateId(firstCol) : "");
            }}
            isReadOnly={isReadOnly}
          />
        ) : (
          <>
            {viewMode === 'list' && (
              <ListView
                projectId={projectId}
                tasksByColumnId={tasksByColumnId}
                columns={columns}
                currentUserId={currentUser?.id}
                currentUserAvatar={currentUser?.avatar ?? undefined}
                onAddCard={handleOpenAddDialog}
                onEditCard={handleOpenEditDialog}
                onDeleteCard={handleDeleteCard}
                onDuplicateCard={handleDuplicateCard}
                onJoinCard={handleJoinCard}
                onLeaveCard={handleLeaveCard}
                onRemoveFromCycle={handleRemoveFromCycle}
                onMoveCard={handleMoveCard}
                onUpdateTask={handleQuickUpdateTask}
                isReadOnly={isReadOnly}
                selectedTaskIds={selectedTaskIds}
                onToggleSelectTask={handleToggleSelectTask}
                onSelectAllTasks={handleSelectAllTasks}
                displayOptions={displayOptions}
                members={members}
                cycles={cycles}
              />
            )}
            {viewMode === 'calendar' && (
              <CalendarView
                tasks={filteredTasks}
                columns={columns}
                workspaceId={workspaceId}
                projectId={projectId}
                onAddCard={handleOpenAddDialog}
                onOpenCardDetail={handleOpenEditDialog}
                onAssignExistingTasks={handleAssignExistingTasksToDate}
                onRemoveFromCycle={cycleId ? handleRemoveFromCycle : undefined}
                isReadOnly={isReadOnly}
              />
            )}
            {viewMode === 'table' && (
              <TableView
                tasks={filteredTasks}
                columns={columns}
                currentUserId={currentUser?.id}
                currentUserAvatar={currentUser?.avatar ?? undefined}
                projectId={projectId}
                workspaceId={workspaceId}
                members={members}
                cycles={cycles}
                onAddCard={handleOpenAddDialog}
                onEditCard={handleOpenEditDialog}
                onDeleteCard={handleDeleteCard}
                onDuplicateCard={handleDuplicateCard}
                onJoinCard={handleJoinCard}
                onLeaveCard={handleLeaveCard}
                onRemoveFromCycle={handleRemoveFromCycle}
                onMoveCard={handleMoveCard}
                isReadOnly={isReadOnly}
              />
            )}
            {viewMode === 'timeline' && (
              <TimelineView
                tasks={filteredTasks}
                columns={columns}
                currentUserId={currentUser?.id}
                currentUserAvatar={currentUser?.avatar ?? undefined}
                projectId={projectId}
                workspaceId={workspaceId}
                members={members}
                cycles={cycles}
                onAddCard={handleOpenAddDialog}
                onEditCard={handleOpenEditDialog}
                onDeleteCard={handleDeleteCard}
                onDuplicateCard={handleDuplicateCard}
                onJoinCard={handleJoinCard}
                onLeaveCard={handleLeaveCard}
                onRemoveFromCycle={handleRemoveFromCycle}
                onMoveCard={handleMoveCard}
                isReadOnly={isReadOnly}
              />
            )}
            {(viewMode === 'board' || !['list', 'calendar', 'table', 'timeline'].includes(viewMode)) && (
              <BoardView
                tasks={filteredTasks}
                tasksByColumnId={tasksByColumnId}
                columns={columns}
                labelMap={labelMap}
                currentUserId={currentUser?.id}
                currentUserAvatar={currentUser?.avatar ?? undefined}
                onAddCard={handleOpenAddDialog}
                onEditCard={handleOpenEditDialog}
                onDeleteCard={handleDeleteCard}
                onDuplicateCard={handleDuplicateCard}
                onJoinCard={handleJoinCard}
                onLeaveCard={handleLeaveCard}
                onRemoveFromCycle={handleRemoveFromCycle}
                onMoveCard={handleMoveCard}
                onReorderCard={handleReorderCard}
                cycleId={cycleId}
                isReadOnly={isReadOnly}
              />
            )}
          </>
        )}
      </div>

      {/* Analytics Drawer */}
      <AnalyticsDrawer
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        project={project || undefined}
        tasks={filteredTasks}
        columns={columns}
        assignees={assignees}
      />

      {/* Task Create Dialog */}
      <CreateModal
        open={modal.type === 'create'}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
        columns={columns}
        members={members}
        initialData={modal.type === 'create' ? modal.initialData : undefined}
        cycleId={cycleId}
        project={project || undefined}
        cycles={cycles}
        availableTasks={allTasks}
        onSubmit={handleCreateTask}
        isSubmitting={projectState.isSavingTask}
      />

      {/* Task Detail Dialog */}
      {modal.type === 'detail' && (
        <DetailModal
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
            modal.card.id ? () => handleDuplicateCard(modal.card as Task) : undefined
          }
          onRemoveFromCycle={
            cycleId && modal.card.id
              ? () => {
                  handleRemoveFromCycle(modal.card as Task, closeModal);
                }
              : undefined
          }
          isReadOnly={isReadOnly}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      <BulkActionBar
        selectedTaskIds={selectedTaskIds}
        totalCount={displayTasks.length}
        columns={columns}
        members={members}
        cycles={cycles}
        onClearSelection={handleClearSelection}
        onUpdateState={handleBulkUpdateState}
        onUpdatePriority={handleBulkUpdatePriority}
        onUpdateAssignee={handleBulkUpdateAssignee}
        onUpdateDueDate={handleBulkUpdateDueDate}
        onUpdateCycle={handleBulkUpdateCycle}
        onDeleteSelected={handleBulkDelete}
        onArchiveSelected={handleBulkArchive}
        onRestoreSelected={handleBulkRestore}
        isArchivedView={showArchived}
        isUpdating={
          bulkUpdateMutation.isPending ||
          bulkDeleteMutation.isPending ||
          bulkArchiveMutation.isPending ||
          bulkRestoreMutation.isPending
        }
      />

      {/* Task Delete Confirmation Modal */}
      <DeleteModal
        open={modal.type === 'delete-task'}
        onOpenChange={(open) => !open && closeModal()}
        task={modal.type === 'delete-task' ? modal.task : null}
        onConfirm={handleTaskDeleteConfirm}
        isDeleting={projectState.status.isDeleting}
      />

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

      {/* Save Current View Dialog */}
      <Dialog open={isSaveViewOpen} onOpenChange={setIsSaveViewOpen}>
        <DialogContent className="sm:max-w-md p-5 bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Save Current View
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Save your current layout and filter criteria as a reusable Saved View.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newViewName.trim()) return;
              await saveCurrentView(newViewName.trim());
              setNewViewName('');
              setIsSaveViewOpen(false);
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">View Name *</label>
              <Input
                placeholder="e.g. Active Experiments, Urgent Bugs..."
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                autoFocus
                className="h-8 text-xs bg-background border-border"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSaveViewOpen(false)}
                disabled={isSavingCurrentView}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newViewName.trim() || isSavingCurrentView}
                className="h-8 text-xs px-4 bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                {isSavingCurrentView ? 'Saving...' : 'Save View'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const TaskPage = Page;
export default Page;

