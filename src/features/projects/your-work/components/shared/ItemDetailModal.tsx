'use client';

import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DetailModal } from '@/features/projects/project-id/work-items/components/modals/DetailModal';
import {
  useProjectItems,
  useUpdateItem,
  useDeleteItem,
  useDuplicateItem,
} from '@/features/projects/project-id/work-items/hooks/use-work-item';
import {
  DEFAULT_STATES,
  type ItemMutationInput,
  type Item,
  type Project,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import { normalizeStates } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import type { YourWorkItem } from '../../schemas/your-work.schema';
import { useProjectDetails } from '@/features/projects/shell/hooks/use-project';

export interface ItemDetailModalProps {
  workItemId: string;
  projectId: string;
  initialWorkItem?: Item | YourWorkItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemDetailModal({
  workItemId,
  projectId,
  initialWorkItem,
  open,
  onOpenChange,
}: ItemDetailModalProps) {
  const queryClient = useQueryClient();

  const { data: projectWorkItems } = useProjectItems(projectId);
  const { data: projectDetails } = useProjectDetails(projectId);

  const updateWorkItemMutation = useUpdateItem();
  const deleteWorkItemMutation = useDeleteItem();
  const duplicateWorkItemMutation = useDuplicateItem();

  const rawItems = Array.isArray(projectWorkItems)
    ? projectWorkItems
    : (projectWorkItems?.workItems || projectWorkItems?.items || []);
  const fetchedWorkItem = (rawItems as Array<{ id?: string }>).find((t) => t.id === workItemId);
  const workItem = fetchedWorkItem || initialWorkItem;
  const pDetails = projectDetails as (typeof projectDetails & { workItemColumns?: Array<{ id: string; name: string; [key: string]: unknown }>; members?: Array<{ id?: string; userId?: string; [key: string]: unknown }> }) | undefined;
  const rawColumns = projectWorkItems?.columns && projectWorkItems.columns.length > 0
    ? projectWorkItems.columns
    : Array.isArray(pDetails?.workItemColumns)
      ? pDetails.workItemColumns
      : DEFAULT_STATES;
  const columns = normalizeStates(rawColumns);
  const members = pDetails?.members || [];

  const invalidateWorkspaceData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['your-work'] });
    queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });
    queryClient.invalidateQueries({ queryKey: ['work-item', workItemId] });
  }, [queryClient, projectId, workItemId]);

  const handleSave = useCallback((data: ItemMutationInput) => {
    updateWorkItemMutation.mutate(
      {
        workItemId,
        id: workItemId,
        projectId,
        ...data,
      },
      {
        onSuccess: () => {
          invalidateWorkspaceData();
        },
      },
    );
  }, [updateWorkItemMutation, workItemId, projectId, invalidateWorkspaceData]);

  const handleDelete = useCallback(() => {
    deleteWorkItemMutation.mutate(
      { workItemId, id: workItemId, projectId },
      {
        onSuccess: () => {
          invalidateWorkspaceData();
          onOpenChange(false);
        },
      },
    );
  }, [deleteWorkItemMutation, workItemId, projectId, invalidateWorkspaceData, onOpenChange]);

  const handleDuplicate = useCallback(() => {
    duplicateWorkItemMutation.mutate(
      { workItemId, id: workItemId, projectId },
      {
        onSuccess: () => {
          invalidateWorkspaceData();
        },
      },
    );
  }, [duplicateWorkItemMutation, workItemId, projectId, invalidateWorkspaceData]);

  if (!workItem) return null;

  return (
    <DetailModal
      open={open}
      onOpenChange={onOpenChange}
      item={workItem as unknown as Partial<Item>}
      columns={columns}
      members={members}
      project={pDetails?.project as Project | undefined || (pDetails as unknown as Project) || undefined}
      onSave={handleSave}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
    />
  );
}

export default ItemDetailModal;
