'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { YourWorkTaskList } from '../shared/YourWorkTaskList';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkTask } from '../../schemas/your-work.schema';

export interface SubscribedTaskListProps {
  tasks: YourWorkTask[] | any[];
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: ProjectMap;
  className?: string;
}

export function SubscribedTaskList({
  tasks,
  onTaskClick,
  taskProjectMap = {},
  className,
}: SubscribedTaskListProps) {
  return (
    <YourWorkTaskList
      title="Work items subscribed & watching"
      emptyMessage="No work items subscribed."
      emptyIcon={Inbox}
      tasks={tasks}
      onTaskClick={onTaskClick}
      taskProjectMap={taskProjectMap}
      className={className}
    />
  );
}

export default SubscribedTaskList;
