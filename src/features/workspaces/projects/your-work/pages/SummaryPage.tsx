'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui';
import { useSummaryWork } from '../hooks/use-summary-work';
import { useTaskModal } from '../hooks/use-task-modal';
import { OverviewCards } from '../components/summary/OverviewCards';
import { WorkloadCards } from '../components/summary/WorkloadCards';
import { PriorityBreakdown } from '../components/summary/PriorityBreakdown';
import { StateBreakdown } from '../components/summary/StateBreakdown';
import { RecentActivityFeed } from '../components/summary/RecentActivityFeed';
import { TaskDialogModal } from '../components/shared/TaskDialogModal';

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
      <div className="space-y-8 max-w-7xl mx-auto p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        {/* Workload: 6 Status Boxes */}
        <div>
          <Skeleton className="h-4 w-20 mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* 1. Overview: 3 Cards */}
      <OverviewCards
        assignedCount={categorizedTasks.assigned.length}
        createdCount={categorizedTasks.created.length}
        subscribedCount={categorizedTasks.subscribed.length}
      />

      {/* 2. Workload: 6 Status Boxes */}
      <WorkloadCards
        statusBreakdown={categorizedTasks.statusBreakdown}
      />

      {/* 3. Breakdown Graphs: State & Priority */}
      <div className="grid gap-6 md:grid-cols-2">
        <StateBreakdown
          statusBreakdown={categorizedTasks.statusBreakdown}
          totalAssigned={categorizedTasks.assigned.length}
        />
        <PriorityBreakdown
          priorityBreakdown={categorizedTasks.priorityBreakdown}
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
      {selectedTask && (
        <TaskDialogModal
          taskId={selectedTask.taskId}
          projectId={selectedTask.projectId}
          open={!!selectedTask}
          onOpenChange={(open) => !open && handleCloseTask()}
        />
      )}
    </div>
  );
}

export default SummaryPage;
