import type { Metadata } from 'next';
import { ProjectCollectionPage } from '@/features/projects';

export const metadata: Metadata = { title: 'Collection · Project · Flux' };

export default function CollectionPage() {
  return <ProjectCollectionPage />;
}
