// ── projects/shell public API ─────────────────────────────────────────────────
// Project-level chrome: workspace sub-sidebar (Home, Your Work, Stickies, Projects list)
// Analogous to workspaces/shell for the project tab layer.

// ── Components ────────────────────────────────────────────────────────────────

export { default as ProjectsSidebar } from './components/sidebar';
export { default as ProjectsHeader } from './components/header';
export { default as CreateProject } from './components/create-project';

// ── Services ──────────────────────────────────────────────────────────────────
export * from './services/services/project.services';
export { useDocumentTitle } from './hooks/hooks/useDocumentTitle';
