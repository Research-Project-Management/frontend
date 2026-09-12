import type { Metadata } from 'next';
import WorkspaceHomePage from '@/features/workspaces/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Storage · Flux' };

export default function WorkspaceStoragePage() {
  return <WorkspaceHomePage />;
}
