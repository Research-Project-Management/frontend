/**
 * Public API Surface for features/projects
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Layouts & Shell
export { default as ProjectLayout } from './shell/components/ProjectLayout';
export { default as ProjectSidebar } from './shell/components/Sidebar';

// Pages
export { default as ProjectsPage } from './shell/pages/ProjectsPage';
export { default as ArchivePage } from './shell/pages/ArchivePage';
export { default as WorkspaceViewsPage } from './shell/pages/WorkspaceViewsPage';
export { default as WorkspacePagesPage } from './shell/pages/WorkspacePagesPage';

// Hooks
export { useProjects, useProject } from './shell/hooks/use-project';
export { useFavorites } from './shell/hooks/use-favorites';
export * from './shell/hooks/use-project-state';

// Sub-modules
export * from './project-id/pages';
