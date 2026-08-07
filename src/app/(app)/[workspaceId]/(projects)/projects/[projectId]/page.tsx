import type { Metadata } from 'next';
import { ProjectOverview } from '@/features/projects';

export const metadata: Metadata = { title: 'Overview · Flux' };

export default function ProjectOverviewPage() {
  return <ProjectOverview />;
}
