/**
 * src/features/editor/subsystems/review/index.ts
 *
 * Review & Track Changes Subsystem Public Seam.
 */

// 1. Coordinator & Ports
export {
  reviewCoordinator,
  ReviewCoordinator,
  type ReviewRollbackSnapshot,
  type SuggestionMemento,
} from './coordinator/review.coordinator';
export type {
  ReviewServicePort,
  ReviewNotificationPort,
  ReviewStorePort,
  ReviewCoordinatorPorts,
} from './model/ports';

// 2. CodeMirror Extensions
export {
  createReviewExtension,
  reviewStateField,
  reviewDecorationsField,
  reviewGutter,
  reviewHoverTooltip,
  getSuggestionTooltip,
  reviewModeFilter,
  reviewTheme,
  setSuggestionsEffect,
  setCommentsEffect,
  setViewModeEffect,
  setReviewModeEffect,
  setReviewDataEffect,
  setYDocEffect,
  getSafeOffset,
  resolveCommentRange,
  resolveSuggestionRange,
  encodeYjsAnchor,
  decodeYjsAnchor,
  resolveYjsAnchorRange,
  isLocalSuggestionId,
  createLocalSuggestionId,
  type TrackChangesViewMode,
  type ReviewExtensionConfig,
  type ReviewExtensionOptions,
  type RawSuggestion,
  type RawComment,
} from './extensions/review.extension';

// 3. UI Presentation Layer
export { ReviewTab } from './ui/ReviewTab';
export {
  MentionTextarea,
  type MentionTextareaProps,
  type MentionTextareaRef,
} from './ui/subcomponents/MentionInput';
export {
  OverviewView,
  OverviewFileGroup,
  type OverviewViewProps,
  type OverviewFileGroupProps,
} from './ui/subcomponents/Overview';
export {
  CommentCard,
  ReplyRow,
  ReplyForm,
  NewCommentForm,
  type CommentCardProps,
  type ReplyRowProps,
  type ReplyFormProps,
  type NewCommentFormProps,
} from './ui/subcomponents/Comments';
export {
  SuggestionCard,
  SuggestionBulkActions,
  TrackChangesControlBar,
  type SuggestionCardProps,
  type SuggestionBulkActionsProps,
  type TrackChangesControlBarProps,
} from './ui/subcomponents/Suggestions';
export {
  ReviewHeader,
  ReviewBottomNav,
  EmptyReviewState,
  type ReviewScope,
  type ReviewHeaderProps,
  type ReviewBottomNavProps,
  type EmptyReviewStateProps,
} from './ui/subcomponents/Nav';
export {
  ReviewIcon,
  ResolvedCommentsIcon,
  MentionBadge,
  MentionRenderer,
  type MentionBadgeProps,
  type MentionRendererProps,
} from './ui/subcomponents/Badges';

// 4. Hooks
export {
  suggestionKeys,
  usePageSuggestions,
  useCreateSuggestion,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptAllSuggestions,
  useRejectAllSuggestions,
} from './ui/hooks/useSuggestions';
export {
  commentKeys,
  usePageComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useAddReply,
  useResolveComment,
  useDeleteReply,
  useUpdateReply,
} from './ui/hooks/useComments';
export { useReviewSync } from './ui/hooks/useReviewSync';
export {
  useReviewPendingCount,
  type ReviewPendingCountResult,
} from './ui/hooks/usePendingCount';
export { useReviewState } from './ui/hooks/useReviewState';
