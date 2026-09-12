import type { Metadata } from 'next';
import ProjectViewsPage from '@/features/workspaces/projects/project-id/views/pages/ProjectViewsPage';

export const metadata: Metadata = {
  title: 'Views · Flux',
  description: 'Customized saved views and perspectives for project work items.',
};

export default function ProjectViewsRoute() {
  return <ProjectViewsPage />;
}
