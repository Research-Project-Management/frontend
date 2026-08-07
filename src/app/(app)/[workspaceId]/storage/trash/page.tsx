import type { Metadata } from 'next';
import { WorkspaceTrashPage } from '@/features/storage';

export const metadata: Metadata = { title: 'Trash · Storage · Flux' };

export default function WorkspaceStorageTrashPage() {
  return <WorkspaceTrashPage />;
}
