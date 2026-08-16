// ── workspaces/projects public API ───────────────────────────────────────────
// Full projects domain: workspace-level sections + project detail pages.

// ── Shell (workspace sub-sidebar & shared project topbar) ──────────────────────
export * from './shell';

// ── Workspace sections ────────────────────────────────────────────────────────
export * from './home';
export * from './your-work';
export {
  PagesPage,
  GridView,
  ListView,
  TopBar as PagesTopBar,
  EmptyState as PagesEmptyState,
  CreateModal as PageCreateModal,
  Card as PageCard,
} from './all-pages';
export * from './all-pages/types/page.types';
export * from './all-pages/schemas/page.schema';
export * from './all-pages/services/page.service';
export * from './all-pages/hooks/use-page';

export * from './stickies';

// ── Project Detail specific modules ───────────────────────────────────────────
export * from './project-id/overview';
export * from './project-id/settings';
export { default as MemberPage } from './project-id/settings/pages/MemberPage';
export { default as ProjectGeneralPage } from './project-id/settings/pages/GeneralPage';
export { default as ProjectModulesPage } from './project-id/settings/pages/ModulesPage';
