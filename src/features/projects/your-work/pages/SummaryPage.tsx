'use client';

import React from 'react';
import { Skeleton } from "@/shared/components/ui";
import { useSummaryWork } from '../hooks/use-summary-work';
import { useWorkItemModal } from '../hooks/use-work-item-modal';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { YourWorkEmptyState } from '../components/shared/YourWorkEmptyState';
import { OverviewCards } from '../components/summary/OverviewCards';
import { WorkloadCards } from '../components/summary/WorkloadCards';
import { PriorityBreakdown } from '../components/summary/PriorityBreakdown';
import { StateBreakdown } from '../components/summary/StateBreakdown';
import { RecentActivityFeed } from '../components/summary/RecentActivityFeed';
import { WorkItemModalHost } from '../components/shared/WorkItemModalHost';

export function SummaryPage() {
  const { state } = useSummaryWork();
  const {
    workItems,
    activities,
    categorizedWorkItems,
    workItemProjectMap,
    isLoading,
    isError,
    error,
    isEmpty,
  } = state;

  const { selectedWorkItem, handleOpenWorkItem, handleCloseWorkItem } = useWorkItemModal(workItems);

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

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <PlaneErrorState
          title="Unable to load summary workload"
          description="An issue occurred while loading your work summary. Other features remain unaffected."
          error={error || new Error('Internal Server Error')}
        />
      </div>
    );
  }

  if (isEmpty || (workItems.length === 0 && activities.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <YourWorkEmptyState variant="summary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* 1. Overview: 3 Cards */}
      <OverviewCards
        createdCount={categorizedWorkItems.created.length}
        assignedCount={categorizedWorkItems.assigned.length}
        subscribedCount={categorizedWorkItems.subscribed.length}
      />

      {/* 2. Workload: 5 Status Boxes */}
      <WorkloadCards
        statusBreakdown={categorizedWorkItems.statusBreakdown}
      />

      {/* 3. Breakdown Graphs: Priority on Left, State on Right */}
      <div className="grid gap-4 md:grid-cols-2">
        <PriorityBreakdown
          priorityBreakdown={categorizedWorkItems.priorityBreakdown}
          totalAssigned={categorizedWorkItems.assigned.length}
        />
        <StateBreakdown
          statusBreakdown={categorizedWorkItems.statusBreakdown}
          totalAssigned={categorizedWorkItems.assigned.length}
        />
      </div>

      {/* 4. Recent activity */}
      <RecentActivityFeed
        activities={activities}
        onWorkItemClick={handleOpenWorkItem}
        workItemProjectMap={workItemProjectMap}
      />

      {/* Work item detail dialog */}
      <WorkItemModalHost selectedWorkItem={selectedWorkItem} onClose={handleCloseWorkItem} />
    </div>
  );
}

export default SummaryPage;
