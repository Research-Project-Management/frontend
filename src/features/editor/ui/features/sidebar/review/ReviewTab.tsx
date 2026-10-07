'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { PlaneErrorState } from '@/shared/components/ui';
import { useReviewState } from './hooks/useReviewState';
import { ReviewHeader } from './subcomponents/ReviewHeader';
import { ReviewBottomNav } from './subcomponents/ReviewBottomNav';
import { EmptyReviewState } from './subcomponents/EmptyReviewState';
import { CommentCard } from './subcomponents/CommentCard';
import { SuggestionCard } from './subcomponents/SuggestionCard';
import { SuggestionBulkActions } from './subcomponents/SuggestionBulkActions';
import { NewCommentForm } from './subcomponents/NewCommentForm';
import { OverviewView } from './subcomponents/OverviewView';
import { NotificationDigestBadge } from './subcomponents/NotificationDigestBadge';
import { TrackChangesControlBar } from './subcomponents/TrackChangesControlBar';
import { useSettingsStore } from '@/features/editor/store';

export const ReviewTab = React.memo(function ReviewTab({ onClose }: { onClose?: () => void }) {
  const {
    pageId,
    projectId,
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

  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const setReviewMode = useSettingsStore((s) => s.setReviewMode);
  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const setTrackChangesViewMode = useSettingsStore((s) => s.setTrackChangesViewMode);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-foreground select-none">
      {/* ── Top Header ── */}
      <ReviewHeader
        showResolved={showResolved}
        onToggleResolved={handleToggleResolved}
        activeResolvedCount={activeResolvedCount}
        onClose={onClose}
      />

      {/* ── Official Overleaf Track Changes Control Bar ── */}
      <TrackChangesControlBar
        reviewMode={reviewMode}
        onToggleReviewMode={setReviewMode}
        viewMode={trackChangesViewMode}
        onViewModeChange={setTrackChangesViewMode}
        pendingCount={pendingSuggestions.length}
      />

      {/* ── Content View Area ── */}
      {isCommentsError || isSuggestionsError ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
          <PlaneErrorState
            title="Unable to load reviews"
            description="An issue occurred while loading comments and suggestions."
            error={commentsError || suggestionsError || new Error('Review data load failed')}
          />
        </div>
      ) : scope === 'current' ? (
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {/* 10-Minute Notification Digest Banner */}
          {totalAllItems > 0 && (
            <div className="px-3 pt-2 shrink-0">
              <NotificationDigestBadge projectId={projectId} pageId={pageId} />
            </div>
          )}

          {/* Bulk Actions for Pending Suggestions */}
          <SuggestionBulkActions
            count={pendingSuggestions.length}
            onRejectAll={() => pageId && rejectAllMutation.mutate({ pageId })}
            onAcceptAll={() => pageId && acceptAllMutation.mutate({ pageId })}
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
              <EmptyReviewState />
            ) : totalVisibleItems === 0 ? (
              <EmptyReviewState
                title="No open comments or suggestions"
                subtitle="All comments and suggestions have been resolved."
                action={
                  <button
                    type="button"
                    onClick={() => setShowResolved(true)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    Show resolved comments: {currentFileResolvedCount}
                  </button>
                }
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
