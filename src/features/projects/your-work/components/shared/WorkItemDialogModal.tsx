'use client';

import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  WorkItemDialog,
  useProjectWorkItems,
  useUpdateWorkItem,
  useDeleteWorkItem,
  useDuplicateWorkItem,
  DEFAULT_WORK_ITEM_STATES,
  type WorkItemMutationInput,
} from '@/features/projects/project-id/work-items';
import { useProjectDetails } from '@/features/projects/shell/hooks/use-project';

export interface WorkItemDialogModalProps {
  workItemId: string;
  projectId: string;
  initialWorkItem?: any;
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

  const fetchedWorkItem = (projectWorkItems?.workItems || projectWorkItems?.items || []).find((t: any) => t.id === workItemId);
  const workItem = fetchedWorkItem || initialWorkItem;
  const columns =
    projectWorkItems?.columns && projectWorkItems.columns.length > 0
      ? projectWorkItems.columns
      : (projectDetails as any)?.workItemColumns && Array.isArray((projectDetails as any).workItemColumns)
        ? (projectDetails as any).workItemColumns
        : DEFAULT_WORK_ITEM_STATES;
  const pDetails = projectDetails as any;
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
      card={workItem}
      columns={columns}
      members={members}
      project={pDetails?.project || pDetails || (workItem?.project ? { id: projectId, ...workItem.project } : { id: projectId })}
      onSave={handleSave}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
    />
  );
}

export default WorkItemDialogModal;
