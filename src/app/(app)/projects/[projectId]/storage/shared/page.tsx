import type { Metadata } from 'next';
import SharedPage from '@/features/workspaces/projects/project-id/storage/pages/SharedPage';

export const metadata: Metadata = { title: 'Shared · Storage · Flux' };

export default function ProjectSharedPage() {
  return <SharedPage />;
}
