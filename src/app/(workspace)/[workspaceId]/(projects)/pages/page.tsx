import type { Metadata } from 'next';
import { DraftPage } from '@/features/workspaces/projects/all-drafts';

export const metadata: Metadata = { title: 'Pages · Flux' };

export default function PagesPage() {
  return <DraftPage />;
}
