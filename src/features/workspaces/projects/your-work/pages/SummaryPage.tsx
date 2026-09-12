'use client';

import React from 'react';
import { Skeleton } from "@/shared/components/ui";
import { useSummaryWork } from '../hooks/use-summary-work';
import { useTaskModal } from '../hooks/use-task-modal';
import { OverviewCards } from '../components/summary/OverviewCards';
import { WorkloadCards } from '../components/summary/WorkloadCards';
import { PriorityBreakdown } from '../components/summary/PriorityBreakdown';
import { StateBreakdown } from '../components/summary/StateBreakdown';
import { RecentActivityFeed } from '../components/summary/RecentActivityFeed';
import { TaskModalHost } from '../components/shared/TaskModalHost';

export function SummaryPage() {
  const { state } = useSummaryWork();
  const {
    tasks,
    activities,
    categorizedTasks,
    taskProjectMap,
    isLoading,
  } = state;

  const { selectedTask, handleOpenTask, handleCloseTask } = useTaskModal(tasks);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-6">
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
        {/* Workload: 5 State Groups */}
        <div>
          <Skeleton className="h-4 w-20 mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Skeleton className="h-18 rounded-md" />
            <Skeleton className="h-18 rounded-md" />
            <Skeleton className="h-18 rounded-md" />
            <Skeleton className="h-18 rounded-md" />
            <Skeleton className="h-18 rounded-md" />
          </div>
        </div>
        {/* Distribution cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44 rounded-md" />
          <Skeleton className="h-44 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* 1. Overview: 3 Cards */}
      <OverviewCards
        createdCount={categorizedTasks.created.length}
        assignedCount={categorizedTasks.assigned.length}
        subscribedCount={categorizedTasks.subscribed.length}
      />

      {/* 2. Workload: 5 Status Boxes */}
      <WorkloadCards
        statusBreakdown={categorizedTasks.statusBreakdown}
      />

      {/* 3. Breakdown Graphs: Priority on Left, State on Right */}
      <div className="grid gap-4 md:grid-cols-2">
        <PriorityBreakdown
          priorityBreakdown={categorizedTasks.priorityBreakdown}
          totalAssigned={categorizedTasks.assigned.length}
        />
        <StateBreakdown
          statusBreakdown={categorizedTasks.statusBreakdown}
          totalAssigned={categorizedTasks.assigned.length}
        />
      </div>

      {/* 4. Recent activity */}
      <RecentActivityFeed
        activities={activities}
        onTaskClick={handleOpenTask}
        taskProjectMap={taskProjectMap}
      />

      {/* Task detail dialog */}
      <TaskModalHost selectedTask={selectedTask} onClose={handleCloseTask} />
    </div>
  );
}

export default SummaryPage;
