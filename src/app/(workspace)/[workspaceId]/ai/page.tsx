import type { Metadata } from 'next';
import { EmptyState } from '@/features/workspaces';

export const metadata: Metadata = { title: 'AI' };

export default function AiIndexPage() {
  return <EmptyState />;
}
