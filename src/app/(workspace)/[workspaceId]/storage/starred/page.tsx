import type { Metadata } from 'next';
import { WorkspaceStarredPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function WorkspaceStorageStarredPage() {
  return <WorkspaceStarredPage />;
}
