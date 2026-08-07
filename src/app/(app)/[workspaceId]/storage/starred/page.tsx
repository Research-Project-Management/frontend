import type { Metadata } from 'next';
import { WorkspaceStarredPage } from '@/features/storage';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function WorkspaceStorageStarredPage() {
  return <WorkspaceStarredPage />;
}
