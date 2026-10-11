import WorkItemPage, { WorkItemPage as WorkItemPageComponent } from './pages/WorkItemPage';

export default WorkItemPage;
export { WorkItemPage, WorkItemPageComponent };

// Disambiguate duplicate type exports between types, schemas, and hooks
export type {
  CreateSubItemInput,
  Priority,
  RelationType,
  StateGroup,
  WorkItemPriority,
  ViewMode,
} from './types/work-item.types';

export * from './types/work-item.types';
export * from './schemas/work-item.schema';
export * from './utils/work-item.utils';

// Hooks
export * from './hooks/use-work-item';
export * from './hooks/use-topbar';
export * from './hooks/use-realtime';
export * from './hooks/use-comment';
export * from './hooks/use-relation';
export * from './hooks/use-label';
export * from './hooks/use-archive';
export * from './hooks/use-property';

// Services
export * from './services/core.service';
export * from './services/comment.service';
export * from './services/relation.service';
export * from './services/attachment.service';
export * from './services/archive.service';
export * from './services/view.service';
export * from './services/state.service';

// Modals & Popovers
export * from './components/modals/Popovers';
export {
  default as DetailModal,
  WorkItemDetailModal,
  DetailModal as WorkItemDialog,
} from './components/modals/DetailModal';
export {
  default as CreateModal,
  CreateModal as CreateWorkItemModal,
} from './components/modals/CreateModal';
