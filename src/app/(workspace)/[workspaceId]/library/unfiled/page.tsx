import type { Metadata } from 'next';
import UnfiledPage from '@/features/workspaces/library/pages/UnfiledPage';

export const metadata: Metadata = { title: 'Unfiled Items · Library · Flux' };

export default function LibraryUnfiledPage() {
  return <UnfiledPage />;
}
