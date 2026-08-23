import type { Metadata } from 'next';
import WorkspaceMyFilesPage from '@/features/workspaces/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'Folder · Storage · Flux' };

export default function WorkspaceStorageFolderPage() {
  return <WorkspaceMyFilesPage />;
}
