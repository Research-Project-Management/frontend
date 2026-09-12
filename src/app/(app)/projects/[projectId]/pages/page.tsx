import type { Metadata } from 'next';
import PagesPage from '@/features/workspaces/projects/project-id/pages/pages/PagesPage';

export const metadata: Metadata = { title: 'Pages · Flux' };

export default function ProjectPagesRoute() {
  return <PagesPage />;
}
