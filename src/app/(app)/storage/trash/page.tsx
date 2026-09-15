import type { Metadata } from 'next';
import TrashPage from '@/features/storage/pages/TrashPage';

export const metadata: Metadata = { title: 'Trash · Storage · Flux' };

export default function StorageTrashPage() {
  return <TrashPage />;
}
