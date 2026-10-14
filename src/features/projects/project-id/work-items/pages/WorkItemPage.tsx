'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import Topbar from '../components/layout/Topbar';
import { FilterPillsBar } from '../components/filters/FilterPillsBar';
import { BulkActionBar } from '../components/layout/BulkActionBar';
import {
  WorkItemModals,
  ModalState,
} from '../components/layout/WorkItemModals';
import { WorkItemViewContainer } from '../components/layout/WorkItemViewContainer';
import {
  useProject,
  useBulkUpdate,
  useBulkDelete,
  useWorkItemSelection,
} from '../hooks/use-work-item';
import {
  useBulkArchive,
  useBulkRestore,
  useArchivedItems,
} from '../hooks/use-archive';
import { useWorkItemGrouping } from '../hooks/use-work-item-grouping';
import {
  ItemHelpers,
  resolveStateId,
} from '../utils/work-item.utils';
import { useTopbar } from '../hooks/use-topbar';
import { useRealtimeWorkItems } from '../hooks/use-realtime';
import type {
  Item,
  ItemMutationInput,
  Priority,
} from '../types/work-item.types';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Archive } from 'lucide-react';
import { WorkItemsIcon } from '@/shared/components/icons';

export interface WorkItemPageProps {
  isReadOnly?: boolean;
}
export type PageProps = WorkItemPageProps;

const EMPTY_ITEMS: Item[] = [];

export function WorkItemPage({
  isReadOnly: propIsReadOnly,
}: WorkItemPageProps = {}) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const params = useParams() as {
    projectId?: string;
  };
  const projectId = params.projectId || '';
  const isReadOnly = propIsReadOnly ?? false;

  // ── 1. Data Domain Layer (useProject) ──────────────────────────────────────
  const { state: projectState, actions: projectActions } = useProject({
    projectId,
  });

  useRealtimeWorkItems({ projectId, enabled: Boolean(projectId) });

  const {
    items: projectItems,
    columns,
    project,
    members,
    labels,
    labelMap,
    isLoading,
  } = projectState;
  const allItems = projectItems || EMPTY_ITEMS;

  // ── 2. Multi-select & Bulk Operations ──────────────────────────────────────
  const bulkUpdateMutation = useBulkUpdate();
  const bulkDeleteMutation = useBulkDelete();
  const bulkArchiveMutation = useBulkArchive();
  const bulkRestoreMutation = useBulkRestore();
  const [showArchived, setShowArchived] = useState(false);
  const { data: archivedItems = EMPTY_ITEMS } = useArchivedItems(showArchived ? projectId : '');

  const displayItems = useMemo(() => {
    return showArchived ? archivedItems : allItems;
  }, [showArchived, archivedItems, allItems]);

  const {
    selectedIds,
    toggleSelect: handleToggleSelect,
    selectAll: handleSelectAll,
    clearSelection: handleClearSelection,
  } = useWorkItemSelection();

  const handleBulkUpdate = useCallback(
    (data: Record<string, unknown>) => {
      if (selectedIds.length === 0) return;
      bulkUpdateMutation.mutate(
        {
          workItemIds: selectedIds,
          ids: selectedIds,
          data,
          projectId,
        },
        { onSuccess: handleClearSelection }
      );
    },
    [selectedIds, projectId, bulkUpdateMutation, handleClearSelection]
  );

  const handleBulkUpdateState = useCallback((columnId: string) => handleBulkUpdate({ columnId }), [handleBulkUpdate]);
  const handleBulkUpdatePriority = useCallback((priority: Priority) => handleBulkUpdate({ priority }), [handleBulkUpdate]);
  const handleBulkUpdateAssignee = useCallback((assigneeId: string | null) => handleBulkUpdate({ assigneeId }), [handleBulkUpdate]);
  const handleBulkUpdateDueDate = useCallback((dueDate: string | null) => handleBulkUpdate({ dueDate }), [handleBulkUpdate]);
  const handleBulkAddLabel = useCallback((labelId: string) => handleBulkUpdate({ addLabel: labelId }), [handleBulkUpdate]);
  const handleBulkRemoveLabel = useCallback((labelId: string) => handleBulkUpdate({ removeLabel: labelId }), [handleBulkUpdate]);
  const handleBulkClearLabels = useCallback(() => handleBulkUpdate({ clearLabels: true }), [handleBulkUpdate]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    bulkDeleteMutation.mutate(
      { workItemIds: selectedIds, ids: selectedIds, projectId },
      { onSuccess: handleClearSelection }
    );
  }, [selectedIds, bulkDeleteMutation, projectId, handleClearSelection]);

  const handleBulkArchive = useCallback(() => {
    if (selectedIds.length === 0) return;
    bulkArchiveMutation.mutate(
      { workItemIds: selectedIds, ids: selectedIds, projectId },
      { onSuccess: handleClearSelection }
    );
  }, [selectedIds, bulkArchiveMutation, projectId, handleClearSelection]);

  const handleBulkRestore = useCallback(() => {
    if (selectedIds.length === 0) return;
    bulkRestoreMutation.mutate(
      { workItemIds: selectedIds, ids: selectedIds, projectId },
      { onSuccess: handleClearSelection }
    );
  }, [selectedIds, bulkRestoreMutation, projectId, handleClearSelection]);

  // ── 3. View & Filter Presentation Layer (useTopbar) ────────────────────────
  const { state: topbarState, actions: topbarActions } = useTopbar({
    items: displayItems,
    columns,
    members,
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
    filters,
  } = topbarState;

  const activeFilteredItems: Item[] = useMemo(
    () => filteredItems || EMPTY_ITEMS,
    [filteredItems]
  );

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
    setDisplayOptions,
    updateDisplayProperty,
    setDisplayOpen,
    setAnalyticsOpen,
  } = topbarActions;

  // ── 4. Dynamic GroupBy & Column Bucketing Adapter ───────────────────────────
  const {
    effectiveGroupBy,
    itemsByColumnId,
    visibleColumns,
  } = useWorkItemGrouping({
    items: activeFilteredItems,
    columns,
    members,
    labels,
    displayOptions,
  });

  // ── 5. Unified Modal State & Keyboard Shortcuts ────────────────────────────
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
  }, [columns, searchParams, pathname, router]);

  // ── 6. Action Handlers ─────────────────────────────────────────────────────
  const handleOpenAddDialog = useCallback((
    columnIdOrOptions: string | { columnId?: string; title?: string; dueDate?: string; lane?: { subGroupBy?: string; laneId?: string } },
    titleArg?: string,
    extraArg?: string | { subGroupBy?: string; laneId?: string },
  ) => {
    let targetColumnId = typeof columnIdOrOptions === 'string' ? columnIdOrOptions : (columnIdOrOptions?.columnId || '');
    const title = typeof columnIdOrOptions === 'object' ? columnIdOrOptions.title : titleArg;
    const dueDate = typeof columnIdOrOptions === 'object' ? columnIdOrOptions.dueDate : (typeof extraArg === 'string' ? extraArg : undefined);
    const swimlaneData = typeof columnIdOrOptions === 'object' ? columnIdOrOptions.lane : (typeof extraArg === 'object' ? extraArg : undefined);

    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    const defaultColumnId = defaultCol ? resolveStateId(defaultCol) : 'backlog';
    if (!targetColumnId) targetColumnId = defaultColumnId;

    let targetPriority: Priority = 'none';
    let targetAssigneeId: string | null = null;

    if (effectiveGroupBy === 'priority') {
      targetPriority = (targetColumnId === 'none' ? 'none' : targetColumnId) as Priority;
      targetColumnId = defaultColumnId;
    } else if (effectiveGroupBy === 'assignee') {
      targetAssigneeId = targetColumnId === '__unassigned__' ? null : targetColumnId;
      targetColumnId = defaultColumnId;
    }

    if (swimlaneData?.subGroupBy && swimlaneData?.laneId) {
      if (swimlaneData.subGroupBy === 'priority') {
        targetPriority = (swimlaneData.laneId === 'none' ? 'none' : swimlaneData.laneId) as Priority;
      } else if (swimlaneData.subGroupBy === 'assignee') {
        targetAssigneeId = swimlaneData.laneId === '__unassigned__' ? null : swimlaneData.laneId;
      }
    }

    const trimmedTitle = title?.trim();
    if (trimmedTitle) {
      if (projectState.isSaving) return;
      (projectActions.createWorkItem || projectActions.create)({
        projectId,
        columnId: targetColumnId,
        title: trimmedTitle,
        dueDate,
        assigneeId: targetAssigneeId,
        priority: targetPriority,
      });
      return;
    }

    setModal({
      type: 'create',
      initialData: {
        columnId: targetColumnId,
        title: '',
        dueDate,
        assigneeId: targetAssigneeId,
        priority: targetPriority,
      },
    });
  }, [columns, effectiveGroupBy, projectState.isSaving, projectActions, projectId]);

  const handleOpenEditDialog = useCallback((card: Item) => {
    setModal({ type: 'detail', card });
  }, []);

  const handleMoveCard = useCallback((
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

    const updatePayload: Partial<Item> = { columnId: newColumnId };
    if (laneData?.subGroupBy && laneData?.laneId) {
      if (laneData.subGroupBy === 'priority') {
        updatePayload.priority = (laneData.laneId === 'none' ? 'none' : laneData.laneId) as Priority;
      } else if (laneData.subGroupBy === 'assignee') {
        updatePayload.assigneeId = laneData.laneId === '__unassigned__' ? null : laneData.laneId;
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
  }, [effectiveGroupBy, projectActions, projectId]);

  const handleReorderCard = useCallback((workItemId: string, newColumnId: string, rank: number) => {
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
      const targetItem = displayItems.find((i) => i.id === workItemId);
      if (targetItem) {
        projectActions.reorderWorkItem({
          workItemId,
          id: workItemId,
          columnId: targetItem.columnId,
          rank,
          projectId,
        });
      }
      return;
    }

    projectActions.reorderWorkItem({
      workItemId,
      id: workItemId,
      columnId: newColumnId,
      rank,
      projectId,
    });
  }, [effectiveGroupBy, projectActions, projectId, displayItems]);

  const handleCreateItem = useCallback(async (formData: ItemMutationInput & { createMore?: boolean }) => {
    if (!formData.title?.trim()) return;

    const { createMore, ...restData } = formData;
    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    const defaultColumnId = defaultCol ? resolveStateId(defaultCol) : 'backlog';
    const payload = {
      ...restData,
      columnId: formData.columnId || defaultColumnId,
      title: formData.title.trim(),
      projectId,
    };

    try {
      const result = (await (projectActions.createWorkItem || projectActions.create)(payload)) as {
        subItem?: Item;
        workItem?: Item;
        item?: Item;
      } & Partial<Item>;
      const createdItem = result?.subItem || result?.workItem || result?.item || (result?.id ? (result as Item) : undefined);
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
      // Error handled by mutation hook
    }
  }, [columns, projectId, projectActions, closeModal]);

  const handleSaveCard = useCallback(async (formData: ItemMutationInput) => {
    if (modal.type !== 'detail' || !modal.card.id) return;
    if (!formData.title?.trim()) return;

    const payload = {
      ...formData,
      title: formData.title.trim(),
      projectId,
      id: modal.card.id,
      workItemId: modal.card.id,
    };

    try {
      await projectActions.updateWorkItem(payload);
    } catch {
      // Error handled by mutation hook
    }
  }, [modal, projectId, projectActions]);

  const handleDeleteCard = useCallback(() => {
    if (modal.type === 'detail' && modal.card.id) {
      setModal({ type: 'delete', item: modal.card });
    }
  }, [modal]);

  const handleItemDeleteConfirm = useCallback(() => {
    if (modal.type === 'delete' && modal.item?.id) {
      projectActions.deleteItem({ id: modal.item.id, projectId }).then(() => {
        closeModal();
      });
    }
  }, [modal, projectActions, projectId, closeModal]);

  const handleDuplicateCard = useCallback((card: Item) => {
    projectActions.duplicateWorkItem({ projectId, workItemId: card.id, id: card.id });
  }, [projectActions, projectId]);

  const handleJoinCard = useCallback((card: Item) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = ItemHelpers.resolveAssigneeId(card);
    if (currentAssigneeId === currentUser.id) return;

    projectActions.updateWorkItem({
      workItemId: card.id,
      id: card.id,
      projectId,
      assigneeId: currentUser.id,
    });
  }, [currentUser?.id, projectActions, projectId]);

  const handleLeaveCard = useCallback((card: Item) => {
    if (!currentUser?.id) return;
    const currentAssigneeId = ItemHelpers.resolveAssigneeId(card);
    if (currentAssigneeId !== currentUser.id) return;

    projectActions.updateWorkItem({
      workItemId: card.id,
      id: card.id,
      projectId,
      assigneeId: null,
    });
  }, [currentUser?.id, projectActions, projectId]);

  const handleAssignExistingItemsToDate = useCallback((
    itemIds: string[],
    dueDate: string,
    quiet = false,
    startDate?: string | null,
  ) => {
    projectActions.assignWorkItemsToDate(itemIds, dueDate, quiet, startDate);
  }, [projectActions]);

  const handleQuickUpdateItem = useCallback(
    (itemId: string, data: Partial<Item>) => {
      projectActions.updateWorkItem({ workItemId: itemId, id: itemId, projectId, ...data });
    },
    [projectActions, projectId],
  );

  const handleQuickUpdateItemFromCard = useCallback((item: { id: string } & Partial<Item>) => {
    handleQuickUpdateItem(item.id, item);
  }, [handleQuickUpdateItem]);

  const isProjectEmpty = displayItems.length === 0 && !isLoading && !showArchived;
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
        projectModules={(project as { modules?: string[] } | undefined)?.modules}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((prev) => !prev)}
        title={showArchived ? 'Archived items' : 'Work Items'}
        Icon={showArchived ? Archive : WorkItemsIcon}
        count={displayItems.length}
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
        isLoading={isLoading}
        isReadOnly={isReadOnly}
      />

      {/* Archived Notice Banner */}
      {showArchived && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/60 border-b border-border text-xs text-foreground shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Archive className="size-4 shrink-0 text-foreground" />
            <span>
              <span className="font-semibold">Archived Mode:</span> You are viewing archived work items. They are excluded from active boards and views.
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowArchived(false)}
            className="h-6 px-2 text-xs font-medium hover:bg-muted text-foreground relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
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
        items={allItems}
      />

      {/* Main View Area Container */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <WorkItemViewContainer
          viewMode={viewMode}
          isArchivedEmpty={isArchivedEmpty}
          isProjectEmpty={isProjectEmpty}
          onDisableArchived={() => setShowArchived(false)}
          onCreateItemFromEmpty={() => {
            const firstCol = columns[0];
            handleOpenAddDialog(firstCol ? resolveStateId(firstCol) : '');
          }}
          isReadOnly={isReadOnly}
          projectId={projectId}
          activeFilteredItems={activeFilteredItems}
          itemsByColumnId={itemsByColumnId}
          visibleColumns={visibleColumns}
          columns={columns}
          displayOptions={displayOptions}
          currentUserId={currentUser?.id}
          currentUserAvatar={currentUser?.avatar ?? undefined}
          members={members}
          labelMap={labelMap}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={(ids) => handleSelectAll(ids || [])}
          onOpenAddDialog={handleOpenAddDialog}
          onOpenEditDialog={handleOpenEditDialog}
          onDeleteCard={handleDeleteCard}
          onDuplicateCard={handleDuplicateCard}
          onJoinCard={handleJoinCard}
          onLeaveCard={handleLeaveCard}
          onMoveCard={handleMoveCard}
          onReorderCard={handleReorderCard}
          onQuickUpdateItem={handleQuickUpdateItem}
          onQuickUpdateItemFromCard={handleQuickUpdateItemFromCard}
          onAssignExistingItemsToDate={handleAssignExistingItemsToDate}
          updateDisplayProperty={updateDisplayProperty}
        />
      </div>

      {/* Floating Bulk Actions Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        totalCount={displayItems.length}
        columns={columns}
        members={members}
        labels={labels}
        onClearSelection={handleClearSelection}
        onUpdateState={handleBulkUpdateState}
        onUpdatePriority={handleBulkUpdatePriority}
        onUpdateAssignee={handleBulkUpdateAssignee}
        onUpdateDueDate={handleBulkUpdateDueDate}
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

      {/* Modals & Dialogs Container */}
      <WorkItemModals
        modal={modal}
        onCloseModal={closeModal}
        columns={columns}
        members={members}
        project={project}
        projectId={projectId}
        allItems={allItems}
        isSaving={projectState.isSaving}
        isDeleting={projectState.status.isDeleting}
        isReadOnly={isReadOnly}
        onCreateItem={handleCreateItem}
        onSaveCard={handleSaveCard}
        onDeleteCard={handleDeleteCard}
        onConfirmDelete={handleItemDeleteConfirm}
        onDuplicateCard={() => {
          if (modal.type === 'detail' && modal.card.id) {
            handleDuplicateCard(modal.card);
          }
        }}
        isAnalyticsOpen={analyticsOpen}
        onCloseAnalytics={() => setAnalyticsOpen(false)}
        analyticsItems={activeFilteredItems}
        analyticsAssignees={assignees}
      />
    </div>
  );
}

export const Page = WorkItemPage;
export default WorkItemPage;
