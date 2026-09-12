import type { Metadata } from 'next';
import TrashPage from '@/features/workspaces/projects/project-id/storage/pages/TrashPage';

export const metadata: Metadata = { title: 'Trash · Storage · Flux' };

export default function ProjectTrashPage() {
  return <TrashPage />;
}
