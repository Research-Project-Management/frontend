// ── projects/shell public API ─────────────────────────────────────────────────
// Project-level chrome: workspace sub-sidebar & Projects list page

// ── Components & Pages ────────────────────────────────────────────────────────
export { Sidebar as ProjectsSidebar, default as ProjectsSidebarDefault } from './components/layout/Sidebar';
export { Topbar as ProjectsTopbar } from './components/layout/Topbar';
export { CreateProjectModal, CreateProjectModal as CreateProject } from './components/modals/CreateProjectModal';
export { Card, Card as ProjectCard } from './components/card/Card';
export { ProjectsPage, ProjectsPage as default } from './pages/ProjectsPage';

// ── Types ─────────────────────────────────────────────────────────────────────
export * from './types/project.types';

// ── Services & Hooks ──────────────────────────────────────────────────────────
export * from './services/project.service';

