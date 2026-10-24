import type { Metadata } from 'next';
import { WorkItemPage } from '@/features/projects/project-id/work-items/pages/WorkItemPage';

export const metadata: Metadata = {
  title: 'View · Flux',
  description: 'Saved view for project work items.',
};

export default function ProjectViewDetailRoute() {
  return <WorkItemPage />;
}
