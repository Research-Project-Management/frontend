import type { Metadata } from 'next';
import { WorkspaceSharedPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Shared · Storage · Flux' };

export default function WorkspaceStorageSharedPage() {
  return <WorkspaceSharedPage />;
}
