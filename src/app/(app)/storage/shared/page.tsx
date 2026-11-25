import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Shared · Storage' };

export default function StorageSharedPage() {
  redirect('/storage?view=shared');
}
