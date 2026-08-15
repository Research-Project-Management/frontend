import type { Metadata } from 'next';
import { OverviewPage } from '@/features/workspaces/projects/project-id/overview';

export const metadata: Metadata = { title: 'Overview · Flux' };

export default function ProjectOverviewRoute() {
  return <OverviewPage />;
}
