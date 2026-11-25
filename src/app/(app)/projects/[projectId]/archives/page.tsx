import type { Metadata } from 'next';
import ProjectArchivesPage from '@/features/projects/project-id/archives/pages/ProjectArchivesPage';

export const metadata: Metadata = {
  title: 'Archives',
  description: 'View and restore archived work items and pages in this project.',
};

export default function ProjectArchivesRoute() {
  return <ProjectArchivesPage />;
}
