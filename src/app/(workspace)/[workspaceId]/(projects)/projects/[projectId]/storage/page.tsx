import type { Metadata } from 'next';
import StoragePage from '@/features/workspaces/projects/project-id/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Storage · Flux' };

export default function ProjectStoragePage() {
  return <StoragePage />;
}
