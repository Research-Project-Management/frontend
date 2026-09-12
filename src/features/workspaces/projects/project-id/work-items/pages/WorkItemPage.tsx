'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import Topbar from "../components/layout/Topbar";
import { FilterPillsBar } from "../components/filters/FilterPillsBar";
import { AnalyticsDrawer } from "../components/analytics/AnalyticsDrawer";
import { BoardView } from "../components/views/BoardView";
import { ListView } from "../components/views/ListView";
import { CalendarView } from "../components/views/CalendarView";
import { TableView } from "../components/views/TableView";
import { TimelineView } from "../components/views/TimelineView";
import { EmptyState } from "../components/views/EmptyState";
import { CreateModal } from "../components/modals/CreateModal";
import { DetailModal } from "../components/modals/DetailModal";
import { DeleteModal } from "../components/modals/DeleteModal";
import { TransferModal } from "../components/modals/TransferModal";
import { AddExistingModal, AddExistingModal as AddExistingTaskModal } from "../components/modals/AddExistingModal";
import { BulkActionBar } from "../components/layout/BulkActionBar";
import {
  useProject,
  useBulkUpdate,
  useBulkDelete,
} from "../hooks/use-work-item";
import {
  useBulkArchive,
  useBulkRestore,
  useArchivedItems,
} from "../hooks/use-archive";
import { ItemHelpers, TaskHelpers, resolveTaskColumnId, resolveTaskColumnColor } from "../utils/work-item.utils";
import { useTopbar } from "../hooks/use-topbar";
import { useRealtimeWorkItems } from "../hooks/use-realtime";
import type {
  Item,
  Task,
  ItemMutationInput,
  TaskMutationInput,
  Column,
  Priority,
} from "../types/work-item.types";
import { resolveStateId, resolveColumnId } from "../utils/work-item.utils";
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
  SlidersHorizontal,
} from "lucide-react";
import { WorkItemsIcon } from "@/shared/components/ui";

export type ModalState =
  | { type: 'idle' }
  | { type: 'create'; initialData?: Partial<Item> }
  | { type: 'detail'; card: Item; item?: Item }
  | { type: 'delete'; item: Item; task?: Item }
  | { type: 'delete-task'; task: Item; item?: Item }
  | { type: 'add-existing' }
  | { type: 'transfer' };

export type TaskModalState = ModalState;

export interface WorkItemPageProps {
  cycleId?: string;
  isReadOnly?: boolean;
}
export type PageProps = WorkItemPageProps;
export type TaskPageProps = WorkItemPageProps;

export function WorkItemPage({
  cycleId: propCycleId,
  isReadOnly: propIsReadOnly,
}: WorkItemPageProps = {}) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const params = useParams() as {
    projectId?: string;
    cycleId?: string;
    viewId?: string;
  };
  const projectId = params.projectId || "";
  const cycleId = propCycleId ?? params.cycleId;
  const rawViewId = params.viewId || searchParams?.get('viewId');
  const isReadOnly = propIsReadOnly ?? false;

  // ── 1. Data Domain Layer (useTaskProject) ─────────────────────────────────
  const { state: projectState, actions: projectActions } = useProject({
    projectId,
    cycleId,
  });

  useRealtimeWorkItems({ projectId, enabled: Boolean(projectId) });

  const {
    items: projectItems,
    columns,
    project,
    members,
    cycles,
    currentCycle,
    labels,
    labelMap,
    isLoading,
  } = projectState;
  const allItems = projectItems || [];

  // ── Multi-select & Bulk Operations ─────────────────────────────────────────
  const bulkUpdateMutation = useBulkUpdate();
  const bulkDeleteMutation = useBulkDelete();
  const bulkArchiveMutation = useBulkArchive();
  const bulkRestoreMutation = useBulkRestore();
  const [showArchived, setShowArchived] = useState(false);
  const { data: archivedItems = [] } = useArchivedItems(showArchived ? projectId : '');

  const displayItems = useMemo(() => {
    return showArchived ? archivedItems : allItems;
  }, [showArchived, archivedItems, allItems]);

  const allTasks = allItems;
  const displayTasks = displayItems;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedTaskIds = selectedIds;

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);
  const handleToggleSelectTask = handleToggleSelect;

  const handleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);
  const handleSelectAllTasks = handleSelectAll;

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleBulkUpdateState = useCallback((columnId: string) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { columnId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdatePriority = useCallback((priority: any) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { priority },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdateAssignee = useCallback((assigneeId: string | null) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { assigneeId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdateDueDate = useCallback((dueDate: string | null) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { dueDate },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkUpdateCycle = useCallback((newCycleId: string | null) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { cycleId: newCycleId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    bulkDeleteMutation.mutate({
      taskIds: selectedIds,
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, bulkDeleteMutation, projectId, handleClearSelection]);

  const handleBulkArchive = useCallback(() => {
    if (selectedIds.length === 0) return;
    bulkArchiveMutation.mutate({
      taskIds: selectedIds,
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, bulkArchiveMutation, projectId, handleClearSelection]);

  const handleBulkRestore = useCallback(() => {
    if (selectedIds.length === 0) return;
    bulkRestoreMutation.mutate({
      taskIds: selectedIds,
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, bulkRestoreMutation, projectId, handleClearSelection]);

  const handleBulkAddLabel = useCallback((labelId: string) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { addLabel: labelId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkRemoveLabel = useCallback((labelId: string) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { removeLabel: labelId },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  const handleBulkClearLabels = useCallback(() => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      taskIds: selectedIds,
      data: { clearLabels: true },
      projectId,
    }, {
      onSuccess: () => {
        handleClearSelection();
      }
    });
  }, [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]);

  // ── 2. View & Filter Presentation Layer (useTopbar) ───────────────────────
  const { state: topbarState, actions: topbarActions } = useTopbar({
    items: displayItems,
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

  // Auto-activate saved view if viewId is passed in URL params or route
  const appliedViewIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!rawViewId || !savedViews || savedViews.length === 0) return;
    if (appliedViewIdRef.current === rawViewId) return;

    const targetView = savedViews.find((v) => v.id === rawViewId);
    if (targetView) {
      appliedViewIdRef.current = rawViewId;
      selectSavedView(targetView);
    }
  }, [rawViewId, savedViews, selectSavedView]);

  // ── 3. Dynamic GroupBy Adapter ───────────────────────────────────────────
  const activeColumns = useMemo<Column[]>(() => {
    const groupBy = displayOptions.groupBy;
    if (groupBy === 'priority') {
      return [
        { id: 'urgent', name: 'Urgent', title: 'Urgent', color: '#ef4444', accentColor: '#ef4444', group: 'unstarted', sequence: 0, isDefault: false },
        { id: 'high', name: 'High', title: 'High', color: '#f97316', accentColor: '#f97316', group: 'unstarted', sequence: 1, isDefault: false },
        { id: 'medium', name: 'Medium', title: 'Medium', color: '#f59e0b', accentColor: '#f59e0b', group: 'unstarted', sequence: 2, isDefault: false },
        { id: 'low', name: 'Low', title: 'Low', color: '#3b82f6', accentColor: '#3b82f6', group: 'unstarted', sequence: 3, isDefault: false },
        { id: 'none', name: 'No Priority', title: 'No Priority', color: '#6b7280', accentColor: '#6b7280', group: 'unstarted', sequence: 4, isDefault: false },
      ];
    }
    if (groupBy === 'assignee') {
      const memberCols: Column[] = (members || []).map((m, idx) => {
        const userId = m.userId || (m as any).user?.id || m.id || `member-${idx}`;
        const name = m.name || (m as any).user?.name || 'Member';
        return {
          id: userId,
          name,
          title: name,
          color: '#6366f1',
          accentColor: '#6366f1',
          group: 'unstarted',
          sequence: idx,
          isDefault: false,
        };
      });
      return [
        ...memberCols,
        { id: '__unassigned__', name: 'Unassigned', title: 'Unassigned', color: '#9ca3af', accentColor: '#9ca3af', group: 'backlog', sequence: 999, isDefault: false },
      ];
    }
    if (groupBy === 'cycle') {
      const cycleCols: Column[] = (cycles || []).map((c, idx) => ({
        id: c.id,
        name: c.name,
        title: c.name,
        color: '#3b82f6',
        accentColor: '#3b82f6',
        group: 'started',
        sequence: idx,
        isDefault: false,
      }));
      return [
        ...cycleCols,
        { id: '__no_cycle__', name: 'No Cycle', title: 'No Cycle', color: '#9ca3af', accentColor: '#9ca3af', group: 'backlog', sequence: 999, isDefault: false },
      ];
    }
    return columns;
  }, [displayOptions.groupBy, columns, members, cycles]);

  const groupedTasks = useMemo<Item[]>(() => {
    const groupBy = displayOptions.groupBy;
    if (groupBy === 'priority') {
      return filteredTasks.map((t) => ({
        ...t,
        columnId: (t.priority || 'none').toLowerCase(),
      }));
    }
    if (groupBy === 'assignee') {
      return filteredTasks.map((t) => {
        const assigneeId = ItemHelpers.resolveAssigneeId(t);
        return {
          ...t,
          columnId: assigneeId || '__unassigned__',
        };
      });
    }
    if (groupBy === 'cycle') {
      return filteredTasks.map((t) => ({
        ...t,
        columnId: t.cycleId || '__no_cycle__',
      }));
    }
    return filteredTasks;
  }, [displayOptions.groupBy, filteredTasks]);

  // ── 4. Kanban Column Mapping ──────────────────────────────────────────────
  const tasksByColumnId = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const column of activeColumns) {
      const colId = resolveColumnId(column);
      if (colId) map.set(colId, []);
    }
    for (const task of groupedTasks) {
      const colId = resolveColumnId(task);
      if (!colId) continue;
      const list = map.get(colId);
      if (list) {
        list.push(task);
      } else {
        map.set(colId, [task]);
      }
    }
    return map;
  }, [activeColumns, groupedTasks]);

  // ── 4. Unified Discriminated Modal State (Matt Pocock Pattern) ────────────
  const [modal, setModal] = useState<TaskModalState>({ type: 'idle' });
  const closeModal = useCallback(() => setModal({ type: 'idle' }), []);

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
    dueDateOrSwimlane?: string | { subGroupBy?: string; laneId?: string },
    quickTitleParam?: string,
    swimlaneParam?: { subGroupBy?: string; laneId?: string },
  ) => {
    const dueDate = typeof dueDateOrSwimlane === 'string' ? dueDateOrSwimlane : undefined;
    const swimlaneData =
      typeof dueDateOrSwimlane === 'object' && dueDateOrSwimlane !== null
        ? dueDateOrSwimlane
        : swimlaneParam;
    const quickTitle =
      quickTitleParam?.trim() ||
      (typeof dueDateOrSwimlane === 'string' ? undefined : title?.trim());

    const defaultColumnId = columns[0]?.id || 'backlog';
    let targetColumnId = columnId;
    let targetPriority: Priority = 'none';
    let targetAssigneeId: string | null = null;
    let targetCycleId: string | undefined = cycleId;

    if (displayOptions.groupBy === 'priority') {
      targetColumnId = defaultColumnId;
      targetPriority = (columnId === 'none' ? 'none' : columnId) as Priority;
    } else if (displayOptions.groupBy === 'assignee') {
      targetColumnId = defaultColumnId;
      targetAssigneeId = columnId === '__unassigned__' ? null : columnId;
    } else if (displayOptions.groupBy === 'cycle') {
      targetColumnId = defaultColumnId;
      targetCycleId = columnId === '__no_cycle__' ? undefined : columnId;
    }

    if (swimlaneData?.subGroupBy && swimlaneData?.laneId) {
      if (swimlaneData.subGroupBy === 'priority') {
        targetPriority = (swimlaneData.laneId === 'none' ? 'none' : swimlaneData.laneId) as Priority;
      } else if (swimlaneData.subGroupBy === 'assignee') {
        targetAssigneeId = swimlaneData.laneId === '__unassigned__' ? null : swimlaneData.laneId;
      } else if (swimlaneData.subGroupBy === 'cycle') {
        targetCycleId = swimlaneData.laneId === '__no_cycle__' ? undefined : swimlaneData.laneId;
      }
    }

    if (quickTitle) {
      if (projectState.isSavingTask) return;
      projectActions.createTask({
        projectId,
        columnId: targetColumnId,
        title: quickTitle,
        dueDate,
        cycleId: targetCycleId,
        assigneeId: targetAssigneeId,
        priority: targetPriority,
      });
      return;
    }

    setModal({
      type: 'create',
      initialData: {
        columnId: targetColumnId,
        title: title?.trim() || "",
        dueDate,
        cycleId: targetCycleId,
        assigneeId: targetAssigneeId,
        priority: targetPriority,
      },
    });
  };

  const handleOpenEditDialog = (card: Item) => {
    setModal({ type: 'detail', card });
  };

  const handleMoveCard = (
    taskId: string,
    newColumnId: string,
    laneData?: { subGroupBy?: string; laneId?: string }
  ) => {
    if (!taskId || !newColumnId) return;

    if (displayOptions.groupBy === 'priority') {
      projectActions.updateTask({
        taskId,
        projectId,
        priority: (newColumnId === 'none' ? 'none' : newColumnId) as Priority,
      });
      return;
    }
    if (displayOptions.groupBy === 'assignee') {
      projectActions.updateTask({
        taskId,
        projectId,
        assigneeId: newColumnId === '__unassigned__' ? null : newColumnId,
      });
      return;
    }
    if (displayOptions.groupBy === 'cycle') {
      projectActions.updateTask({
        taskId,
        projectId,
        cycleId: newColumnId === '__no_cycle__' ? null : newColumnId,
      });
      return;
    }

    const updatePayload: any = { columnId: newColumnId };
    if (laneData?.subGroupBy && laneData?.laneId) {
      if (laneData.subGroupBy === 'priority') {
        updatePayload.priority = (laneData.laneId === 'none' ? 'none' : laneData.laneId) as Priority;
      } else if (laneData.subGroupBy === 'assignee') {
        updatePayload.assigneeId = laneData.laneId === '__unassigned__' ? null : laneData.laneId;
      } else if (laneData.subGroupBy === 'cycle') {
        updatePayload.cycleId = laneData.laneId === '__no_cycle__' ? null : laneData.laneId;
      }
    }

    if (Object.keys(updatePayload).length > 1) {
      projectActions.updateTask({
        taskId,
        projectId,
        ...updatePayload,
      });
    } else {
      projectActions.moveTask({
        taskId,
        columnId: newColumnId,
        projectId,
      });
    }
  };

  const handleReorderCard = (taskId: string, newColumnId: string, rank: number) => {
    if (!taskId) return;

    if (displayOptions.groupBy === 'priority') {
      projectActions.updateTask({
        taskId,
        projectId,
        priority: (newColumnId === 'none' ? 'none' : newColumnId) as Priority,
      });
      return;
    }
    if (displayOptions.groupBy === 'assignee') {
      projectActions.updateTask({
        taskId,
        projectId,
        assigneeId: newColumnId === '__unassigned__' ? null : newColumnId,
      });
      return;
    }
    if (displayOptions.groupBy === 'cycle') {
      projectActions.updateTask({
        taskId,
        projectId,
        cycleId: newColumnId === '__no_cycle__' ? null : newColumnId,
      });
      return;
    }

    projectActions.reorderTask({
      taskId,
      columnId: newColumnId,
      rank,
      projectId,
    });
  };

  const handleCreateTask = async (formData: ItemMutationInput & { createMore?: boolean }) => {
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
      const result: any = await projectActions.createTask(payload);
      const createdItem = result?.task || result?.workItem || result?.WorkItem || result?.item;
      if (createMore) {
        setModal({
          type: 'create',
          initialData: { columnId: formData.columnId },
        });
      } else if (createdItem?.id) {
        setModal({ type: 'detail', card: createdItem });
      } else {
        closeModal();
      }
    } catch {
      // Error is handled by mutation hook
    }
  };

  const handleSaveCard = async (formData: ItemMutationInput) => {
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
      setModal({ type: 'delete-task', task: modal.card });
    }
  };

  const handleTaskDeleteConfirm = () => {
    if ((modal.type === 'delete-task' || modal.type === 'delete') && ((modal as any).task?.id || (modal as any).item?.id)) {
      projectActions.deleteItem({ id: ((modal as any).item?.id || (modal as any).task?.id), projectId }).then(() => {
        closeModal();
      });
    }
  };

  const handleDuplicateCard = (card: Item) => {
    projectActions.duplicateTask({ projectId, taskId: card.id });
  };

  const handleJoinCard = (card: Item) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = ItemHelpers.resolveAssigneeId(card);
    if (currentAssigneeId === currentUser.id) return;

    projectActions.updateTask({
      taskId: card.id,
      projectId,
      assigneeId: currentUser.id,
    });
  };

  const handleLeaveCard = (card: Item) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = ItemHelpers.resolveAssigneeId(card);
    if (currentAssigneeId !== currentUser.id) return;

    projectActions.updateTask({
      taskId: card.id,
      projectId,
      assigneeId: null,
    });
  };

  const handleRemoveFromCycle = (card: Item, callback?: () => void) => {
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

  const isCycleEmpty = cycleId && displayItems.length === 0 && !isLoading && !showArchived;
  const isProjectEmpty = !cycleId && displayItems.length === 0 && !isLoading && !showArchived;
  const isArchivedEmpty = showArchived && displayItems.length === 0 && !isLoading;

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
        count={displayItems.length}
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
        onAddItem={() => setModal({ type: 'create' })}
        onAddTask={() => {
          const firstCol = columns[0];
          handleOpenAddDialog(firstCol ? resolveStateId(firstCol) : "");
        }}
        onAddExistingItem={cycleId ? () => setModal({ type: 'add-existing' }) : undefined}
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

      {/* Active Saved View Notice Banner */}
      {!showArchived && activeViewId && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-primary/5 border-b border-primary/15 text-xs text-foreground shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <SlidersHorizontal className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">
              Viewing view: <strong className="font-semibold text-foreground">{savedViews?.find((v) => v.id === activeViewId)?.name || 'Custom View'}</strong>
            </span>
            <span className="text-10 font-mono capitalize px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {viewMode}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearAllFilters();
              if (rawViewId) {
                router.push(`/projects/${projectId}/work-items`);
              }
            }}
            className="h-6 px-2 text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          >
            Clear view
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
          <EmptyState
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
                columns={activeColumns}
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
                selectedIds={selectedIds} selectedTaskIds={selectedIds}
                onToggleSelect={handleToggleSelect} onToggleSelectTask={handleToggleSelect}
                onSelectAll={handleSelectAll} onSelectAllTasks={handleSelectAll}
                displayOptions={displayOptions}
                members={members}
                cycles={cycles}
              />
            )}
            {viewMode === 'calendar' && (
              <CalendarView
                items={filteredTasks} tasks={filteredTasks}
                columns={columns}
                workspaceId=""
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
                items={groupedTasks} tasks={groupedTasks}
                columns={activeColumns}
                displayOptions={displayOptions}
                currentUserId={currentUser?.id}
                currentUserAvatar={currentUser?.avatar ?? undefined}
                projectId={projectId}
                workspaceId=""
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
                items={filteredTasks} tasks={filteredTasks}
                columns={columns}
                currentUserId={currentUser?.id}
                currentUserAvatar={currentUser?.avatar ?? undefined}
                projectId={projectId}
                workspaceId=""
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
                onUpdateCard={(task) => handleQuickUpdateTask(task.id, task)}
                isReadOnly={isReadOnly}
              />
            )}
            {(viewMode === 'board' || !['list', 'calendar', 'table', 'timeline'].includes(viewMode)) && (
              <BoardView
                items={groupedTasks} tasks={groupedTasks}
                tasksByColumnId={tasksByColumnId}
                columns={activeColumns}
                labelMap={labelMap}
                currentUserId={currentUser?.id}
                currentUserAvatar={currentUser?.avatar ?? undefined}
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
                onReorderCard={handleReorderCard}
                cycleId={cycleId}
                isReadOnly={isReadOnly}
                displayOptions={displayOptions}
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
        items={filteredTasks} tasks={filteredTasks}
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
        availableTasks={allItems}
        onSubmit={handleCreateTask}
        isSubmitting={projectState.isSaving}
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
            modal.card.id ? () => handleDuplicateCard(modal.card) : undefined
          }
          onRemoveFromCycle={
            cycleId && modal.card.id
              ? () => {
                  handleRemoveFromCycle(modal.card, closeModal);
                }
              : undefined
          }
          isReadOnly={isReadOnly}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      <BulkActionBar
        selectedIds={selectedIds} selectedTaskIds={selectedIds}
        totalCount={displayItems.length}
        columns={columns}
        members={members}
        cycles={cycles}
        labels={labels}
        onClearSelection={handleClearSelection}
        onUpdateState={handleBulkUpdateState}
        onUpdatePriority={handleBulkUpdatePriority}
        onUpdateAssignee={handleBulkUpdateAssignee}
        onUpdateDueDate={handleBulkUpdateDueDate}
        onUpdateCycle={handleBulkUpdateCycle}
        onAddLabel={handleBulkAddLabel}
        onRemoveLabel={handleBulkRemoveLabel}
        onClearLabels={handleBulkClearLabels}
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
        open={modal.type === 'delete-task' || modal.type === 'delete'}
        onOpenChange={(open) => !open && closeModal()}
        item={(modal as any).item || (modal as any).task || null}
        task={(modal as any).task || (modal as any).item || null}
        onConfirm={handleTaskDeleteConfirm}
        isDeleting={projectState.status.isDeleting}
      />

      {/* Cycle Modals */}
      {cycleId && (
        <>
          <AddExistingModal
            open={modal.type === 'add-existing'}
            onOpenChange={(open: boolean) => (open ? setModal({ type: 'add-existing' }) : closeModal())}
            projectId={projectId}
            currentCycleId={cycleId}
            columns={columns}
            members={members}
          />

          <TransferModal
            open={modal.type === 'transfer'}
            onOpenChange={(open: boolean) => (open ? setModal({ type: 'transfer' }) : closeModal())}
            projectId={projectId}
            sourceCycleId={cycleId}
            sourceCycleName={currentCycle?.name || "Current Cycle"}
            tasks={allItems}
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
              Save your current layout and filter criteria as a reusable view.
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

export const Page = WorkItemPage;
export const TaskPage = WorkItemPage;
export default WorkItemPage;

