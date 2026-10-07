'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { MentionMember } from '@/features/editor/utils/mention.util';
import { OverviewFileGroup } from './OverviewFileGroup';
import { EmptyReviewState } from './EmptyReviewState';

interface OverviewViewProps {
  files: Array<{ id: string; title: string }>;
  currentUserId?: string;
  projectId?: string;
  showResolved: boolean;
  onNavigateToFile: (fileId: string, line?: number) => void;
  members: MentionMember[];
  membersMap?: Map<string, MentionMember>;
  onOverviewResolvedCount?: (count: number) => void;
}

export function OverviewView({
  files,
  currentUserId,
  projectId,
  showResolved,
  onNavigateToFile,
  members,
  membersMap,
  onOverviewResolvedCount,
}: OverviewViewProps) {
  const [fileCounts, setFileCounts] = useState<Record<string, { visible: number; resolved: number }>>({});

  const handleCountReport = useCallback((fileId: string, visible: number, resolved: number) => {
    setFileCounts((prev) => {
      if (prev[fileId]?.visible === visible && prev[fileId]?.resolved === resolved) {
        return prev;
      }
      return { ...prev, [fileId]: { visible, resolved } };
    });
  }, []);

  const totalVisible = Object.values(fileCounts).reduce((acc, curr) => acc + curr.visible, 0);
  const totalResolved = Object.values(fileCounts).reduce((acc, curr) => acc + curr.resolved, 0);

  useEffect(() => {
    onOverviewResolvedCount?.(totalResolved);
  }, [totalResolved, onOverviewResolvedCount]);

  if (files.length === 0) {
    return <EmptyReviewState />;
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {files.map((file) => (
        <OverviewFileGroup
          key={file.id}
          file={file}
          currentUserId={currentUserId}
          projectId={projectId}
          showResolved={showResolved}
          onNavigateToFile={onNavigateToFile}
          members={members}
          membersMap={membersMap}
          onCountReport={handleCountReport}
        />
      ))}
    </div>
  );
}

export default OverviewView;
