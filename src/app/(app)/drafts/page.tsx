import type { Metadata } from 'next';
import DraftsPage from '@/features/projects/drafts/pages/DraftsPage';

export const metadata: Metadata = { title: 'Drafts' };

export default function DraftsRoute() {
  return <DraftsPage />;
}
