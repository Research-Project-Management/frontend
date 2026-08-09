import type { Metadata } from 'next';
import { StoragePage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Storage · Flux' };

export default function ProjectStoragePage() {
  return <StoragePage />;
}
