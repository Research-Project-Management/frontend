import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Starred · Storage' };

export default function StorageStarredPage() {
  redirect('/storage?view=starred');
}
