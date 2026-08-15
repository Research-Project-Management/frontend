import type { Metadata } from 'next';
import { DuplicatesPage } from '@/features/workspaces/library';

export const metadata: Metadata = { title: 'Duplicate Items · Library · Flux' };

export default function LibraryDuplicatesPage() {
  return <DuplicatesPage />;
}
