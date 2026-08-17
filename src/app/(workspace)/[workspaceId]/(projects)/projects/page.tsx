import type { Metadata } from 'next';
import ProjectsPage from '@/features/workspaces/projects/shell/pages/ProjectsPage';

export const metadata: Metadata = {
  title: 'Projects · Flux',
  description: 'Manage and explore all projects in the workspace.',
};

export default function ProjectsRoute() {
  return <ProjectsPage />;
}
