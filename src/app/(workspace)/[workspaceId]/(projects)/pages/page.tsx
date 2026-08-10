import type { Metadata } from 'next';
import { DraftPage } from '@/features/workspaces/projects';

export const metadata: Metadata = { title: 'Pages · Flux' };

export default function PagesPage() {
  return <DraftPage />;
}
