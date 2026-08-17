'use client';

import React from 'react';
import { PlusSquare } from 'lucide-react';
import { YourWorkTaskList } from '../shared/YourWorkTaskList';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkTask } from '../../schemas/your-work.schema';

export interface CreatedTaskListProps {
  tasks: YourWorkTask[] | any[];
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: ProjectMap;
  className?: string;
}

export function CreatedTaskList({
  tasks,
  onTaskClick,
  taskProjectMap = {},
  className,
}: CreatedTaskListProps) {
  return (
    <YourWorkTaskList
      title="Work items created by you"
      emptyMessage="No work items created by you."
      emptyIcon={PlusSquare}
      tasks={tasks}
      onTaskClick={onTaskClick}
      taskProjectMap={taskProjectMap}
      className={className}
    />
  );
}

export default CreatedTaskList;
