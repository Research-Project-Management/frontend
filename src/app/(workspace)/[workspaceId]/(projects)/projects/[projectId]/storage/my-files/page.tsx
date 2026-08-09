import type { Metadata } from 'next';
import { MyFilesPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'My Files · Storage · Flux' };

export default function ProjectMyFilesPage() {
  return <MyFilesPage />;
}
