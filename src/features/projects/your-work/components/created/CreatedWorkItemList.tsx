'use client';

import React from 'react';
import { PlusSquare } from 'lucide-react';
import { YourWorkItemList } from '../shared/YourWorkItemList';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkItem } from '../../schemas/your-work.schema';

export interface CreatedWorkItemListProps {
  workItems?: YourWorkItem[] | any[];
  onWorkItemClick?: (workItemId: string) => void;
  workItemProjectMap?: ProjectMap;
  className?: string;
}

export function CreatedWorkItemList({
  workItems = [],
  onWorkItemClick,
  workItemProjectMap = {},
  className,
}: CreatedWorkItemListProps) {
  return (
    <YourWorkItemList
      title="Work items created by you"
      emptyMessage="No work items created by you."
      emptyIcon={PlusSquare}
      workItems={workItems}
      onWorkItemClick={onWorkItemClick}
      workItemProjectMap={workItemProjectMap}
      className={className}
    />
  );
}

export default CreatedWorkItemList;
