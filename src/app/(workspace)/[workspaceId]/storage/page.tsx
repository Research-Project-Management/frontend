import type { Metadata } from 'next';
import { WorkspaceHomePage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Storage · Flux' };

export default function WorkspaceStoragePage() {
  return <WorkspaceHomePage />;
}
