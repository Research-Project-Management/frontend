'use client';

import React from 'react';
import { WorkItemDialogModal } from './WorkItemDialogModal';

export interface WorkItemModalHostProps {
  selectedWorkItem?: { workItemId?: string; projectId: string; workItem?: any } | null;
  onClose: () => void;
}

export function WorkItemModalHost({ selectedWorkItem, onClose }: WorkItemModalHostProps) {
  if (!selectedWorkItem) return null;

  const targetId = selectedWorkItem.workItemId || '';

  return (
    <WorkItemDialogModal
      workItemId={targetId}
      projectId={selectedWorkItem.projectId}
      initialWorkItem={selectedWorkItem.workItem}
      open={Boolean(selectedWorkItem)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
  );
}

export default WorkItemModalHost;
