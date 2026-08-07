import type { Metadata } from 'next';
import { TrashPage } from '@/features/storage';

export const metadata: Metadata = { title: 'Trash · Storage · Flux' };

export default function ProjectTrashPage() {
  return <TrashPage />;
}
