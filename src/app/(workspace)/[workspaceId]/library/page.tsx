import type { Metadata } from 'next';
import { LibraryHomePage } from '@/features/workspaces/library';

export const metadata: Metadata = { title: 'Library · Flux' };

export default function LibraryIndexPage() {
  return <LibraryHomePage />;
}
