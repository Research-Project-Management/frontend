'use client';

import { useState, useCallback } from 'react';
import { getWorkItemProjectId } from '../utils/your-work.util';

export interface SelectedWorkItemState {
  workItemId: string;
  projectId: string;
  workItem?: any;
}

export function useWorkItemModal(workItems: any[] = []) {
  const [selectedWorkItem, setSelectedWorkItem] = useState<SelectedWorkItemState | null>(null);

  const handleOpenWorkItem = useCallback(
    (workItemId: string, fallbackProjectId?: string) => {
      const workItem = workItems.find((t) => t.id === workItemId);
      const projectId = workItem ? getWorkItemProjectId(workItem) : fallbackProjectId || null;

      if (projectId) {
        setSelectedWorkItem({
          workItemId,
          projectId,
          workItem,
        });
      }
    },
    [workItems],
  );

  const handleCloseWorkItem = useCallback(() => {
    setSelectedWorkItem(null);
  }, []);

  return {
    selectedWorkItem,
    setSelectedWorkItem,
    handleOpenWorkItem,
    handleCloseWorkItem,
    isOpen: !!selectedWorkItem,
  };
}


export default useWorkItemModal;
