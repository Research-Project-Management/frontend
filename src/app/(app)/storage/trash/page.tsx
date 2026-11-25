import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Trash · Storage' };

export default function StorageTrashPage() {
  redirect('/storage?view=trash');
}
