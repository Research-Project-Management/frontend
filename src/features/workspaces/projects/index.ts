// ── workspaces/projects public API ───────────────────────────────────────────
// Full projects domain: workspace-level sections + project detail pages.

// ── Shell (workspace sub-sidebar) ─────────────────────────────────────────────
export * from './shell';

// ── Workspace sections ────────────────────────────────────────────────────────
export { HomeDashboard } from './home';
export { YourWork } from './your-work';
export * from './all-drafts';
export * from './stickies';
export { PagesDashboard } from './pages';

// ── Project Detail specific modules ───────────────────────────────────────────
export { default as ProjectCollectionPage } from './project-id/collection/components/ProjectCollectionPage';
export { default as ProjectOverview } from './project-id/overview/components/Overview';
export { default as Topbar } from './project-id/overview/components/Topbar';
export { default as ModelSettings } from './project-id/settings/components/ModelSettings';
export { default as ModulesSettings } from './project-id/settings/components/ModulesSettings';
export { default as GeneralSettings } from './project-id/settings/components/GeneralSettings';
export { default as TeamSettings } from './project-id/settings/components/TeamSettings';
export { default as Team } from './project-id/team/components/Team';
