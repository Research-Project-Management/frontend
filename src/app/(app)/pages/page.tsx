import type { Metadata } from 'next';
import PagesPage from '@/features/projects/project-id/pages/pages/PagesPage';

export const metadata: Metadata = { title: 'Pages · Flux' };

export default function PagesRoute() {
  return <PagesPage />;
}
