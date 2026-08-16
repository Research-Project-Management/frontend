'use client';

import React, { useState } from 'react';
import { Skeleton } from '@/shared/components/ui';

import { useSummaryWork } from '../hooks/use-summary-work';
import { OverviewCards } from '../components/summary/OverviewCards';
import { WorkloadCards } from '../components/summary/WorkloadCards';
import { PriorityBreakdown } from '../components/summary/PriorityBreakdown';
import { StateBreakdown } from '../components/summary/StateBreakdown';
import { RecentActivityFeed } from '../components/summary/RecentActivityFeed';
import { TaskDialogModal } from '../components/shared/TaskDialogModal';

export function SummaryPage() {
  const {
    tasks,
    activities,
    categorizedTasks,
    taskProjectMap,
    isLoading,
    isLoadingYourWork,
  } = useSummaryWork();

  const [selectedTask, setSelectedTask] = useState<{ taskId: string; projectId: string } | null>(null);

  const handleOpenTask = (taskId: string) => {
    const task = tasks.find((t) => (t.id || t._id) === taskId);
    const pId = task
      ? typeof task.projectId === 'object'
        ? task.projectId?.id || task.projectId?._id
        : task.projectId || task.project?.id || task.project?._id
      : null;
    if (task && pId) {
      setSelectedTask({ taskId, projectId: pId });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-5 gap-3.5">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* 1. Overview: 3 Cards */}
      <OverviewCards
        createdCount={categorizedTasks.created.length}
        assignedCount={categorizedTasks.assigned.length}
        subscribedCount={categorizedTasks.subscribed.length}
      />

      {/* 2. Workload: 5 Status Cards */}
      <WorkloadCards statusBreakdown={categorizedTasks.statusBreakdown} />

      {/* 3. Two columns: Work items by Priority & Work items by state */}
      <div className="grid gap-6 md:grid-cols-2">
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
        isLoading={isLoadingYourWork}
        limit={5}
        onTaskClick={handleOpenTask}
        taskProjectMap={taskProjectMap}
      />

      {selectedTask && (
        <TaskDialogModal
          taskId={selectedTask.taskId}
          projectId={selectedTask.projectId}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </div>
  );
}

export default SummaryPage;
