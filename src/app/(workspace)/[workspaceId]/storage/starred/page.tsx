import type { Metadata } from 'next';
import WorkspaceStarredPage from '@/features/workspaces/storage/pages/StarredPage';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function WorkspaceStorageStarredPage() {
  return <WorkspaceStarredPage />;
}
