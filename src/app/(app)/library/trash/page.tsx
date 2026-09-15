import type { Metadata } from 'next';
import TrashPage from '@/features/library/pages/TrashPage';

export const metadata: Metadata = { title: 'Trash · Library · Flux' };

export default function LibraryTrashPage() {
  return <TrashPage />;
}
