'use client';

import React from 'react';
import { UserCheck } from 'lucide-react';
import { YourWorkItemList } from '../shared/YourWorkItemList';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkItem } from '../../schemas/your-work.schema';

export interface AssignedWorkItemListProps {
  workItems?: YourWorkItem[] | any[];
  onWorkItemClick?: (workItemId: string) => void;
  workItemProjectMap?: ProjectMap;
  className?: string;
}

export function AssignedWorkItemList({
  workItems = [],
  onWorkItemClick,
  workItemProjectMap = {},
  className,
}: AssignedWorkItemListProps) {
  return (
    <YourWorkItemList
      title="Work items assigned to you"
      emptyMessage="No work items assigned to you."
      emptyIcon={UserCheck}
      workItems={workItems}
      onWorkItemClick={onWorkItemClick}
      workItemProjectMap={workItemProjectMap}
      className={className}
    />
  );
}

export default AssignedWorkItemList;
