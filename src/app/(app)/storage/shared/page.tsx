import type { Metadata } from 'next';
import SharedPage from '@/features/workspaces/storage/pages/SharedPage';

export const metadata: Metadata = { title: 'Shared · Storage · Flux' };

export default function StorageSharedPage() {
  return <SharedPage />;
}
