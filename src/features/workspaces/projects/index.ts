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
export * from './all-pages/schemas/page.schemas';
export * from './all-pages/services/page.services';
export * from './all-pages/hooks/use-page';
export * from './stickies';

// ── Project Detail specific modules ───────────────────────────────────────────
export * from './project-id/overview';
export { default as TeamPage } from './project-id/settings/pages/TeamPage';
export { default as ProjectGeneralPage } from './project-id/settings/pages/GeneralPage';
export { default as ProjectModulesPage } from './project-id/settings/pages/ModulesPage';
