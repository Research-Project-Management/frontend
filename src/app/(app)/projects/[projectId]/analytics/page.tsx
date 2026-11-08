import type { Metadata } from 'next';
import ProjectAnalyticsPage from '@/features/projects/project-id/analytics/pages/ProjectAnalyticsPage';

export const metadata: Metadata = {
  title: 'Analytics · Flux',
  description: 'Project workload, velocity, and work item distribution analytics.',
};

export default function ProjectAnalyticsRoute() {
  return <ProjectAnalyticsPage />;
}
