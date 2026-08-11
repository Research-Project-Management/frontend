import type { Metadata } from 'next';
import WorkspaceSharedPage from '@/features/workspaces/storage/pages/SharedPage';

export const metadata: Metadata = { title: 'Shared · Storage · Flux' };

export default function WorkspaceStorageSharedPage() {
  return <WorkspaceSharedPage />;
}
