'use client';

import React from 'react';
import { Skeleton } from "@/shared/components/ui";
import { useSummaryWork } from '../hooks/use-summary-work';
import { useWorkItemModal } from '../hooks/use-work-item-modal';
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
