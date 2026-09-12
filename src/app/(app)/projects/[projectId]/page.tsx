import type { Metadata } from 'next';
import ProjectOverview from '@/features/workspaces/projects/project-id/overview/pages/OverviewPage';

export const metadata: Metadata = { title: 'OverviewPage · Flux' };

export default function ProjectOverviewPage() {
  return <ProjectOverview />;
}
