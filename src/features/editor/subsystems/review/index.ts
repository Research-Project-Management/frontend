/**
 * src/features/editor/subsystems/review/index.ts
 *
 * Review & Track Changes Subsystem Public Seam.
 */

// 1. Coordinator & Owned Service Port
export {
  reviewCoordinator,
  ReviewCoordinator,
  type ReviewCoordinatorOptions,
  type ReviewServicePort,
} from './coordinator/review.coordinator';

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
  getSafeOffset,
  type RawSuggestion,
  type RawComment,
} from './extensions/review.extension';

// 3. UI Presentation Layer
export { ReviewTab } from './ui/ReviewTab';
export { ReviewIcon } from './ui/subcomponents/Badges';

// 4. Hooks
export { useReviewSync } from './hooks/useReviewSync';
