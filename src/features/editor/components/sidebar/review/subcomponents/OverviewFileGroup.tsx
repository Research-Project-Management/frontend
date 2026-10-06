'use client';

import React, { useMemo, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { usePageComments } from '@/features/editor/hooks/use-comment';
import { usePageSuggestions, useAcceptSuggestion, useRejectSuggestion } from '@/features/editor/hooks/use-suggestion';
import type { MentionMember } from '@/features/editor/utils/mention.util';
import { CommentCard } from './CommentCard';
import { SuggestionCard } from './SuggestionCard';

interface OverviewFileGroupProps {
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

  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);
  const resolvedComments = useMemo(() => comments.filter((c) => c.status === 'resolved'), [comments]);
  const pendingSuggestions = useMemo(() => suggestions.filter((s) => s.status === 'pending'), [suggestions]);
  const resolvedSuggestions = useMemo(
    () => suggestions.filter((s) => s.status === 'accepted' || s.status === 'rejected'),
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
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
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
        onClick={() => onNavigateToFile(file.id)}
        className="flex items-center justify-between px-3.5 py-2 bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors border-b border-border"
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
        {visibleSuggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            pageId={file.id}
            onNavigate={(line) => onNavigateToFile(file.id, line)}
            onAccept={(suggId) => acceptMutation.mutate({ pageId: file.id, suggestionId: suggId })}
            onReject={(suggId) => rejectMutation.mutate({ pageId: file.id, suggestionId: suggId })}
            isAccepting={acceptMutation.isPending}
            isRejecting={rejectMutation.isPending}
            membersMap={membersMap}
          />
        ))}

        {visibleComments.map((comment) => (
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

export default OverviewFileGroup;
