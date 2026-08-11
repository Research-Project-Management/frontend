import type { Metadata } from 'next';
import ProjectCollectionPage from '@/features/workspaces/projects/project-id/collection/pages/ProjectCollectionPage';

export const metadata: Metadata = { title: 'Collection · Project · Flux' };

export default function CollectionPage() {
  return <ProjectCollectionPage />;
}
