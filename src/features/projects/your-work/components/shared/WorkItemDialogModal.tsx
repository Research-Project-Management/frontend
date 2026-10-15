'use client';

import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DetailModal as WorkItemDialog } from '@/features/projects/project-id/work-items/components/modals/DetailModal';
import {
  useProjectWorkItems,
  useUpdateWorkItem,
  useDeleteWorkItem,
  useDuplicateWorkItem,
} from '@/features/projects/project-id/work-items/hooks/use-work-item';
import {
  DEFAULT_WORK_ITEM_STATES,
  type WorkItemMutationInput,
  type Item,
  type Project,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import { normalizeStates } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import type { YourWorkItem } from '../../schemas/your-work.schema';
import { useProjectDetails } from '@/features/projects/shell/hooks/use-project';

export interface WorkItemDialogModalProps {
  workItemId: string;
  projectId: string;
  initialWorkItem?: Item | YourWorkItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkItemDialogModal({
  workItemId,
  projectId,
  initialWorkItem,
  open,
  onOpenChange,
}: WorkItemDialogModalProps) {
  const queryClient = useQueryClient();

  const { data: projectWorkItems } = useProjectWorkItems(projectId);
  const { data: projectDetails } = useProjectDetails(projectId);

  const updateWorkItemMutation = useUpdateWorkItem();
  const deleteWorkItemMutation = useDeleteWorkItem();
  const duplicateWorkItemMutation = useDuplicateWorkItem();

  const fetchedWorkItem = (projectWorkItems?.workItems || projectWorkItems?.items || []).find((t: { id?: string }) => t.id === workItemId);
  const workItem = fetchedWorkItem || initialWorkItem;
  const pDetails = projectDetails as (typeof projectDetails & { workItemColumns?: Array<{ id: string; name: string; [key: string]: unknown }>; members?: Array<{ id?: string; userId?: string; [key: string]: unknown }> }) | undefined;
  const rawColumns = projectWorkItems?.columns && projectWorkItems.columns.length > 0
    ? projectWorkItems.columns
    : Array.isArray(pDetails?.workItemColumns)
      ? pDetails.workItemColumns
      : DEFAULT_WORK_ITEM_STATES;
  const columns = normalizeStates(rawColumns);
  const members = pDetails?.members || [];

  const invalidateWorkspaceData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['your-work'] });
    queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-work-items', projectId] });
  }, [queryClient, projectId]);

  const handleSave = useCallback((data: WorkItemMutationInput) => {
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
    <WorkItemDialog
      open={open}
      onOpenChange={onOpenChange}
      card={workItem as unknown as Partial<Item>}
      columns={columns}
      members={members}
      project={pDetails?.project as Project | undefined || (pDetails as unknown as Project) || undefined}
      onSave={handleSave}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
    />
  );
}

export default WorkItemDialogModal;
