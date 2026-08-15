import type { Metadata } from 'next';
import { TrashPage } from '@/features/workspaces/library';

export const metadata: Metadata = { title: 'Trash · Library · Flux' };

export default function LibraryTrashPage() {
  return <TrashPage />;
}
