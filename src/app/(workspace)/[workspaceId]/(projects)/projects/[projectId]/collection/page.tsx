import type { Metadata } from 'next';
import CollectionPage from '@/features/workspaces/projects/project-id/collection/pages/CollectionPage';

export const metadata: Metadata = { title: 'Collection · Flux' };

export default function ProjectCollectionRoute() {
  return <CollectionPage />;
}

