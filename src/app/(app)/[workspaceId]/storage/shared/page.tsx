import type { Metadata } from 'next';
import { WorkspaceSharedPage } from '@/features/storage';

export const metadata: Metadata = { title: 'Shared · Storage · Flux' };

export default function WorkspaceStorageSharedPage() {
  return <WorkspaceSharedPage />;
}
