import type { Metadata } from 'next';
import WorkspaceMyFilesPage from '@/features/workspaces/storage/pages/MyFilesPage';

export const metadata: Metadata = { title: 'My Files · Storage · Flux' };

export default function WorkspaceStorageMyFilesPage() {
  return <WorkspaceMyFilesPage />;
}
