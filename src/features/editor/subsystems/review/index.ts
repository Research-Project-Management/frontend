/**
 * src/features/editor/subsystems/review/index.ts
 *
 * Review & Track Changes Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - CodeMirror 6 Review Mode & Track Changes Extensions (Visual decorations & Inline popover widgets).
 * - Realtime Comments, Thread Resolutions & Mention Notification Bundler.
 * - Single-Click Suggestion Accept / Reject with Optimistic Buffer Updating.
 * - Review Sidebar Tab (Overview, Comments list, Suggestions list).
 */

// 1. Coordinators
export {
  reviewCoordinator,
  ReviewCoordinatorRegistry,
} from './coordinator/review.coordinator';
export type {
  ReviewServicePort,
  ReviewNotificationPort,
  ReviewStorePort,
  ReviewCoordinatorPorts,
} from './model/review-service-port';

// 2. CodeMirror Extensions
export {
  createTrackChangesExtension,
  trackChangesExtension,
  trackChangesStateField,
  trackChangesDecorationsField,
  trackChangesGutter,
  trackChangesHoverTooltip,
  setTrackChangesSuggestionsEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  getSafeOffset,
  type TrackChangesViewMode,
  type TrackChangesConfig,
  type TrackChangesExtensionOptions,
} from './extensions/track-changes.extension';
export {
  createInlineDiffExtension,
  diffProposalField,
  proposeDiffEffect,
  acceptDiffEffect,
  rejectDiffEffect,
  clearDiffEffect,
  type DiffProposal,
} from '@/features/editor/core/engine/extensions/inline-diff';

// 3. UI Presentation Layer
export { default as ReviewTab } from './ui/ReviewTab';
export { MentionTextarea } from './ui/subcomponents/MentionTextarea';
export {
  OverviewView,
  OverviewFileGroup,
  type OverviewViewProps,
  type OverviewFileGroupProps,
} from './ui/subcomponents/ReviewOverview';
export {
  CommentCard,
  ReplyRow,
  ReplyForm,
  NewCommentForm,
  type CommentCardProps,
  type ReplyRowProps,
  type ReplyFormProps,
  type NewCommentFormProps,
} from './ui/subcomponents/ReviewComments';
export {
  SuggestionCard,
  SuggestionBulkActions,
  TrackChangesControlBar,
  type SuggestionCardProps,
  type SuggestionBulkActionsProps,
  type TrackChangesControlBarProps,
} from './ui/subcomponents/ReviewSuggestions';
export {
  ReviewHeader,
  ReviewBottomNav,
  EmptyReviewState,
  type ReviewScope,
  type ReviewHeaderProps,
  type ReviewBottomNavProps,
  type EmptyReviewStateProps,
} from './ui/subcomponents/ReviewNav';
export {
  OverleafReviewIcon,
  OverleafResolvedCommentsIcon,
  MentionBadge,
  MentionRenderer,
  NotificationDigestBadge,
} from './ui/subcomponents/ReviewBadges';
export {
  suggestionKeys,
  usePageSuggestions,
  useCreateSuggestion,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptAllSuggestions,
  useRejectAllSuggestions,
} from './ui/hooks/useSuggestion';
export {
  commentKeys,
  usePageComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useAddReply,
  useResolveComment,
  useDeleteReply,
} from './ui/hooks/useComment';
export {
  useNotificationSettings,
  useUpdateNotificationSettings,
  notificationBundlerKeys,
} from './ui/hooks/useNotificationBundler';
export {
  useReviewPendingCount,
  type ReviewPendingCountResult,
} from './ui/hooks/useReviewPendingCount';
export {
  useSafeQueryClient,
  fallbackQueryClient,
} from './ui/hooks/safeQueryClient';


