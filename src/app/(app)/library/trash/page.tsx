import type { Metadata } from 'next';
import { Suspense } from 'react';
import TrashPage from '@/features/library/pages/TrashPage';

export const metadata: Metadata = { title: 'Trash · Library · Flux' };

export default function LibraryTrashPage() {
  return (
    <Suspense fallback={null}>
      <TrashPage />
    </Suspense>
  );
}
