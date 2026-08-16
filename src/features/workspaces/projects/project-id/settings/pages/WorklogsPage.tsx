'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/shared/components/ui';
import { useWorklogs } from '../hooks/use-worklog';


import { WorklogEmpty } from '../components/worklog/Empty';
import { WorklogUsers } from '../components/worklog/Users';
import { WorklogDateRange } from '../components/worklog/DateRange';
import { WorklogDownload } from '../components/worklog/Download';
import { WorklogTable } from '../components/worklog/Table';

export default function WorklogsPage() {
  const { projectId } = useParams() as { projectId: string };
  const {
    logs,
    members,
    isLoading,
    // Filter controls
    userIds,
    toggleUserFilter,
    clearUserFilter,
    startDate,
    endDate,
    setDateRange,
    clearDateRange,
    // Export actions
    downloadCsv,
    downloadExcel,
    downloadJson,
    deleteLog,
  } = useWorklogs(projectId);

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Worklogs
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Review and export time logged on this project's work items.
        </p>
      </div>

      {/* ── Filters & Action Bar ── */}
      <div className="flex items-center justify-between gap-4 pt-1 flex-wrap sm:flex-nowrap">
        {/* Left Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <WorklogUsers
            members={members}
            selectedUserIds={userIds}
            onToggle={toggleUserFilter}
            onClear={clearUserFilter}
          />

          <WorklogDateRange
            startDate={startDate}
            endDate={endDate}
            onApply={setDateRange}
            onClear={clearDateRange}
          />
        </div>

        {/* Right Action: Download Split Button */}
        <WorklogDownload
          onDownloadCsv={downloadCsv}
          onDownloadExcel={downloadExcel}
          disabled={logs.length === 0}
        />
      </div>

      {/* ── Content: Empty State or Table ── */}
      <div className="pt-2">
        {logs.length === 0 ? (
          <WorklogEmpty />
        ) : (
          <WorklogTable logs={logs} onDelete={deleteLog} />
        )}
      </div>
    </div>
  );
}
