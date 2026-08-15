// ── workspaces/projects public API ───────────────────────────────────────────
// Full projects domain: workspace-level sections + project detail pages.

// ── Shell (workspace sub-sidebar) ─────────────────────────────────────────────
export * from './shell';

// ── Workspace sections ────────────────────────────────────────────────────────
export * from './home';
export * from './your-work';
export * from './all-pages';
export * from './stickies';

// ── Project Detail specific modules ───────────────────────────────────────────

export { default as ProjectOverview } from './project-id/overview/pages/OverviewPage';
export { default as Topbar } from './project-id/overview/components/Topbar';
export { default as TeamPage } from './project-id/settings/pages/TeamPage';
export { default as ProjectGeneralPage } from './project-id/settings/pages/GeneralPage';
export { default as ProjectModulesPage } from './project-id/settings/pages/ModulesPage';
