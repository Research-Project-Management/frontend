'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { useReviewState } from './hooks/useReviewState';
import {
  useDeleteComment,
  useInfiniteResolvedComments,
  useResolveComment,
} from './hooks/useComments';
import {
  ReviewHeader,
  ReviewBottomNav,
  EmptyReviewState,
} from './subcomponents/Nav';
import {
  CommentCard,
  NewCommentForm,
} from './subcomponents/Comments';
import {
  SuggestionCard,
  SuggestionBulkActions,
} from './subcomponents/Suggestions';
import { OverviewView } from './subcomponents/Overview';
import { reviewCoordinator } from '@/features/editor/subsystems/review/coordinator/review.coordinator';

export const ReviewTab = React.memo(function ReviewTab({ onClose }: { onClose?: () => void }) {
  const {
    pageId,
    projectId,
    currentFileName,
    user,
    scope,
    setScope,
    showResolved,
    setShowResolved,
    handleToggleResolved,
    activeResolvedCount,
    currentFileResolvedCount,
    highlightId,
    showAddForm,
    setShowAddForm,
    pendingQuote,
    commentLine,
    commentLineEnd,
    mentionMembers,
    membersMap,
    comments,
    visibleComments,
    visibleSuggestions,
    pendingSuggestions,
    totalVisibleItems,
    totalAllItems,
    allProjectFiles,
    isCommentsLoading,
    isSuggestionsLoading,
    isCommentsError,
    isSuggestionsError,
    commentsError,
    suggestionsError,
    acceptMutation,
    rejectMutation,
    acceptAllMutation,
    rejectAllMutation,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleNavigateToLine,
    handleNavigateToFileAndLine,
    setOverviewResolvedCount,
  } = useReviewState();


  const resolveCommentMutation = useResolveComment();
  const deleteCommentMutation = useDeleteComment();
  const [resolvedPopoverOpen, setResolvedPopoverOpen] = React.useState(false);
  const resolvedInfiniteQuery = useInfiniteResolvedComments(
    pageId ?? null,
    resolvedPopoverOpen,
    20,
  );
  const resolvedComments = React.useMemo(() => {
    const pages = resolvedInfiniteQuery.data?.pages;
    if (pages && pages.length > 0) {
      return pages.flatMap((p) => p.comments);
    }
    return comments.filter((c) => c.status === 'resolved');
  }, [resolvedInfiniteQuery.data?.pages, comments]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-foreground select-none">
      {/* ── Top Header ── */}
      <ReviewHeader
        showResolved={showResolved}
        onToggleResolved={handleToggleResolved}
        activeResolvedCount={activeResolvedCount}
        resolvedComments={resolvedComments}
        hasMoreResolved={Boolean(resolvedInfiniteQuery.hasNextPage)}
        isLoadingMoreResolved={resolvedInfiniteQuery.isFetchingNextPage}
        onLoadMoreResolved={() => {
          void resolvedInfiniteQuery.fetchNextPage();
        }}
        onResolvedPopoverOpenChange={setResolvedPopoverOpen}
        currentFileName={currentFileName}
        onReopenComment={(commentId) => {
          if (pageId) {
            resolveCommentMutation.mutate({
              pageId,
              commentId,
              resolved: false,
              projectId,
            });
          }
        }}
        onDeleteComment={(commentId) => {
          if (pageId) {
            deleteCommentMutation.mutate({ pageId, commentId, projectId });
          }
        }}
        onClose={onClose}
      />

      {/* ── Content View Area ── */}
      {isCommentsError || isSuggestionsError ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
          <PlaneErrorState
            isCompact
            title="Unable to load reviews"
            description="An issue occurred while loading comments and suggestions."
            error={commentsError || suggestionsError || new Error('Review data load failed')}
          />
        </div>
      ) : scope === 'current' ? (
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {/* Bulk Actions for Pending Suggestions */}
          <SuggestionBulkActions
            count={pendingSuggestions.length}
            onRejectAll={() => {
              if (pageId) {
                const hasServerPending = pendingSuggestions.some((s) => !s.id.startsWith('sug-local-'));
                if (hasServerPending) {
                  rejectAllMutation.mutate({ pageId });
                } else {
                  void reviewCoordinator.rejectAll(pageId);
                }
              }
            }}
            onAcceptAll={() => {
              if (pageId) {
                const hasServerPending = pendingSuggestions.some((s) => !s.id.startsWith('sug-local-'));
                if (hasServerPending) {
                  acceptAllMutation.mutate({ pageId });
                } else {
                  void reviewCoordinator.acceptAll(pageId);
                }
              }
            }}
            isRejecting={rejectAllMutation.isPending}
            isAccepting={acceptAllMutation.isPending}
          />

          {/* Add comment form */}
          {showAddForm && pageId && (
            <NewCommentForm
              pageId={pageId}
              projectId={projectId}
              pendingQuote={pendingQuote}
              initialLine={commentLine}
              initialLineEnd={commentLineEnd}
              members={mentionMembers}
              onClose={() => setShowAddForm(false)}
            />
          )}

          {/* Main Feed */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3">
            {isCommentsLoading || isSuggestionsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none shrink-0" />
                <span className="text-xs">Loading review items…</span>
              </div>
            ) : totalAllItems === 0 ? (
              showAddForm ? null : <EmptyReviewState />
            ) : totalVisibleItems === 0 ? (
              <EmptyReviewState
                title="No open comments or suggestions"
                subtitle="All comments and suggestions have been resolved."
              />
            ) : (
              <div className="flex flex-col">
                {/* Suggestions (Track Changes) */}
                {visibleSuggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    pageId={pageId!}
                    onNavigate={handleNavigateToLine}
                    onAccept={handleAcceptSuggestion}
                    onReject={handleRejectSuggestion}
                    isAccepting={acceptMutation.isPending}
                    isRejecting={rejectMutation.isPending}
                    isHighlighted={highlightId === s.id}
                    membersMap={membersMap}
                  />
                ))}

                {/* Comments */}
                <div className="flex flex-col">
                  {visibleComments.map((comment) => (
                    <CommentCard
                      key={comment.id}
                      comment={comment}
                      pageId={pageId!}
                      projectId={projectId}
                      currentUserId={user?.id}
                      onNavigate={comment.line != null ? handleNavigateToLine : undefined}
                      isHighlighted={highlightId === comment.id}
                      members={mentionMembers}
                      membersMap={membersMap}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Scope: Overview View ── */
        <OverviewView
          files={allProjectFiles}
          currentUserId={user?.id}
          projectId={projectId}
          showResolved={showResolved}
          onNavigateToFile={handleNavigateToFileAndLine}
          members={mentionMembers}
          membersMap={membersMap}
          onOverviewResolvedCount={setOverviewResolvedCount}
        />
      )}

      {/* ── Bottom Navigation Tabs: Current file vs Overview ── */}
      <ReviewBottomNav scope={scope} onScopeChange={setScope} />
    </div>
  );
});

export default ReviewTab;
