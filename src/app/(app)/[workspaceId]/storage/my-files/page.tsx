import type { Metadata } from 'next';
import { WorkspaceMyFilesPage } from '@/features/storage';

export const metadata: Metadata = { title: 'My Files · Storage · Flux' };

export default function WorkspaceStorageMyFilesPage() {
  return <WorkspaceMyFilesPage />;
}
