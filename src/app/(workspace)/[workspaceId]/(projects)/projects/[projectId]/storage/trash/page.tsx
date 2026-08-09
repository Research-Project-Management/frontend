import type { Metadata } from 'next';
import { TrashPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Trash · Storage · Flux' };

export default function ProjectTrashPage() {
  return <TrashPage />;
}
