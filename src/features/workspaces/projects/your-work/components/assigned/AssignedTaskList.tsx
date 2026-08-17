'use client';

import React from 'react';
import { UserCheck } from 'lucide-react';
import { YourWorkTaskList } from '../shared/YourWorkTaskList';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkTask } from '../../schemas/your-work.schema';

export interface AssignedTaskListProps {
  tasks: YourWorkTask[] | any[];
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: ProjectMap;
  className?: string;
}

export function AssignedTaskList({
  tasks,
  onTaskClick,
  taskProjectMap = {},
  className,
}: AssignedTaskListProps) {
  return (
    <YourWorkTaskList
      title="Work items assigned to you"
      emptyMessage="No work items assigned to you."
      emptyIcon={UserCheck}
      tasks={tasks}
      onTaskClick={onTaskClick}
      taskProjectMap={taskProjectMap}
      className={className}
    />
  );
}

export default AssignedTaskList;
