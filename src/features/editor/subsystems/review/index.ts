/**
 * src/features/editor/subsystems/review/index.ts
 *
 * Review & Track Changes Subsystem Public Seam.
 */

// 1. Coordinator & Ports
export {
  reviewCoordinator,
  ReviewCoordinator,
} from './coordinator/review.coordinator';
export type {
  ReviewServicePort,
  ReviewNotificationPort,
  ReviewStorePort,
} from './model/ports';

// 2. CodeMirror Extensions
export {
  createReviewExtension,
  reviewStateField,
  reviewDecorationsField,
  reviewGutter,
  reviewHoverTooltip,
  getSuggestionTooltip,
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
  type RawSuggestion,
  type RawComment,
} from './extensions/review.extension';

// 3. UI Presentation Layer
export { ReviewTab } from './ui/ReviewTab';
export {
  CommentCard,
} from './ui/subcomponents/Comments';
export {
  SuggestionCard,
  SuggestionBulkActions,
} from './ui/subcomponents/Suggestions';
export {
  ReviewIcon,
} from './ui/subcomponents/Badges';

// 4. Hooks
export { useReviewSync } from './hooks/useReviewSync';
export {
  useReviewPendingCount,
} from './hooks/usePendingCount';
