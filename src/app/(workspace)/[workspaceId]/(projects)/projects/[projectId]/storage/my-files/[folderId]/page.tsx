import type { Metadata } from 'next';
import MyFilesPage from '@/features/workspaces/projects/project-id/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'Folder · Storage · Flux' };

export default function ProjectStorageFolderPage() {
  return <MyFilesPage />;
}
