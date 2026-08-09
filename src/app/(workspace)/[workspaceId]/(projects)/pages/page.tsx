import type { Metadata } from 'next';
import { PagesDashboard } from '@/features/workspaces/projects';

export const metadata: Metadata = { title: 'Pages · Flux' };

export default function PagesPage() {
  return <PagesDashboard />;
}
