import type { Metadata } from 'next';
import { StarredPage } from '@/features/storage';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function ProjectStarredPage() {
  return <StarredPage />;
}
