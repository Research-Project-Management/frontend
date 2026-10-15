/**
 * Features / Projects / Project-Id / Work-Items - Public API
 *
 * Scoped, clean entry point exporting public page, API client, types, and primary hooks.
 */

// ── Types ────────────────────────────────────────────────────────────────────
export * from './types/work-item.types';
export * from './types/layout.types';
export * from './types/filter.types';
export * from './types/modal.types';

// ── API Services ─────────────────────────────────────────────────────────────
export {
  workItemApi,
  CoreService,
  CoreService as WorkItemService,
  StateService,
  AttachmentService,
  CommentService,
  AssignmentService,
  RelationService,
  LabelService,
  HistoryService,
  ArchiveService,
  AnalyticsService,
  AVAILABLE_LABEL_COLORS,
  DEFAULT_LABEL_COLOR,
} from './api/work-item.api';

// ── Hooks ────────────────────────────────────────────────────────────────────
export * from './hooks/use-work-item';
export * from './hooks/use-work-item-crud';
export * from './hooks/use-work-items-query';
export * from './hooks/use-work-item-grouping';
export * from './hooks/use-work-item-selection';
export * from './hooks/use-archive';

// ── Page Component ───────────────────────────────────────────────────────────
export { default as WorkItemPage } from './pages/WorkItemPage';
