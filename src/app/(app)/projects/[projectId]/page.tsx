import type { Metadata } from 'next';
import { WorkItemPage } from '@/features/projects/project-id/work-items/pages/WorkItemPage';

export const metadata: Metadata = { title: 'Work Items · Flux' };

export default function ProjectRootPage() {
  return <WorkItemPage />;
}
