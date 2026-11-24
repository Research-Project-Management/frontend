'use client';

/**
 * Overview.tsx
 *
 * Cohesive multi-file overview views for the Review sidebar:
 * - OverviewView: Project-wide comments & suggestions aggregated across files
 * - OverviewFileGroup: Collapsible per-file group of review items
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { usePageStore } from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { usePageComments } from '../hooks/useComments';
import {
  usePageSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
} from '../hooks/useSuggestions';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import { CommentCard } from './Comments';
import { SuggestionCard } from './Suggestions';
import { EmptyReviewState } from './Nav';

// ── Overview File Group ─────────────────────────────────────────────────────

interface OverviewFileGroupProps {
  file: { id: string; title: string };
  currentUserId?: string;
  projectId?: string;
  showResolved: boolean;
  onNavigateToFile: (fileId: string, line?: number) => void;
  members: MentionMember[];
  membersMap?: Map<string, MentionMember>;
  onCountReport?: (fileId: string, visibleCount: number, resolvedCount: number) => void;
  preloadedComments?: PageComment[];
  preloadedSuggestions?: PageSuggestion[];
  isPreloadedLoading?: boolean;
}

const OverviewFileGroup = React.memo(function OverviewFileGroup({
  file,
  currentUserId,
  projectId,
  showResolved,
  onNavigateToFile,
  members,
  membersMap,
  onCountReport,
  preloadedComments,
  preloadedSuggestions,
  isPreloadedLoading,
}: OverviewFileGroupProps) {
  const hasPreloaded = Boolean(
    isPreloadedLoading || (preloadedComments !== undefined && preloadedSuggestions !== undefined),
  );
  const { data: fetchedComments = [], isLoading: isCommentsLoading } = usePageComments(hasPreloaded ? '' : file.id);
  const { data: fetchedSuggestions = [], isLoading: isSuggestionsLoading } = usePageSuggestions(hasPreloaded ? '' : file.id);
  const comments = preloadedComments ?? fetchedComments;
  const suggestions = preloadedSuggestions ?? fetchedSuggestions;
  const isLoading = hasPreloaded ? Boolean(isPreloadedLoading) : (isCommentsLoading || isSuggestionsLoading);
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

  if (isLoading) {
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
    <section className="py-1">
      {/* File Header */}
      <button
        type="button"
        aria-label={`Jump to file ${file.title}`}
        onClick={() => onNavigateToFile(file.id)}
        className="group sticky top-0 z-10 w-full flex items-center gap-1.5 px-3 py-1.5 bg-background/95 backdrop-blur-xs hover:bg-muted/50 cursor-pointer transition-colors text-left outline-none focus-visible:ring-1 focus-visible:ring-border min-w-0"
      >
        <FileText className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" strokeWidth={1.5} />
        <span className="text-12 font-mono font-medium text-muted-foreground group-hover:text-foreground truncate transition-colors min-w-0 flex-1">
          {file.title}
        </span>
      </button>

      {/* Items under this file */}
      <div className="flex flex-col gap-2 px-3 pt-1 pb-2.5">
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
    </section>
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
  const rootPageId = usePageStore((s) => s.rootPageId);
  const overviewTargetId = rootPageId || projectId || '';
  const isPageScope = Boolean(rootPageId);

  const { data: overviewData, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['project-review-overview', overviewTargetId, isPageScope ? 'page' : 'project'],
    queryFn: () =>
      pagesService.review.getProjectOverview(overviewTargetId, {
        isPageScope,
      }),
    enabled: Boolean(overviewTargetId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const overviewByDocId = useMemo(() => {
    if (!overviewData?.files) return null;
    const map = new Map<string, { comments: PageComment[]; suggestions: PageSuggestion[] }>();
    for (const f of overviewData.files) {
      map.set(f.docId, {
        comments: (f.comments ?? []) as PageComment[],
        suggestions: (f.suggestions ?? []) as PageSuggestion[],
      });
    }
    return map;
  }, [overviewData]);

  const handleCountReport = useCallback((fileId: string, visible: number, resolved: number) => {
    setFileCounts((prev) => {
      if (prev[fileId]?.visible === visible && prev[fileId]?.resolved === resolved) {
        return prev;
      }
      return { ...prev, [fileId]: { visible, resolved } };
    });
  }, []);

  const totalResolved =
    overviewData?.totals?.totalResolvedCount !== undefined
      ? overviewData.totals.totalResolvedCount
      : Object.values(fileCounts).reduce((acc, curr) => acc + curr.resolved, 0);

  useEffect(() => {
    onOverviewResolvedCount?.(totalResolved);
  }, [totalResolved, onOverviewResolvedCount]);

  if (files.length === 0) {
    return <EmptyReviewState />;
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 sidebar-scrollbar divide-y divide-border/60">
      {files.map((file) => {
        const preloaded = overviewByDocId?.get(file.id);
        return (
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
            preloadedComments={overviewByDocId ? (preloaded?.comments ?? []) : undefined}
            preloadedSuggestions={overviewByDocId ? (preloaded?.suggestions ?? []) : undefined}
            isPreloadedLoading={Boolean(projectId) && isOverviewLoading}
          />
        );
      })}
    </div>
  );
}
