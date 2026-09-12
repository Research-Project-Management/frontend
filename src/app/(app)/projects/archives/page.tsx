import type { Metadata } from 'next';
import ArchivePage from '@/features/workspaces/projects/shell/pages/ArchivePage';

export const metadata: Metadata = {
  title: 'Archived Projects · Flux',
  description: 'Manage and restore your archived research projects.',
};

export default function ProjectsArchivesRoute() {
  return <ArchivePage />;
}
