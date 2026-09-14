'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { YourWorkItemList } from '../shared/YourWorkItemList';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkItem } from '../../schemas/your-work.schema';

export interface SubscribedWorkItemListProps {
  workItems?: YourWorkItem[] | any[];
  onWorkItemClick?: (workItemId: string) => void;
  workItemProjectMap?: ProjectMap;
  className?: string;
}

export function SubscribedWorkItemList({
  workItems = [],
  onWorkItemClick,
  workItemProjectMap = {},
  className,
}: SubscribedWorkItemListProps) {
  return (
    <YourWorkItemList
      title="Work items subscribed & watching"
      emptyMessage="No work items subscribed."
      emptyIcon={Inbox}
      workItems={workItems}
      onWorkItemClick={onWorkItemClick}
      workItemProjectMap={workItemProjectMap}
      className={className}
    />
  );
}

export default SubscribedWorkItemList;
