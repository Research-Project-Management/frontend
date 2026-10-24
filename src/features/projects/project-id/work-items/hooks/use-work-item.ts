'use client';

import { useMemo, useCallback } from 'react';
import type {
  Item,
  Project,
  ProjectMember,
  Priority,
  Label,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import { DEFAULT_STATES } from '@/features/projects/project-id/work-items/types/work-item.types';
import { normalizeStates, resolveItemId } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { useLabelsQuery } from './use-label';

// Re-export all sub-hooks and schemas for 100% backward compatibility
export * from './use-work-items-query';
export * from './use-work-item-crud';
export * from './use-work-item-form';
export * from './use-work-item-selection';
export * from './use-work-item-toast';

import {
  useProjectItems,
  useProjectDetails,
  useProjectStates,
} from './use-work-items-query';
import {
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useDuplicateItem,
  useBulkUpdate,
  useReorderItem,
  useCreateSubItem,
} from './use-work-item-crud';

// ── Composite Project Work-Item Hook (useProject) ───────────────────────────

import type { UseProjectOptions } from '@/features/projects/project-id/work-items/types/hook.types';

export type { UseProjectOptions };

/**
 * Lightweight Quick-Create Context Hook.
 * Only fetches project details + states and mounts a single `useCreateItem` mutation,
 * avoiding the 4 queries + 7 mutations of the full `useProject` workspace hook.
 */
export function useQuickCreateWorkItemContext(projectId: string) {
  const detailsQ = useProjectDetails(projectId);
  const statesQ = useProjectStates(projectId);
  const createMut = useCreateItem();

  const project = useMemo(() => {
    const projectData = detailsQ.data;
    if (!projectData) return undefined;
    return ('project' in projectData && projectData.project ? projectData.project : projectData) as Project | undefined;
  }, [detailsQ.data]);

  const projectColumns = (project as { workItemColumns?: unknown[] } | undefined)?.workItemColumns;
  const columns = useMemo(() => {
    if (Array.isArray(statesQ.data) && statesQ.data.length > 0) {
      return normalizeStates(statesQ.data);
    }
    if (Array.isArray(projectColumns) && projectColumns.length > 0) {
      return normalizeStates(projectColumns);
    }
    return [...DEFAULT_STATES];
  }, [statesQ.data, projectColumns]);

  const members = useMemo(() => (project?.members ?? []) as ProjectMember[], [project?.members]);

  return {
    project,
    columns,
    members,
    isSaving: createMut.isPending,
    create: createMut.mutateAsync,
  };
}

export function useProject({ projectId }: UseProjectOptions) {
  const itemsQ = useProjectItems(projectId);
  const detailsQ = useProjectDetails(projectId);
  const statesQ = useProjectStates(projectId);
  const labelsQ = useLabelsQuery(projectId, 'work_item');

  const createMut = useCreateItem();
  const updateMut = useUpdateItem();
  const deleteMut = useDeleteItem();
  const duplicateMut = useDuplicateItem();
  const bulkMut = useBulkUpdate();
  const reorderMut = useReorderItem();
  const subItemMut = useCreateSubItem();

  const items = useMemo(() => {
    if (Array.isArray(itemsQ.data)) return itemsQ.data as Item[];
    return itemsQ.data?.items ?? itemsQ.data?.workItems ?? [];
  }, [itemsQ.data]);
  const project = useMemo(() => {
    const projectData = detailsQ.data;
    if (!projectData) return undefined;
    return ('project' in projectData && projectData.project ? projectData.project : projectData) as Project | undefined;
  }, [detailsQ.data]);

  const projectColumns = (project as { workItemColumns?: unknown[] } | undefined)?.workItemColumns;
  const columns = useMemo(() => {
    if (Array.isArray(statesQ.data) && statesQ.data.length > 0) {
      return normalizeStates(statesQ.data);
    }
    const rawCols = !Array.isArray(itemsQ.data)
      ? (itemsQ.data?.columns || (itemsQ.data as { states?: unknown[] } | undefined)?.states)
      : undefined;
    if (Array.isArray(rawCols) && rawCols.length > 0) return normalizeStates(rawCols);
    if (Array.isArray(projectColumns) && projectColumns.length > 0) return normalizeStates(projectColumns);
    return [...DEFAULT_STATES];
  }, [statesQ.data, itemsQ.data, projectColumns]);
  const members = useMemo(() => (project?.members ?? []) as ProjectMember[], [project?.members]);
  const labels = useMemo(() => (labelsQ.data ?? []) as Label[], [labelsQ.data]);

  const labelMap = useMemo(() => {
    return new Map(labels.map((label) => [label.id, { id: label.id, name: label.name, color: label.color || '#94a3b8' }]));
  }, [labels]);
  const isSaving = updateMut.isPending || createMut.isPending;
  const isDeleting = deleteMut.isPending;
  const isBulkUpdating = bulkMut.isPending;
  const isLoading = itemsQ.isLoading;
  const isError = itemsQ.isError || detailsQ.isError;
  const error = itemsQ.error || detailsQ.error;

  const state = useMemo(
    () => ({
      items,
      workItems: items,
      columns,
      project,
      members,
      labels,
      labelMap,
      status: {
        isLoading,
        isError,
        isSaving,
        isDeleting,
        isBulkUpdating,
        error,
      },
      isLoading,
      isError,
      error,
      isSaving,
      isDeleting,
      isBulkUpdating,
    }),
    [items, columns, project, members, labels, labelMap, isLoading, isError, isSaving, isDeleting, isBulkUpdating, error]
  );

  const createMutAsync = createMut.mutateAsync;
  const updateMutAsync = updateMut.mutateAsync;
  const deleteMutAsync = deleteMut.mutateAsync;
  const duplicateMutAsync = duplicateMut.mutateAsync;
  const bulkMutAsync = bulkMut.mutateAsync;
  const reorderMutAsync = reorderMut.mutateAsync;
  const subItemMutAsync = subItemMut.mutateAsync;
  const refetchItems = itemsQ.refetch;
  const refetchDetails = detailsQ.refetch;

  const createAction = useCallback((payload: Parameters<typeof createMutAsync>[0]) => createMutAsync(payload), [createMutAsync]);
  const updateAction = useCallback((payload: Parameters<typeof updateMutAsync>[0]) => updateMutAsync(payload), [updateMutAsync]);
  const deleteAction = useCallback((target: { id?: string; itemId?: string; workItemId?: string; projectId?: string }) => {
    const tid = resolveItemId(target);
    return deleteMutAsync({
      id: tid,
      itemId: tid,
      workItemId: tid,
      projectId: target.projectId,
    });
  }, [deleteMutAsync]);

  const duplicateAction = useCallback(
    (target: { id?: string; itemId?: string; workItemId?: string; projectId?: string }) => {
      const tid = resolveItemId(target);
      return duplicateMutAsync({ projectId: target.projectId || projectId, id: tid, itemId: tid, workItemId: tid });
    },
    [duplicateMutAsync, projectId],
  );

  const moveAction = useCallback(
    (moveInput: { id?: string; itemId?: string; workItemId?: string; columnId: string; projectId?: string }) => {
      const tid = resolveItemId(moveInput);
      return updateMutAsync({
        projectId: moveInput.projectId || projectId,
        id: tid,
        itemId: tid,
        workItemId: tid,
        columnId: moveInput.columnId,
      });
    },
    [updateMutAsync, projectId],
  );

  const reorderAction = useCallback(
    (reorderInput: { id?: string; itemId?: string; workItemId?: string; rank: number; columnId?: string; projectId?: string }) => {
      const tid = resolveItemId(reorderInput);
      return reorderMutAsync({
        projectId: reorderInput.projectId || projectId,
        id: tid,
        itemId: tid,
        workItemId: tid,
        columnId: reorderInput.columnId,
        rank: reorderInput.rank,
      });
    },
    [reorderMutAsync, projectId],
  );

  const createSubItemAction = useCallback(
    (subItemInput: { id?: string; itemId?: string; workItemId?: string; title: string; columnId?: string; priority?: Priority }) => {
      const tid = resolveItemId(subItemInput);
      return subItemMutAsync({
        id: tid,
        itemId: tid,
        workItemId: tid,
        title: subItemInput.title,
        columnId: subItemInput.columnId,
        priority: subItemInput.priority,
      });
    },
    [subItemMutAsync],
  );

  const bulkAction = useCallback((payload: Parameters<typeof bulkMutAsync>[0]) => bulkMutAsync(payload), [bulkMutAsync]);

  const refetchAction = useCallback(() => {
    refetchItems();
    refetchDetails();
  }, [refetchItems, refetchDetails]);

  const assignItemsToDateAction = useCallback(
    (itemIds: string[], dueDate: string, quiet = false, startDate?: string | null) => {
      if (itemIds.length === 0) return;
      const data: Record<string, unknown> = { dueDate };
      if (startDate !== undefined) data.startDate = startDate;
      bulkMutAsync({
        workItemIds: itemIds,
        ids: itemIds,
        data,
        projectId,
        quiet,
        successMessage:
          itemIds.length === 1
            ? 'Work item added to calendar'
            : `${itemIds.length} work items added to calendar`,
      }).catch(() => {
        // Error toast and rollback are handled by useBulkUpdate
      });
    },
    [bulkMutAsync, projectId],
  );

  const actions = useMemo(
    () => ({
      create: createAction,
      update: updateAction,
      delete: deleteAction,
      duplicate: duplicateAction,
      move: moveAction,
      reorder: reorderAction,
      createSubItem: createSubItemAction,
      bulk: bulkAction,
      refetch: refetchAction,

      // Domain Work Item Actions
      createWorkItem: createAction,
      updateWorkItem: updateAction,
      moveWorkItem: moveAction,
      deleteWorkItem: deleteAction,
      deleteItem: deleteAction,
      duplicateWorkItem: duplicateAction,
      reorderWorkItem: reorderAction,
      createSubWorkItem: createSubItemAction,
      assignWorkItemsToDate: assignItemsToDateAction,
    }),
    [
      createAction,
      updateAction,
      deleteAction,
      duplicateAction,
      moveAction,
      reorderAction,
      createSubItemAction,
      bulkAction,
      refetchAction,
      assignItemsToDateAction,
    ]
  );

  return { state, actions };
}

export default useProject;
