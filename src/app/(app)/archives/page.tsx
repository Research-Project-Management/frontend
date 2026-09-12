import type { Metadata } from 'next';
import ArchivePage from '@/features/workspaces/projects/shell/pages/ArchivePage';

export const metadata: Metadata = {
  title: 'Archived Projects · Flux',
  description: 'Manage and restore archived projects in the workspace.',
};

export default function WorkspaceArchivesRoute() {
  return <ArchivePage />;
}
