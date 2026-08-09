import type { Metadata } from 'next';
import { ProjectCollectionPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Collection · Project · Flux' };

export default function CollectionPage() {
  return <ProjectCollectionPage />;
}
