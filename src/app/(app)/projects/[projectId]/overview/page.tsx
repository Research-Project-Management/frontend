import type { Metadata } from 'next';
import { ProjectOverviewPage } from '@/features/projects/project-id/overview/pages/ProjectOverviewPage';

export const metadata: Metadata = {
  title: 'Project Overview · Flux',
  description: 'Aggregated mission control and snapshot of the project',
};

export default function OverviewRoutePage() {
  return <ProjectOverviewPage />;
}
