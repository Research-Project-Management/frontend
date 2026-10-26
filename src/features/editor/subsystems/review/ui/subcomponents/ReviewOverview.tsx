'use client';

/**
 * ReviewOverview.tsx
 *
 * Cohesive multi-file overview views for the Review sidebar:
 * - OverviewView: Project-wide comments & suggestions aggregated across files
 * - OverviewFileGroup: Collapsible per-file group of review items
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { usePageComments } from '@/features/editor/subsystems/review/ui/hooks/useComment';
import {
  usePageSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
} from '@/features/editor/subsystems/review/ui/hooks/useSuggestion';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import { CommentCard } from './ReviewComments';
import { SuggestionCard } from './ReviewSuggestions';
import { EmptyReviewState } from './ReviewNav';

// ── Overview File Group ─────────────────────────────────────────────────────

export interface OverviewFileGroupProps {
  file: { id: string; title: string };
  currentUserId?: string;
  projectId?: string;
  showResolved: boolean;
  onNavigateToFile: (fileId: string, line?: number) => void;
  members: MentionMember[];
  membersMap?: Map<string, MentionMember>;
  onCountReport?: (fileId: string, visibleCount: number, resolvedCount: number) => void;
}

export const OverviewFileGroup = React.memo(function OverviewFileGroup({
  file,
  currentUserId,
  projectId,
  showResolved,
  onNavigateToFile,
  members,
  membersMap,
  onCountReport,
}: OverviewFileGroupProps) {
  const { data: comments = [], isLoading: isCommentsLoading } = usePageComments(file.id);
  const { data: suggestions = [], isLoading: isSuggestionsLoading } = usePageSuggestions(file.id);
  const acceptMutation = useAcceptSuggestion();
  const rejectMutation = useRejectSuggestion();

  const openComments = useMemo(() => comments.filter((c: PageComment) => c.status === 'open'), [comments]);
  const resolvedComments = useMemo(() => comments.filter((c: PageComment) => c.status === 'resolved'), [comments]);
  const pendingSuggestions = useMemo(() => suggestions.filter((s: PageSuggestion) => s.status === 'pending'), [suggestions]);
  const resolvedSuggestions = useMemo(
    () => suggestions.filter((s: PageSuggestion) => s.status === 'accepted' || s.status === 'rejected'),
    [suggestions],
  );

  const fileResolvedCount = resolvedComments.length + resolvedSuggestions.length;
  const visibleComments = showResolved ? comments : openComments;
  const visibleSuggestions = showResolved ? suggestions : pendingSuggestions;
  const totalVisibleCount = visibleComments.length + visibleSuggestions.length;

  useEffect(() => {
    onCountReport?.(file.id, totalVisibleCount, fileResolvedCount);
  }, [file.id, totalVisibleCount, fileResolvedCount, onCountReport]);

  if (isCommentsLoading || isSuggestionsLoading) {
    return (
      <div className="border-b border-border px-3.5 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{file.title}</span>
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  if (totalVisibleCount === 0) {
    return null;
  }

  return (
    <div className="border-b border-border last:border-b-0">
      {/* File Header */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Jump to file ${file.title}`}
        onClick={() => onNavigateToFile(file.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigateToFile(file.id);
          }
        }}
        className="flex items-center justify-between px-3.5 py-2 bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors border-b border-border outline-none focus-visible:ring-1 focus-visible:ring-border"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-mono font-semibold text-foreground truncate">{file.title}</span>
        </div>
        <span className="text-11 font-mono font-semibold px-2 py-0.5 rounded-full bg-background text-foreground border border-border">
          {totalVisibleCount}
        </span>
      </div>

      {/* Items under this file */}
      <div className="flex flex-col p-2.5">
        {visibleSuggestions.map((s: PageSuggestion) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            pageId={file.id}
            onNavigate={(line) => onNavigateToFile(file.id, line)}
            onAccept={(suggId) => {
              acceptMutation.mutate({ pageId: file.id, suggestionId: suggId });
            }}
            onReject={(suggId) => {
              rejectMutation.mutate({ pageId: file.id, suggestionId: suggId });
            }}
            isAccepting={acceptMutation.isPending}
            isRejecting={rejectMutation.isPending}
            membersMap={membersMap}
          />
        ))}

        {visibleComments.map((comment: PageComment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            pageId={file.id}
            projectId={projectId}
            currentUserId={currentUserId}
            onNavigate={(line) => onNavigateToFile(file.id, line)}
            members={members}
            membersMap={membersMap}
          />
        ))}
      </div>
    </div>
  );
});

// ── Overview View ───────────────────────────────────────────────────────────

export interface OverviewViewProps {
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
