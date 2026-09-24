'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Topbar from "../components/layout/Topbar";
import { FilterPillsBar } from "../components/filters/FilterPillsBar";
import { BoardView } from "../components/views/BoardView";
import { ListView } from "../components/views/ListView";
import { EmptyState } from "../components/views/EmptyState";

const CalendarView = dynamic(
  () => import("../components/views/CalendarView").then((m) => m.CalendarView),
  { ssr: false }
);
const TableView = dynamic(
  () => import("../components/views/TableView").then((m) => m.TableView),
  { ssr: false }
);
const TimelineView = dynamic(
  () => import("../components/views/TimelineView").then((m) => m.TimelineView),
  { ssr: false }
);

const CreateModal = dynamic(
  () => import("../components/modals/CreateModal").then((m) => m.CreateModal),
  { ssr: false }
);
const DetailModal = dynamic(
  () => import("../components/modals/DetailModal").then((m) => m.DetailModal),
  { ssr: false }
);
const DeleteModal = dynamic(
  () => import("../components/modals/DeleteModal").then((m) => m.DeleteModal),
  { ssr: false }
);
const TransferModal = dynamic(
  () => import("../components/modals/TransferModal").then((m) => m.TransferModal),
  { ssr: false }
);
const AddExistingModal = dynamic(
  () => import("../components/modals/AddExistingModal").then((m) => m.AddExistingModal),
  { ssr: false }
);
import { BulkActionBar } from "../components/layout/BulkActionBar";
import { AnalyticsDrawer } from "../components/analytics/AnalyticsDrawer";
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
import { ItemHelpers, WorkItemHelpers, resolveColumnId, resolveStateId, getItemBucketKey } from "../utils/work-item.utils";
import { useTopbar } from "../hooks/use-topbar";
import { useRealtimeWorkItems } from "../hooks/use-realtime";
import type {
  Item,
  WorkItem,
  ItemMutationInput,
  WorkItemMutationInput,
  Column,
  Priority,
} from "../types/work-item.types";
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
  | { type: 'delete'; item: Item }
  | { type: 'add-existing' }
  | { type: 'transfer' };

export interface WorkItemPageProps {
  cycleId?: string;
  isReadOnly?: boolean;
}
export type PageProps = WorkItemPageProps;
export function WorkItemPage({
  cycleId: propCycleId,
  isReadOnly: propIsReadOnly,
}: WorkItemPageProps = {}) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const params = useParams() as {
    workspaceId?: string;
    projectId?: string;
    cycleId?: string;
    viewId?: string;
  };
  const workspaceId = params.workspaceId || "";
  const projectId = params.projectId || "";
  const cycleId = propCycleId ?? params.cycleId;
  const rawViewId = params.viewId || searchParams?.get('viewId');
  const isReadOnly = propIsReadOnly ?? false;

  // ── 1. Data Domain Layer (useProject) ─────────────────────────────────
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback((ids?: string[]) => {
    setSelectedIds(ids || []);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleBulkUpdateState = useCallback((columnId: string) => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
      workItemIds: selectedIds,
      ids: selectedIds,
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
    filteredItems,
    assignees,
    savedViews,
    activeViewId,
    filters,
  } = topbarState;
  const activeFilteredItems: Item[] = filteredItems || [];

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

  // ── 3. Dynamic GroupBy Adapter (Plane.so matching architecture) ──────────
  // If groupBy is 'cycle' but project has no cycles or is in a cycle view, fallback to 'state'
  const effectiveGroupBy = useMemo(() => {
    const gb = displayOptions.groupBy;
    if (gb === 'cycle' && (cycles.length === 0 || Boolean(cycleId))) {
      return 'state';
    }
    return gb && ['state', 'priority', 'assignee', 'cycle', 'labels', 'none', 'createdBy'].includes(gb)
      ? gb
      : 'state';
  }, [displayOptions.groupBy, cycles.length, cycleId]);

  const activeColumns = useMemo<Column[]>(() => {
    const groupBy = effectiveGroupBy;
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
    if (groupBy === 'labels') {
      const labelCols: Column[] = (labels || []).map((l: any, idx: number) => {
        const id = l.id || l.name;
        const name = l.name || l.title || 'Label';
        const color = l.color || '#3b82f6';
        return {
          id,
          name,
          title: name,
          color,
          accentColor: color,
          group: 'unstarted',
          sequence: idx,
          isDefault: false,
        };
      });
      return [
        ...labelCols,
        { id: '__no_label__', name: 'No Label', title: 'No Label', color: '#9ca3af', accentColor: '#9ca3af', group: 'backlog', sequence: 999, isDefault: false },
      ];
    }
    if (groupBy === 'createdBy') {
      const authorCols: Column[] = (members || []).map((m: any, idx: number) => {
        const userId = m.userId || m.user?.id || m.id || `author-${idx}`;
        const name = m.name || m.user?.name || 'Member';
        return {
          id: userId,
          name,
          title: name,
          color: '#8b5cf6',
          accentColor: '#8b5cf6',
          group: 'unstarted',
          sequence: idx,
          isDefault: false,
        };
      });
      return [
        ...authorCols,
        { id: '__unknown__', name: 'Unknown Creator', title: 'Unknown Creator', color: '#9ca3af', accentColor: '#9ca3af', group: 'backlog', sequence: 999, isDefault: false },
      ];
    }
    if (groupBy === 'none') {
      return [
        { id: '__all__', name: 'All Work Items', title: 'All Work Items', color: '#6366f1', accentColor: '#6366f1', group: 'unstarted', sequence: 0, isDefault: true },
      ];
    }
    return columns;
  }, [effectiveGroupBy, columns, members, cycles, labels]);

  // ── 4. Kanban Column Mapping ──────────────────────────────────────────────
  const itemsByColumnId = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const column of activeColumns) {
      const colId = resolveColumnId(column);
      if (colId) map.set(colId, []);
    }

    const fallbackCol = activeColumns.find((c) => c.isDefault) || activeColumns[0];
    const fallbackColId = fallbackCol ? resolveColumnId(fallbackCol) : undefined;

    for (const item of activeFilteredItems) {
      const bucketKey = getItemBucketKey(item, effectiveGroupBy);
      if (bucketKey && map.has(bucketKey)) {
        map.get(bucketKey)!.push(item);
      } else if (fallbackColId && map.has(fallbackColId)) {
        map.get(fallbackColId)!.push(item);
      } else if (bucketKey) {
        map.set(bucketKey, [item]);
      }
    }
    return map;
  }, [activeColumns, activeFilteredItems, effectiveGroupBy]);

  // Display visible columns respecting showEmptyGroups
  const visibleColumns = useMemo(() => {
    if (displayOptions.showEmptyGroups === false && effectiveGroupBy !== 'none') {
      const filtered = activeColumns.filter((col) => {
        const colId = resolveColumnId(col);
        const count = itemsByColumnId.get(colId)?.length ?? 0;
        return count > 0;
      });
      return filtered.length > 0 ? filtered : activeColumns;
    }
    return activeColumns;
  }, [activeColumns, itemsByColumnId, displayOptions.showEmptyGroups, effectiveGroupBy]);

  // ── 4. Unified Discriminated Modal State (Matt Pocock Pattern) ────────────
  const [modal, setModal] = useState<ModalState>({ type: 'idle' });
  const closeModal = useCallback(() => setModal({ type: 'idle' }), []);

  const pathname = usePathname();

  useEffect(() => {
    const handleOpenModal = () => {
      const defaultCol = columns.find((c) => c.isDefault) || columns[0];
      const defaultColumnId = defaultCol ? resolveStateId(defaultCol) : 'backlog';
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'c' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase() || '') &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        handleOpenModal();
      }
    };

    window.addEventListener('open-new-work-item-modal', handleOpenModal);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-new-work-item-modal', handleOpenModal);
      window.removeEventListener('keydown', handleKeyDown);
    };
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

    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    const defaultColumnId = defaultCol ? resolveStateId(defaultCol) : 'backlog';
    let targetColumnId = columnId;
    let targetPriority: Priority = 'none';
    let targetAssigneeId: string | null = null;
    let targetCycleId: string | undefined = cycleId;

    if (effectiveGroupBy === 'priority') {
      targetColumnId = defaultColumnId;
      targetPriority = (columnId === 'none' ? 'none' : columnId) as Priority;
    } else if (effectiveGroupBy === 'assignee') {
      targetColumnId = defaultColumnId;
      targetAssigneeId = columnId === '__unassigned__' ? null : columnId;
    } else if (effectiveGroupBy === 'cycle') {
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
      if (projectState.isSaving) return;
      (projectActions.createWorkItem || projectActions.create)({
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
    workItemId: string,
    newColumnId: string,
    laneData?: { subGroupBy?: string; laneId?: string }
  ) => {
    if (!workItemId || !newColumnId) return;

    if (effectiveGroupBy === 'priority') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        priority: (newColumnId === 'none' ? 'none' : newColumnId) as Priority,
      });
      return;
    }
    if (effectiveGroupBy === 'assignee') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        assigneeId: newColumnId === '__unassigned__' ? null : newColumnId,
      });
      return;
    }
    if (effectiveGroupBy === 'cycle') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        cycleId: newColumnId === '__no_cycle__' ? null : newColumnId,
      });
      return;
    }
    if (effectiveGroupBy === 'labels') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        labels: newColumnId === '__no_label__' ? [] : [newColumnId],
      });
      return;
    }
    if (effectiveGroupBy === 'none') {
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
      } else if (laneData.subGroupBy === 'labels') {
        updatePayload.labels = laneData.laneId === '__no_label__' ? [] : [laneData.laneId];
      }
    }

    if (Object.keys(updatePayload).length > 1) {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        ...updatePayload,
      });
    } else {
      projectActions.moveWorkItem({
        workItemId,
        id: workItemId,
        columnId: newColumnId,
        projectId,
      });
    }
  };

  const handleReorderCard = (workItemId: string, newColumnId: string, rank: number) => {
    if (!workItemId) return;

    if (effectiveGroupBy === 'priority') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        priority: (newColumnId === 'none' ? 'none' : newColumnId) as Priority,
      });
      return;
    }
    if (effectiveGroupBy === 'assignee') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        assigneeId: newColumnId === '__unassigned__' ? null : newColumnId,
      });
      return;
    }
    if (effectiveGroupBy === 'cycle') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        cycleId: newColumnId === '__no_cycle__' ? null : newColumnId,
      });
      return;
    }
    if (effectiveGroupBy === 'labels') {
      projectActions.updateWorkItem({
        workItemId,
        id: workItemId,
        projectId,
        labels: newColumnId === '__no_label__' ? [] : [newColumnId],
      });
      return;
    }
    if (effectiveGroupBy === 'none') {
      return;
    }

    projectActions.reorderWorkItem({
      workItemId,
      id: workItemId,
      columnId: newColumnId,
      rank,
      projectId,
    });
  };

  const handleCreateItem = async (formData: ItemMutationInput & { createMore?: boolean }) => {
    if (!formData.title?.trim()) {
      return;
    }

    const { createMore, ...restData } = formData;
    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    const defaultColumnId = defaultCol ? resolveStateId(defaultCol) : 'backlog';
    const payload = {
      ...restData,
      columnId: formData.columnId || defaultColumnId,
      title: formData.title.trim(),
      cycleId: formData.cycleId !== undefined ? formData.cycleId : cycleId,
      projectId,
    };

    try {
      const result: any = await (projectActions.createWorkItem || projectActions.create)(payload);
      const createdItem = result?.subItem || result?.workItem || result?.item;
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
      id: modal.card.id,
      workItemId: modal.card.id,
      };

    try {
      await projectActions.updateWorkItem(payload);
    } catch {
      // Error is handled by mutation hook
    }
  };

  const handleDeleteCard = () => {
    if (modal.type === 'detail' && modal.card.id) {
      setModal({ type: 'delete', item: modal.card });
    }
  };

  const handleItemDeleteConfirm = () => {
    if (modal.type === 'delete' && modal.item?.id) {
      projectActions.deleteItem({ id: modal.item.id, projectId }).then(() => {
        closeModal();
      });
    }
  };

  const handleDuplicateCard = (card: Item) => {
    projectActions.duplicateWorkItem({ projectId, workItemId: card.id, id: card.id });
  };

  const handleJoinCard = (card: Item) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = ItemHelpers.resolveAssigneeId(card);
    if (currentAssigneeId === currentUser.id) return;

    projectActions.updateWorkItem({
      workItemId: card.id,
      id: card.id,
      projectId,
      assigneeId: currentUser.id,
    });
  };

  const handleLeaveCard = (card: Item) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = ItemHelpers.resolveAssigneeId(card);
    if (currentAssigneeId !== currentUser.id) return;

    projectActions.updateWorkItem({
      workItemId: card.id,
      id: card.id,
      projectId,
      assigneeId: null,
    });
  };

  const handleRemoveFromCycle = (card: Item, callback?: () => void) => {
    projectActions.removeFromCycle(card.id, callback);
  };

  const handleAssignExistingItemsToDate = (
    itemIds: string[],
    dueDate: string,
    quiet = false,
    startDate?: string | null,
  ) => {
    projectActions.assignWorkItemsToDate(itemIds, dueDate, quiet, startDate);
  };

  const handleQuickUpdateItem = useCallback(
    (itemId: string, data: any) => {
      projectActions.updateWorkItem({ workItemId: itemId, id: itemId, projectId, ...data });
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
        projectId={projectId}
        project={project}
        projectModules={(project as any)?.modules}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSelectSavedView={selectSavedView}
        onSaveCurrentView={() => setIsSaveViewOpen(true)}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((prev) => !prev)}
        title={showArchived ? "Archived items" : "Work Items"}
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
        onAddExistingItem={cycleId ? () => setModal({ type: 'add-existing' }) : undefined}
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
            <span className="text-10 font-mono capitalize px-1.5 py-0.5 rounded-md bg-muted text-foreground font-medium">
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
            className="h-6 px-2 text-xs font-medium hover:bg-muted text-foreground shrink-0 rounded-md cursor-pointer"
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
        items={allItems}
        cycles={cycles}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {isArchivedEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
              <Archive className="w-8 h-8 text-foreground shrink-0" />
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
              className="gap-2 rounded-md h-8 px-3 text-13 font-medium bg-background border border-border text-foreground hover:bg-muted shadow-2xs cursor-pointer"
            >
              <span>Back to active items</span>
            </Button>
          </div>
        ) : isCycleEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
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
                className="gap-2 rounded-md h-8 px-3 text-13 font-medium bg-background border border-border text-foreground hover:bg-muted shadow-2xs cursor-pointer"
              >
                <ArrowRightLeft className="size-4 shrink-0" />
                <span>Add Existing Work Items</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const firstCol = columns[0];
                  handleOpenAddDialog(firstCol ? resolveStateId(firstCol) : "");
                }}
                className="gap-2 rounded-md h-8 px-4 text-13 font-medium bg-primary text-primary-foreground hover:bg-primary-hover shadow-none cursor-pointer"
              >
                <Plus className="size-4 shrink-0" />
                <span>Create Work Item</span>
              </Button>
            </div>
          </div>
        ) : isProjectEmpty && viewMode !== 'calendar' ? (
          <EmptyState
            onCreateItem={() => {
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
                itemsByColumnId={itemsByColumnId}
                columns={visibleColumns}
                projectStates={columns}
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
                onUpdateItem={handleQuickUpdateItem}
                isReadOnly={isReadOnly}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                displayOptions={displayOptions}
                members={members}
                cycles={cycles}
              />
            )}
            {viewMode === 'calendar' && (
              <CalendarView
                items={activeFilteredItems}
                columns={columns}
                workspaceId={workspaceId}
                projectId={projectId}
                onAddCard={handleOpenAddDialog}
                onOpenCardDetail={handleOpenEditDialog}
                onAssignExistingItems={handleAssignExistingItemsToDate}
                onRemoveFromCycle={cycleId ? handleRemoveFromCycle : undefined}
                isReadOnly={isReadOnly}
              />
            )}
            {viewMode === 'table' && (
              <TableView
                items={activeFilteredItems}
                itemsByColumnId={itemsByColumnId}
                columns={visibleColumns}
                projectStates={columns}
                displayOptions={displayOptions}
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
                onUpdateCard={(item) => handleQuickUpdateItem(item.id, item)}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                isReadOnly={isReadOnly}
                onToggleDisplayProperty={updateDisplayProperty}
              />
            )}
            {viewMode === 'timeline' && (
              <TimelineView
                items={activeFilteredItems}
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
                onUpdateCard={(item) => handleQuickUpdateItem(item.id, item)}
                isReadOnly={isReadOnly}
              />
            )}
            {(viewMode === 'board' || !['list', 'calendar', 'table', 'timeline'].includes(viewMode)) && (
              <BoardView
                items={activeFilteredItems}
                itemsByColumnId={itemsByColumnId}
                columns={visibleColumns}
                projectStates={columns}
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
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onUpdateItem={handleQuickUpdateItem}
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
        projectId={projectId}
        items={activeFilteredItems}
        columns={columns}
        assignees={assignees}
      />

      {/* Work Item Create Dialog */}
      {modal.type === 'create' && (
        <CreateModal
          open={true}
          onOpenChange={(open) => {
            if (!open) closeModal();
          }}
          columns={columns}
          members={members}
          initialData={modal.initialData}
          cycleId={cycleId}
          project={project || undefined}
          cycles={cycles}
          availableItems={allItems}
          onSubmit={handleCreateItem}
          isSubmitting={projectState.isSaving}
        />
      )}

      {/* Work Item Detail Dialog */}
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
          cycles={cycles}
          availableItems={allItems}
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
        selectedIds={selectedIds}
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

      {/* Work Item Delete Confirmation Modal */}
      {modal.type === 'delete' && (
        <DeleteModal
          open={true}
          onOpenChange={(open) => !open && closeModal()}
          item={modal.item}
          onConfirm={handleItemDeleteConfirm}
          isDeleting={projectState.status.isDeleting}
        />
      )}

      {/* Cycle Modals */}
      {cycleId && (
        <>
          {modal.type === 'add-existing' && (
            <AddExistingModal
              open={true}
              onOpenChange={(open: boolean) => (open ? setModal({ type: 'add-existing' }) : closeModal())}
              projectId={projectId}
              currentCycleId={cycleId}
              columns={columns}
              members={members}
            />
          )}

          {modal.type === 'transfer' && (
            <TransferModal
              open={true}
              onOpenChange={(open: boolean) => (open ? setModal({ type: 'transfer' }) : closeModal())}
              projectId={projectId}
              sourceCycleId={cycleId}
              sourceCycleName={currentCycle?.name || "Current Cycle"}
              items={allItems}
              availableCycles={cycles}
              columns={columns}
              members={members}
            />
          )}
        </>
      )}

      {/* Save Current View Dialog */}
      <Dialog open={isSaveViewOpen} onOpenChange={setIsSaveViewOpen}>
        <DialogContent className="sm:max-w-md p-5 bg-background border-border shadow-lg rounded-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Save Current View
            </DialogTitle>
            <DialogDescription className="text-13 text-muted-foreground">
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
              <label className="text-12 font-medium text-foreground">View Name *</label>
              <Input
                placeholder="e.g. Active Experiments, Urgent Bugs..."
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                autoFocus
                className="h-8 text-13 bg-background border-border shadow-2xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSaveViewOpen(false)}
                disabled={isSavingCurrentView}
                className="h-8 px-3 text-13 font-medium rounded-md text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newViewName.trim() || isSavingCurrentView}
                className="h-8 px-4 text-13 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shadow-none cursor-pointer"
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
export default WorkItemPage;

