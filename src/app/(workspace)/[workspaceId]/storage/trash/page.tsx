import type { Metadata } from 'next';
import { WorkspaceTrashPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Trash · Storage · Flux' };

export default function WorkspaceStorageTrashPage() {
  return <WorkspaceTrashPage />;
}
