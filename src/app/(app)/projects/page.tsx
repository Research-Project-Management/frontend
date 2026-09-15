import type { Metadata } from 'next';
import ProjectsPage from '@/features/projects/shell/pages/ProjectsPage';

export const metadata: Metadata = {
  title: 'Projects · Flux',
  description: 'Manage and explore all research projects.',
};

export default function ProjectsRoute() {
  return <ProjectsPage />;
}
