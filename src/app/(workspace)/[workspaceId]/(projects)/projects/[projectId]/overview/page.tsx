import type { Metadata } from 'next';
import { ProjectOverview } from '@/features/workspaces';

export const metadata: Metadata = { title: 'OverviewPage · Flux' };

export default function ProjectOverviewPage() {
  return <ProjectOverview />;
}
