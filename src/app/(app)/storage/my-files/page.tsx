import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'My Files · Storage' };

export default function StorageMyFilesPage() {
  redirect('/storage?view=my-files');
}
