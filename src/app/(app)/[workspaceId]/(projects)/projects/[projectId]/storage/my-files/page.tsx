import type { Metadata } from 'next';
import { MyFilesPage } from '@/features/storage';

export const metadata: Metadata = { title: 'My Files · Storage · Flux' };

export default function ProjectMyFilesPage() {
  return <MyFilesPage />;
}
