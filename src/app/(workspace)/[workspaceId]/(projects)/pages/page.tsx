import type { Metadata } from 'next';
import PagesPage from '@/features/workspaces/projects/all-pages/pages/PagesPage';

export const metadata: Metadata = { title: 'Pages · Flux' };

export default function PagesRoute() {
  return <PagesPage />;
}
