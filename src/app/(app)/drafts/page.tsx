import type { Metadata } from 'next';
import DraftsPage from '@/features/workspaces/projects/drafts/pages/DraftsPage';

export const metadata: Metadata = { title: 'Drafts · Flux' };

export default function DraftsRoute() {
  return <DraftsPage />;
}
