import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Duplicates · Library' };

export default function LibraryDuplicatesPage() {
  redirect('/library?filter=duplicates');
}

