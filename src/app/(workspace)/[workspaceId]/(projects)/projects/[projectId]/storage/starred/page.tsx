import type { Metadata } from 'next';
import StarredPage from '@/features/workspaces/projects/project-id/storage/pages/StarredPage';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function ProjectStarredPage() {
  return <StarredPage />;
}
