import type { Metadata } from 'next';
import PagesPage from '@/features/projects/project-id/pages';

export const metadata: Metadata = { title: 'Pages · Flux' };

export default function ProjectPagesRoute() {
  return <PagesPage />;
}
