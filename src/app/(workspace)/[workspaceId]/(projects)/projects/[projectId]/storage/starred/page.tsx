import type { Metadata } from 'next';
import { StarredPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Starred · Storage · Flux' };

export default function ProjectStarredPage() {
  return <StarredPage />;
}
